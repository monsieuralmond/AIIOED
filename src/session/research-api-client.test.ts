import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialPilotState, createSession, deleteClassGroup } from "./session.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import { ResearchConditions, ResearchModes } from "../shared/research.js";
import type { ChatTurn, PilotEvent } from "../shared/types.js";
import { authenticateStudentWithDatabase, loadRosterFromDatabase, requestSessionCalibrationChat, startResearchSessionWithParticipantCode, syncRosterToDatabase, syncSessionDelta } from "./research-api-client.js";
import { clearBrowserSessionToken, clearBrowserTeacherAuth, saveBrowserSessionToken, saveBrowserTeacherAuth } from "./browser-session.js";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const parsePostedBody = (body: string | null): Record<string, unknown> => {
  if (body === null) throw new Error("fetch body was not captured.");
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) throw new Error("fetch body was not a JSON object.");
  return parsed;
};

const firstRequestInit = (fetchMock: ReturnType<typeof vi.fn>): RequestInit => {
  const call = fetchMock.mock.calls[0];
  if (call === undefined) throw new Error("fetch was not called.");
  const init = call[1];
  if (init === undefined || typeof init !== "object") throw new Error("fetch init was not captured.");
  return init as RequestInit;
};

const headerValue = (init: RequestInit, key: string): string | null => {
  const headers = init.headers;
  if (headers instanceof Headers) return headers.get(key);
  if (Array.isArray(headers)) {
    const found = headers.find(([name]) => name.toLowerCase() === key.toLowerCase());
    return found?.[1] ?? null;
  }
  if (headers !== undefined && typeof headers === "object") {
    const record = headers as Readonly<Record<string, string>>;
    return record[key] ?? record[key.toLowerCase()] ?? null;
  }
  return null;
};

