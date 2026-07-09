import { beforeEach, describe, expect, it } from "vitest";
import { createResearchApiHandlers } from "./handlers.js";
import {
  emptyRequest,
  isRecord,
  MemoryResearchStore,
  requestWithAdminToken,
  requestWithSessionToken,
  requestWithTeacherToken,
  sessionIdFrom,
  sessionTokenFrom
} from "./handlers-test-utils.js";

describe("research API handlers", () => {
  beforeEach(() => {
    process.env["AI_PROVIDER"] = "openai";
    process.env["OPENAI_MODEL"] = "gpt-5-nano";
    process.env["READING_COACH_AI_MODE"] = "mock";
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

  it("returns the existing in-progress session when a student starts the same assignment again", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const first = await handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, emptyRequest());

    const second = await handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, emptyRequest());

    expect(sessionIdFrom(second)).toBe(sessionIdFrom(first));
  });

  it("starts the explicitly selected assignment for student credentials without a participant code", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);

    const response = await handlers.sessionStart({
      assignmentId: "assignment-selected",
      loginId: "student-login",
      password: "student-password"
    }, emptyRequest());

    if (!isRecord(response) || !isRecord(response["assignment"])) throw new Error("session start response did not include an assignment.");
    expect(response["assignment"]["id"]).toBe("assignment-selected");
    expect(store.startedSessions.at(-1)).toMatchObject({
      assignmentId: "assignment-selected",
      loginId: "student-login",
      password: "student-password"
    });
  });

  it("rejects restarting an assignment after the same participant has submitted it", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, emptyRequest());

    await handlers.updateStage({
      completedAt: "2026-07-08T00:00:00.000Z",
      currentStage: "submitted",
      sessionId: sessionIdFrom(started),
      status: "submitted"
    }, requestWithSessionToken(sessionTokenFrom(started)));

    await expect(handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, emptyRequest())).rejects.toMatchObject({
      statusCode: 409
    });
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

  it("allows admins to list all sessions without a teacher filter", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());

    const response = await handlers.sessionList({}, requestWithAdminToken());

    if (!isRecord(response) || !Array.isArray(response["sessions"])) throw new Error("session list response is invalid.");
    expect(response["sessions"]).toHaveLength(1);
    expect(store.listSessionRequests.at(-1)).toEqual({});
  });

  it("lets teachers reset one student session and removes its saved research data", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, emptyRequest());
    const sessionId = sessionIdFrom(started);
    const sessionToken = sessionTokenFrom(started);

    await handlers.chatTurn({
      id: "chat-before-reset",
      role: "student",
      sessionId,
      stage: "guided_writing",
      text: "리셋 전에 저장된 질문",
      timestamp: "2026-07-05T00:00:00.000Z"
    }, requestWithSessionToken(sessionToken));
    await handlers.event({
      id: "event-before-reset",
      payload: { value: "event" },
      sessionId,
      stage: "guided_writing",
      timestamp: "2026-07-05T00:00:00.000Z",
      type: "student_message"
    }, requestWithSessionToken(sessionToken));
    await handlers.artifact({
      id: "artifact-before-reset",
      kind: "draft_snapshot",
      payload: { text: "draft" },
      sessionId,
      stage: "guided_writing",
      timestamp: "2026-07-05T00:00:00.000Z"
    }, requestWithSessionToken(sessionToken));
    await handlers.measure({
      id: "measure-before-reset",
      kind: "confidence",
      payload: { value: 4 },
      sessionId,
      stage: "guided_writing",
      timestamp: "2026-07-05T00:00:00.000Z"
    }, requestWithSessionToken(sessionToken));
    await handlers.updateStage({
      completedAt: "2026-07-08T00:00:00.000Z",
      currentStage: "submitted",
      sessionId,
      status: "submitted"
    }, requestWithSessionToken(sessionToken));

    await handlers.sessionReset({ sessionId }, requestWithTeacherToken("teacher-research"));

    expect(store.sessions.has(sessionId)).toBe(false);
    expect(store.storedChatTurns).toHaveLength(0);
    expect(store.storedEvents).toHaveLength(0);
    expect(store.storedArtifacts).toHaveLength(0);
    expect(store.storedMeasures).toHaveLength(0);
    expect(store.resetRequests.at(-1)).toEqual({ sessionId, teacherId: "teacher-research" });
    await expect(handlers.sessionStart({ assignmentId: "assignment-selected", participantCode: "S001" }, emptyRequest())).resolves.toEqual(expect.objectContaining({
      studentAnonymousId: "anon-S001"
    }));
  });

  it("requires a teacher token before resetting a student session", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, emptyRequest());

    await expect(handlers.sessionReset({ sessionId: sessionIdFrom(started) }, emptyRequest())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("restricts database export and test-data deletion to admins", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);

    await expect(handlers.exportData({ anonymized: true, completedOnly: true }, requestWithTeacherToken("teacher-research"))).rejects.toMatchObject({ statusCode: 401 });
    await expect(handlers.deleteTestData({ confirmExported: true, scope: "all_test_data" }, requestWithTeacherToken("teacher-research"))).rejects.toMatchObject({ statusCode: 401 });

    await handlers.exportData({ anonymized: true, completedOnly: true }, requestWithAdminToken());
    await handlers.deleteTestData({ confirmExported: true, scope: "all_test_data" }, requestWithAdminToken());

    expect(store.exportRequests).toHaveLength(1);
    expect(store.deleteRequests).toHaveLength(1);
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
