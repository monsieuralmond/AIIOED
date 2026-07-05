import { beforeEach, describe, expect, it } from "vitest";
import { createResearchApiHandlers } from "./handlers.js";
import {
  emptyRequest,
  isRecord,
  MemoryResearchStore,
  requestWithSessionToken,
  requestWithTeacherToken,
  sessionIdFrom,
  sessionTokenFrom
} from "./handlers-test-utils.js";

describe("research API handlers", () => {
  beforeEach(() => {
    process.env["READING_COACH_AI_MODE"] = "mock";
    process.env["GEMINI_MODEL"] = "gemini-2.5-flash-lite";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  it("creates isolated sessions for 30 participant codes", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const results = await Promise.all(Array.from({ length: 30 }, (_, index) => handlers.sessionStart({ participantCode: `S${String(index + 1).padStart(3, "0")}` }, emptyRequest())));
    const sessionIds = results.map(sessionIdFrom);
    const studentIds = results.map((result) => {
      if (!isRecord(result) || typeof result["studentAnonymousId"] !== "string") throw new Error("student id missing.");
      return result["studentAnonymousId"];
    });

    expect(new Set(sessionIds).size).toBe(30);
    expect(new Set(studentIds).size).toBe(30);
  });

  it("starts the explicitly selected assignment for a participant code", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);

    const response = await handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, emptyRequest());

    if (!isRecord(response) || !isRecord(response["assignment"])) throw new Error("session start response did not include an assignment.");
    expect(response["assignment"]["id"]).toBe("assignment-selected");
    expect(sessionIdFrom(response)).toMatch(/^session-/);
  });

  it("passes teacher identity when a teacher starts a student preview session", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);

    await handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, requestWithTeacherToken("teacher-research"));

    expect(store.startedSessions.at(-1)).toMatchObject({
      assignmentId: "assignment-selected",
      participantCode: "S001",
      teacherId: "teacher-research"
    });
  });

  it("keeps chat, events, artifacts, and measures separated across 30 concurrent sessions", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await Promise.all(Array.from({ length: 30 }, (_, index) => handlers.sessionStart({ participantCode: `S${String(index + 1).padStart(3, "0")}` }, emptyRequest())));
    const sessionIds = started.map(sessionIdFrom);

    await Promise.all(sessionIds.map((sessionId, index) => Promise.all([
      handlers.chatTurn({
        id: `chat-${index + 1}`,
        role: "student",
        sessionId,
        stage: "guided_writing",
        text: `학생 ${index + 1} 질문`,
        timestamp: "2026-07-05T00:00:00.000Z"
      }, requestWithSessionToken(sessionTokenFrom(started[index]))),
      handlers.event({
        id: `event-${index + 1}`,
        payload: { studentIndex: index + 1 },
        sessionId,
        stage: "guided_writing",
        timestamp: "2026-07-05T00:00:00.000Z",
        type: "student_message"
      }, requestWithSessionToken(sessionTokenFrom(started[index]))),
      handlers.artifact({
        id: `artifact-${index + 1}`,
        kind: "draft_snapshot",
        payload: { studentIndex: index + 1 },
        sessionId,
        stage: "guided_writing",
        timestamp: "2026-07-05T00:00:00.000Z"
      }, requestWithSessionToken(sessionTokenFrom(started[index]))),
      handlers.measure({
        id: `measure-${index + 1}`,
        kind: "confidence",
        payload: { studentIndex: index + 1 },
        sessionId,
        stage: "guided_writing",
        timestamp: "2026-07-05T00:00:00.000Z"
      }, requestWithSessionToken(sessionTokenFrom(started[index])))
    ])));

    expect(store.storedChatTurns).toHaveLength(30);
    expect(store.storedEvents).toHaveLength(30);
    expect(store.storedArtifacts).toHaveLength(30);
    expect(store.storedMeasures).toHaveLength(30);
    sessionIds.forEach((sessionId, index) => {
      expect(store.storedChatTurns.find((turn) => turn.id === `chat-${index + 1}`)?.sessionId).toBe(sessionId);
      expect(store.storedEvents.find((event) => event.id === `event-${index + 1}`)?.sessionId).toBe(sessionId);
      expect(store.storedArtifacts.find((artifact) => artifact.id === `artifact-${index + 1}`)?.sessionId).toBe(sessionId);
      expect(store.storedMeasures.find((measure) => measure.id === `measure-${index + 1}`)?.sessionId).toBe(sessionId);
    });
  });

  it("rejects session writes when the session token is missing", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const sessionId = sessionIdFrom(started);

    await expect(handlers.chatTurn({
      id: "chat-without-token",
      role: "student",
      sessionId,
      stage: "writing",
      text: "토큰 없이 저장하면 안 됩니다.",
      timestamp: "2026-07-05T00:00:00.000Z"
    }, emptyRequest())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("requires a teacher token before listing sessions", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());

    await expect(handlers.sessionList({ teacherId: "teacher-research" }, emptyRequest())).rejects.toMatchObject({ statusCode: 401 });

    const response = await handlers.sessionList({ teacherId: "teacher-research" }, requestWithTeacherToken("teacher-research"));
    if (!isRecord(response) || !Array.isArray(response["sessions"])) throw new Error("session list response is invalid.");
    expect(response["sessions"]).toHaveLength(1);
  });

  it("persists client-created chat turns through the chat-turn handler", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());
    const sessionId = sessionIdFrom(started);

    await handlers.chatTurn({
      id: "chat-local-1",
      role: "student",
      sessionId,
      stage: "writing",
      text: "서론을 어떻게 시작할지 질문했습니다.",
      timestamp: "2026-07-05T00:00:00.000Z"
    }, requestWithSessionToken(sessionTokenFrom(started)));

    expect(store.storedChatTurns.at(-1)).toMatchObject({
      id: "chat-local-1",
      role: "student",
      sessionId,
      stage: "writing",
      text: "서론을 어떻게 시작할지 질문했습니다."
    });
  });

});