describe("research API client", () => {
  afterEach(() => {
    clearBrowserSessionToken();
    clearBrowserTeacherAuth();
    vi.unstubAllGlobals();
  });

  it("sends local preview sessions directly to preview calibration chat", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        llmMode: "mock",
        model: "mock-understanding-calibration-v0",
        requestTags: ["other"],
        text: "지문 내용을 기준으로 다시 설명할게요.",
        type: "clarify"
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await requestSessionCalibrationChat({
      message: "방금 말한 내용을 이어서 설명해줘",
      previewRequest: {
        history: [{ role: "assistant", text: "앞에서는 양자컴퓨터의 기본 개념을 설명했어요." }],
        message: "방금 말한 내용을 이어서 설명해줘",
        passage: "양자컴퓨터는 양자 상태를 활용한다.",
        researchCondition: ResearchConditions.singleGroupBaseline,
        topic: "양자컴퓨터"
      },
      requestId: "chat-request-1",
      sessionId: "session-local-preview"
    });

    expect(response.text).toBe("지문 내용을 기준으로 다시 설명할게요.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/ai", expect.objectContaining({ method: "POST" }));
  });

  it("uses the session chat API for server-backed sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      llmMode: "mock",
      model: "mock-understanding-calibration-v0",
      requestTags: ["other"],
      text: "서버 세션 응답입니다.",
      type: "clarify"
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await requestSessionCalibrationChat({
      message: "핵심을 설명해줘",
      requestId: "chat-request-2",
      sessionId: "session-server"
    });

    expect(response.text).toBe("서버 세션 응답입니다.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/chat", expect.objectContaining({ method: "POST" }));
  });

  it("attaches the stored session token to server-backed session writes", async () => {
    saveBrowserSessionToken("session-token-test");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      llmMode: "mock",
      model: "mock-understanding-calibration-v0",
      requestTags: ["other"],
      text: "토큰이 있는 서버 세션 응답입니다.",
      type: "clarify"
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestSessionCalibrationChat({
      message: "핵심을 설명해줘",
      requestId: "chat-request-with-token",
      sessionId: "session-server"
    });

    expect(headerValue(firstRequestInit(fetchMock), "x-research-session-token")).toBe("session-token-test");
  });

  it("derives the assignment id from session start responses that omit assignmentId", async () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("sample student fixture is missing.");
    const assignment = { ...sampleAssignment, id: "assignment-from-session" };
    const session = createSession(assignment, student);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      assignment,
      classGroupId: student.classGroupId,
      session,
      sessionId: session.sessionId,
      studentAnonymousId: session.student.anonymousId
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await startResearchSessionWithParticipantCode("S001");

    expect(response.assignmentId).toBe("assignment-from-session");
    expect(response.session.sessionId).toBe(session.sessionId);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/session/start", expect.objectContaining({ method: "POST" }));
  });

  it("authenticates a student account before starting an assignment session", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      assignments: [{ ...sampleAssignment, id: "assignment-login", title: "로그인 뒤 보이는 과제" }],
      student: {
        classGroupId: "class-pilot",
        displayName: "김민서",
        id: "student-login",
        loginId: "1",
        participantCode: "1",
        studentNumber: 1
      }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await authenticateStudentWithDatabase({ loginId: "1", participantCode: "1", password: "1" });

    expect(response.student.password).toBe("1");
    expect(response.assignments[0]?.id).toBe("assignment-login");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/student", expect.objectContaining({ method: "POST" }));
  });

  it("loads persisted roster snapshots into assignments, classes, and student accounts", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      assignments: [{
        classGroupId: "class-restored",
        createdByTeacherId: "teacher-restored",
        id: sampleAssignment.id,
        payload: { ...sampleAssignment, classGroupId: "class-restored", title: "복원된 과제" },
        researchCondition: ResearchConditions.singleGroupBaseline,
        researchMode: "understanding_calibration",
        title: "복원된 과제"
      }],
      classes: [{
        id: "class-restored",
        name: "복원 반",
        teacherId: "teacher-restored"
      }],
      students: [{
        classGroupId: "class-restored",
        displayLabel: "복원 학생",
        id: "student-s031",
        loginId: "s031",
        participantCode: "S031",
        password: "pw-031",
        studentAnonymousId: "anon-class-restored-031",
        studentNumber: 31
      }]
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const roster = await loadRosterFromDatabase();

    expect(roster.assignments[0]?.title).toBe("복원된 과제");
    expect(roster.classGroups[0]?.studentIds).toEqual(["student-s031"]);
    expect(roster.students[0]?.password).toBe("pw-031");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/roster", expect.objectContaining({ method: "POST" }));
  });

  it("attaches teacher auth headers to teacher roster reads", async () => {
    saveBrowserTeacherAuth({ teacherId: "teacher-token-owner", teacherToken: "teacher-token-test" });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      assignments: [],
      classes: [],
      students: [],
      teachers: []
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await loadRosterFromDatabase("teacher-token-owner");

    const init = firstRequestInit(fetchMock);
    expect(headerValue(init, "x-research-teacher-id")).toBe("teacher-token-owner");
    expect(headerValue(init, "x-research-teacher-token")).toBe("teacher-token-test");
  });

  it("keeps an assignment unassigned when syncing a roster after deleting its class", async () => {
    let postedBody: string | null = null;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      postedBody = typeof init?.body === "string" ? init.body : null;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const stateAfterDelete = deleteClassGroup(createInitialPilotState(), "class-pilot");

    await syncRosterToDatabase(stateAfterDelete);

    const body = parsePostedBody(postedBody);
    const assignments = body["assignments"];
    if (!Array.isArray(assignments) || !isRecord(assignments[0])) throw new Error("synced assignments payload is invalid.");
    expect(assignments[0]).not.toHaveProperty("classGroupId");
    expect(body["classes"]).toEqual([]);
    expect(body["students"]).toEqual([]);
    expect(body["teacherId"]).toBe("teacher-research");
  });

  it("omits blank roster passwords when syncing existing database accounts", async () => {
    let postedBody: string | null = null;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      postedBody = typeof init?.body === "string" ? init.body : null;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const baseState = createInitialPilotState();
    const stateWithBlankCredentials = {
      ...baseState,
      students: baseState.students.map((student) => ({ ...student, password: "" })),
      teachers: baseState.teachers.map((teacher) => ({ ...teacher, password: "" }))
    };

    await syncRosterToDatabase(stateWithBlankCredentials);

    const body = parsePostedBody(postedBody);
    const students = body["students"];
    const teachers = body["teachers"];
    if (!Array.isArray(students) || !isRecord(students[0])) throw new Error("synced students payload is invalid.");
    if (!Array.isArray(teachers) || !isRecord(teachers[0])) throw new Error("synced teachers payload is invalid.");
    expect(students[0]).not.toHaveProperty("password");
    expect(teachers[0]).not.toHaveProperty("password");
  });

  it("treats empty successful API responses as successful writes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(syncRosterToDatabase(createInitialPilotState())).resolves.toEqual({});
  });

  it("syncs session delta records by id and persists local writing chat turns", async () => {
    const posted: Array<{ readonly body: Record<string, unknown>; readonly path: string }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      posted.push({
        body: parsePostedBody(typeof init?.body === "string" ? init.body : null),
        path: typeof input === "string" ? input : input.toString()
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("sample student fixture is missing.");
    const session = createSession({ ...sampleAssignment, researchMode: ResearchModes.guidedWriting }, student);
    const alreadySeenEvent: PilotEvent = {
      id: "event-already-seen",
      payload: {},
      stage: session.currentStage,
      timestamp: "2026-07-05T00:00:00.000Z",
      type: "stage_entered"
    };
    const newEvent: PilotEvent = {
      id: "event-new",
      payload: { value: 1 },
      stage: session.currentStage,
      timestamp: "2026-07-05T00:01:00.000Z",
      type: "stage_completed"
    };
    const newChatTurn: ChatTurn = {
      id: "chat-local-student",
      role: "student",
      text: "서론을 어떻게 시작할까요?",
      timestamp: "2026-07-05T00:02:00.000Z"
    };
    const previous = { ...session, events: [alreadySeenEvent], chatTurns: [] };
    const next = {
      ...session,
      chatTurns: [newChatTurn],
      events: [newEvent]
    };

    await syncSessionDelta(previous, next);

    expect(posted.map((item) => item.path)).toEqual(["/api/chat-turn", "/api/event"]);
    expect(posted[0]?.body["id"]).toBe("chat-local-student");
    expect(posted[0]?.body["sessionId"]).toBe(session.sessionId);
    expect(posted[1]?.body["id"]).toBe("event-new");
  });
});
