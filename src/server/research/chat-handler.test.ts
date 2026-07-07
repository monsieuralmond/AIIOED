import { beforeEach, describe, expect, it } from "vitest";
import { createResearchApiHandlers } from "./handlers.js";
import {
  emptyRequest,
  isRecord,
  MemoryResearchStore,
  requestWithSessionToken,
  sessionIdFrom,
  sessionTokenFrom
} from "./handlers-test-utils.js";

const requiredStringField = (value: unknown, field: string): string => {
  if (!isRecord(value) || typeof value[field] !== "string") throw new Error(`response did not include ${field}.`);
  return value[field];
};

describe("research chat handler", () => {
  beforeEach(() => {
    process.env["GEMINI_MODEL"] = "gemini-2.5-flash-lite";
    process.env["MAX_CHAT_TURNS_PER_MINUTE"] = "6";
    process.env["READING_COACH_AI_MODE"] = "mock";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  it("returns the stored assistant turn for duplicate chat requestIds", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const request = requestWithSessionToken(sessionTokenFrom(started));
    const sessionId = sessionIdFrom(started);

    const first = await handlers.chat({ message: "양자컴퓨터가 뭐야?", requestId: "request-1", sessionId }, request);
    const second = await handlers.chat({ message: "양자컴퓨터가 뭐야?", requestId: "request-1", sessionId }, request);

    expect(requiredStringField(first, "text")).toBe(requiredStringField(second, "text"));
    expect(store.chatInsertCount).toBe(2);
  });

  it("rejects duplicate chat requestIds while the first request is still processing", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const request = requestWithSessionToken(sessionTokenFrom(started));
    const sessionId = sessionIdFrom(started);
    await store.insertChatTurn({
      id: "chat-student-existing",
      requestId: "request-in-flight",
      role: "student",
      sessionId,
      stage: "ai_chat",
      text: "먼저 처리 중인 질문",
      timestamp: "2026-07-05T00:00:00.000Z"
    });

    await expect(handlers.chat({
      message: "같은 요청을 다시 보냄",
      requestId: "request-in-flight",
      sessionId
    }, request)).rejects.toMatchObject({ statusCode: 409 });

    expect(store.storedChatTurns.filter((turn) => turn.requestId === "request-in-flight")).toHaveLength(1);
    expect(store.chatInsertCount).toBe(1);
  });

  it("rate limits rapid distinct chat requests before calling the AI again", async () => {
    process.env["MAX_CHAT_TURNS_PER_MINUTE"] = "1";
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const request = requestWithSessionToken(sessionTokenFrom(started));
    const sessionId = sessionIdFrom(started);

    await handlers.chat({ message: "첫 질문", requestId: "request-rate-1", sessionId }, request);
    await expect(handlers.chat({
      message: "둘째 질문",
      requestId: "request-rate-2",
      sessionId
    }, request)).rejects.toMatchObject({ statusCode: 429 });
  });

  it("reports the Gemini model for duplicate real chat requestIds", async () => {
    process.env["GEMINI_MODEL"] = "gemini-test-model";
    process.env["READING_COACH_AI_MODE"] = "real";
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const sessionId = sessionIdFrom(started);
    store.assistantTurnsByRequest.set(`${sessionId}:request-2`, {
      id: "chat-assistant-existing",
      requestId: "request-2",
      responseType: "clarify",
      role: "assistant",
      sessionId,
      stage: "ai_chat",
      text: "이미 저장된 답변입니다.",
      timestamp: "2026-07-03T00:00:00.000Z"
    });

    const response = await handlers.chat({ message: "아까 말한 내용 이어서 설명해줘", requestId: "request-2", sessionId }, requestWithSessionToken(sessionTokenFrom(started)));

    expect(requiredStringField(response, "model")).toBe("gemini-test-model");
  });

  it("records an AI failure event when real chat cannot answer", async () => {
    process.env["GEMINI_API_KEY"] = "";
    process.env["READING_COACH_AI_MODE"] = "real";
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const sessionId = sessionIdFrom(started);

    await expect(handlers.chat({
      message: "양자컴퓨터가 뭐야?",
      requestId: "request-failure",
      sessionId
    }, requestWithSessionToken(sessionTokenFrom(started)))).rejects.toMatchObject({ statusCode: 503 });

    expect(store.storedEvents.at(-1)).toEqual(expect.objectContaining({
      sessionId,
      stage: "reading",
      type: "calibration_chat_failed"
    }));
    expect(store.storedEvents.at(-1)?.payload).toEqual(expect.objectContaining({
      messageLength: 10,
      requestId: "request-failure"
    }));
  });

  it("retries the same chat requestId after a recorded AI failure", async () => {
    process.env["GEMINI_API_KEY"] = "";
    process.env["READING_COACH_AI_MODE"] = "real";
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const sessionId = sessionIdFrom(started);
    const request = requestWithSessionToken(sessionTokenFrom(started));

    await expect(handlers.chat({
      message: "양자컴퓨터가 뭐야?",
      requestId: "request-retry-after-failure",
      sessionId
    }, request)).rejects.toMatchObject({ statusCode: 503 });

    process.env["READING_COACH_AI_MODE"] = "mock";
    const response = await handlers.chat({
      message: "양자컴퓨터가 뭐야?",
      requestId: "request-retry-after-failure",
      sessionId
    }, request);

    expect(requiredStringField(response, "text").length).toBeGreaterThan(0);
    expect(store.storedChatTurns.filter((turn) => turn.requestId === "request-retry-after-failure" && turn.role === "student")).toHaveLength(1);
    expect(store.storedChatTurns.filter((turn) => turn.requestId === "request-retry-after-failure" && turn.role === "assistant")).toHaveLength(1);
  });
});
