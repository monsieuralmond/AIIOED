import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    process.env["AI_PROVIDER"] = "openai";
    process.env["OPENAI_MODEL"] = "gpt-5-nano";
    process.env["MAX_CHAT_TURNS_PER_MINUTE"] = "6";
    process.env["READING_COACH_AI_MODE"] = "mock";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    vi.stubGlobal("fetch", vi.fn(async (): Promise<Response> => new Response(JSON.stringify({ allowed: true }), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("uses the chat-only session loader for chat requests", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const request = requestWithSessionToken(sessionTokenFrom(started));
    const sessionId = sessionIdFrom(started);

    await handlers.chat({ message: "양자컴퓨터가 뭐야?", requestId: "request-chat-session-loader", sessionId }, request);

    expect(store.resumeSessionForChatCount).toBe(1);
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

  it("allows rapid distinct chat requests in classroom research sessions", async () => {
    process.env["MAX_CHAT_TURNS_PER_MINUTE"] = "1";
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const request = requestWithSessionToken(sessionTokenFrom(started));
    const sessionId = sessionIdFrom(started);

    await handlers.chat({ message: "첫 질문", requestId: "request-rate-1", sessionId }, request);
    const response = await handlers.chat({
      message: "둘째 질문",
      requestId: "request-rate-2",
      sessionId
    }, request);

    expect(requiredStringField(response, "text").length).toBeGreaterThan(0);
    expect(store.storedChatTurns.filter((turn) => turn.role === "student")).toHaveLength(2);
  });

  it("allows separate students to chat concurrently after the advisory chat time passes", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const participants = Array.from({ length: 20 }, (_, index) => `S${(index + 1).toString().padStart(3, "0")}`);
    const starts = await Promise.all(participants.map(async (participantCode) => {
      const started = await handlers.sessionStart({ participantCode }, emptyRequest());
      const sessionId = sessionIdFrom(started);
      const session = store.sessions.get(sessionId);
      if (session === undefined) throw new Error("started session was not stored.");
      store.sessions.set(sessionId, {
        ...session,
        assignment: {
          ...session.assignment,
          calibrationConfig: {
            maxChatMinutes: 1
          }
        },
        createdAt: "2026-07-05T00:00:00.000Z"
      });
      return {
        request: requestWithSessionToken(sessionTokenFrom(started)),
        sessionId
      };
    }));

    const responses = await Promise.all(starts.map(async (started, index) =>
      handlers.chat({
        message: "양자컴퓨터가 뭐야?",
        requestId: `request-concurrent-${index}`,
        sessionId: started.sessionId
      }, started.request)
    ));

    expect(responses).toHaveLength(20);
    expect(store.storedChatTurns.filter((turn) => turn.role === "student")).toHaveLength(20);
    expect(store.storedChatTurns.filter((turn) => turn.role === "assistant")).toHaveLength(20);
  });

  it("does not reserve shared AI quota for classroom chat requests", async () => {
    process.env["OPENAI_API_KEY"] = "";
    process.env["READING_COACH_AI_MODE"] = "real";
    const fetchMock = vi.fn(async (): Promise<Response> => new Response(JSON.stringify({ allowed: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());

    await expect(handlers.chat({
      message: "질문",
      requestId: "quota-rejected",
      sessionId: sessionIdFrom(started)
    }, requestWithSessionToken(sessionTokenFrom(started)))).rejects.toMatchObject({ statusCode: 503 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.storedChatTurns.filter((turn) => turn.role === "student")).toHaveLength(1);
    expect(store.storedEvents.at(-1)).toEqual(expect.objectContaining({ type: "calibration_chat_failed" }));
  });

  it("reports the configured OpenAI model for duplicate real chat requestIds", async () => {
    process.env["OPENAI_MODEL"] = "gpt-5-nano-test";
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

    expect(requiredStringField(response, "model")).toBe("gpt-5-nano-test");
  });

  it("records an AI failure event when real chat cannot answer", async () => {
    process.env["OPENAI_API_KEY"] = "";
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
    process.env["OPENAI_API_KEY"] = "";
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
