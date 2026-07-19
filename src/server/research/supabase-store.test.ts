import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseResearchStore } from "./supabase-store.js";
import type { SessionDelta } from "./store.js";

describe("Supabase research store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps the session delta in the RPC payload parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const input: SessionDelta = {
      artifacts: [],
      chatTurns: [],
      currentStage: "writing",
      events: [],
      measures: [],
      sessionId: "session-rpc-shape",
      status: "in_progress"
    };

    const store = createSupabaseResearchStore({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });
    if (store.syncSessionDelta === undefined) throw new Error("Supabase store must expose session sync.");
    await store.syncSessionDelta(input);

    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("Supabase RPC request was not made.");
    const init = call[1];
    if (init === undefined || typeof init !== "object" || typeof init.body !== "string") throw new Error("Supabase RPC body was not captured.");
    expect(JSON.parse(init.body)).toEqual({ payload: input });
    expect(String(call[0])).toContain("/rest/v1/rpc/sync_research_session");
  });

  it("falls back to direct REST writes when the atomic session sync RPC is missing", async () => {
    const sessionRow = {
      assignment_id: "assignment-guided",
      assignment_snapshot: {},
      class_group_id: "class-guided",
      completed_at: null,
      created_at: "2026-07-05T00:00:00.000Z",
      current_stage: "guided_writing",
      metadata: {},
      research_condition: "single_group_baseline",
      research_locked: false,
      research_mode: "guided_writing",
      session_id: "session-guided",
      status: "in_progress",
      student_anonymous_id: "anon-guided",
      updated_at: "2026-07-05T00:00:00.000Z"
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.includes("/rpc/sync_research_session")) {
        return new Response(JSON.stringify({ message: "Could not find the function public.sync_research_session(payload) in the schema cache" }), { status: 404 });
      }
      if (url.includes("/sessions?session_id=eq.session-guided&limit=1")) return new Response(JSON.stringify([sessionRow]), { status: 200 });
      if (url.includes("/chat_turns") || url.includes("/events") || url.includes("/artifacts") || url.includes("/measures")) {
        return new Response(init?.body?.toString() ?? "[]", { status: 200 });
      }
      if (url.includes("/sessions?session_id=eq.session-guided") && init?.method === "PATCH") {
        return new Response(JSON.stringify([{ ...sessionRow, current_stage: "guided_writing", updated_at: "2026-07-05T00:01:00.000Z" }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const input: SessionDelta = {
      artifacts: [{
        createdAt: "2026-07-05T00:00:01.000Z",
        id: "artifact-guided-step",
        kind: "guided_writing_step",
        payload: { step: "sources", text: "자료 내용" },
        stage: "guided_sources"
      }],
      chatTurns: [{
        id: "chat-guided",
        role: "student",
        text: "이어 쓸 문장을 도와줘",
        timestamp: "2026-07-05T00:00:02.000Z"
      }],
      currentStage: "guided_writing",
      events: [{
        id: "event-guided",
        payload: { step: "sources" },
        stage: "guided_sources",
        timestamp: "2026-07-05T00:00:03.000Z",
        type: "guided_step_saved"
      }],
      measures: [],
      sessionId: "session-guided",
      status: "in_progress"
    };
    const store = createSupabaseResearchStore({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });
    if (store.syncSessionDelta === undefined) throw new Error("Supabase store must expose session sync.");

    await store.syncSessionDelta(input);

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/rest/v1/rpc/sync_research_session"))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/rest/v1/artifacts"))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/rest/v1/chat_turns"))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/rest/v1/events"))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/rest/v1/sessions?session_id=eq.session-guided") && call[1]?.method === "PATCH")).toBe(true);
  });

  it("uses an unlocked-row predicate when directly locking a submitted understanding-calibration session", async () => {
    const sessionRow = {
      assignment_id: "assignment-lock",
      assignment_snapshot: {},
      class_group_id: "class-lock",
      completed_at: null,
      created_at: "2026-07-05T00:00:00.000Z",
      current_stage: "writing",
      metadata: {},
      research_condition: "single_group_baseline",
      research_locked: false,
      research_mode: "understanding_calibration",
      session_id: "session-lock",
      status: "in_progress",
      student_anonymous_id: "anon-lock",
      updated_at: "2026-07-05T00:00:00.000Z"
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (init?.method === "PATCH") return new Response(JSON.stringify([{ ...sessionRow, current_stage: "completed", research_locked: true, status: "submitted" }]), { status: 200 });
      return new Response(JSON.stringify([sessionRow]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = createSupabaseResearchStore({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });

    await store.updateStage({ currentStage: "completed", sessionId: "session-lock", status: "submitted" });

    const patchCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    if (patchCall === undefined) throw new Error("Session lock PATCH was not made.");
    expect(String(patchCall[0])).toContain("research_locked=eq.false");
    if (patchCall[1] === undefined || typeof patchCall[1] !== "object" || typeof patchCall[1].body !== "string") throw new Error("Session lock PATCH body was not captured.");
    expect(JSON.parse(patchCall[1].body)).toMatchObject({ research_locked: true, status: "submitted" });
  });

  it("does not lock a submitted writing-coach session so it can be reopened", async () => {
    const sessionRow = {
      assignment_id: "assignment-writing",
      assignment_snapshot: {},
      class_group_id: "class-writing",
      completed_at: null,
      created_at: "2026-07-05T00:00:00.000Z",
      current_stage: "writing",
      metadata: {},
      research_condition: "single_group_baseline",
      research_locked: false,
      research_mode: "writing_coach",
      session_id: "session-writing",
      status: "in_progress",
      student_anonymous_id: "anon-writing",
      updated_at: "2026-07-05T00:00:00.000Z"
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (init?.method === "PATCH") return new Response(JSON.stringify([{ ...sessionRow, current_stage: "submitted", status: "submitted" }]), { status: 200 });
      return new Response(JSON.stringify([sessionRow]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = createSupabaseResearchStore({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });

    await store.updateStage({ currentStage: "submitted", sessionId: "session-writing", status: "submitted" });

    const patchCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    if (patchCall === undefined) throw new Error("Session PATCH was not made.");
    expect(String(patchCall[0])).not.toContain("research_locked=eq.false");
    if (patchCall[1] === undefined || typeof patchCall[1] !== "object" || typeof patchCall[1].body !== "string") throw new Error("Session PATCH body was not captured.");
    expect(JSON.parse(patchCall[1].body)).toMatchObject({ status: "submitted" });
    expect(JSON.parse(patchCall[1].body)).not.toHaveProperty("research_locked");
  });

  it("does not overwrite the canonical session id when concurrent starts hit the uniqueness conflict", async () => {
    const canonicalRow = {
      assignment_id: "assignment-race",
      assignment_snapshot: { id: "assignment-race", title: "Race" },
      class_group_id: "class-race",
      completed_at: null,
      created_at: "2026-07-05T00:00:00.000Z",
      current_stage: "reading",
      metadata: {},
      research_condition: "single_group_baseline",
      research_locked: false,
      research_mode: "understanding_calibration",
      session_id: "session-canonical",
      status: "in_progress",
      student_anonymous_id: "anon-race",
      updated_at: "2026-07-05T00:00:00.000Z"
    };
    const assignmentRow = {
      id: "assignment-race",
      assignment: { id: "assignment-race", title: "Race", assignedStudentIds: ["student-race"] },
      class_group_id: "class-race",
      created_by_teacher_id: "teacher-race",
      research_condition: "single_group_baseline",
      research_mode: "understanding_calibration"
    };
    const studentRow = {
      class_group_id: "class-race",
      id: "student-race",
      login_id: "student-race",
      participant_code_hash: "hash",
      password_hash: null,
      student_anonymous_id: "anon-race",
      student_number: 1
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.includes("/students?")) return new Response(JSON.stringify([studentRow]), { status: 200 });
      if (url.includes("/assignments?")) {
        expect(url).not.toContain("class_group_id=eq.");
        return new Response(JSON.stringify([assignmentRow]), { status: 200 });
      }
      if (url.includes("/sessions?select=*&assignment_id")) return new Response(JSON.stringify([]), { status: 200 });
      if (init?.method === "POST" && url.includes("/sessions?on_conflict=")) return new Response(JSON.stringify([]), { status: 201 });
      if (url.includes("/sessions?assignment_id=")) return new Response(JSON.stringify([canonicalRow]), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = createSupabaseResearchStore({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });

    const result = await store.startSession({ participantCode: "S001", assignmentId: "assignment-race" });

    expect(result.context.sessionId).toBe("session-canonical");
    const sessionWrites = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST" && String(call[0]).includes("/sessions?on_conflict="));
    expect(sessionWrites).toHaveLength(1);
    expect(JSON.parse(String(sessionWrites[0]?.[1]?.body))).toMatchObject({ session_id: expect.stringMatching(/^session-/) });
  });

  it("starts a session for a student assigned through a different representative class", async () => {
    const assignmentRow = {
      id: "assignment-multi-class",
      assignment: { id: "assignment-multi-class", title: "Multi", assignedStudentIds: ["student-two"] },
      class_group_id: "class-one",
      created_by_teacher_id: "teacher-test",
      research_condition: "single_group_baseline",
      research_mode: "writing_coach"
    };
    const studentRow = {
      class_group_id: "class-two",
      id: "student-two",
      login_id: "student-two",
      participant_code_hash: "hash",
      password_hash: null,
      student_anonymous_id: "anon-two",
      student_number: 2
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.includes("/students?")) return new Response(JSON.stringify([studentRow]), { status: 200 });
      if (url.includes("/assignments?")) return new Response(JSON.stringify([assignmentRow]), { status: 200 });
      if (url.includes("/sessions?select=*&assignment_id")) return new Response(JSON.stringify([]), { status: 200 });
      if (init?.method === "POST" && url.includes("/sessions?on_conflict=")) {
        const body = JSON.parse(String(init.body));
        return new Response(JSON.stringify([{
          ...body,
          completed_at: null,
          created_at: "2026-07-05T00:00:00.000Z",
          research_locked: false,
          updated_at: "2026-07-05T00:00:00.000Z"
        }]), { status: 201 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = createSupabaseResearchStore({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });

    const result = await store.startSession({ participantCode: "S002", assignmentId: "assignment-multi-class" });

    expect(result.context.classGroupId).toBe("class-two");
    const sessionWrites = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST" && String(call[0]).includes("/sessions?on_conflict="));
    expect(JSON.parse(String(sessionWrites[0]?.[1]?.body))).toMatchObject({ class_group_id: "class-two" });
  });

  it("rejects session resume after the student is no longer assigned", async () => {
    const sessionRow = {
      assignment_id: "assignment-unassigned",
      assignment_snapshot: { id: "assignment-unassigned", title: "Old" },
      class_group_id: "class-two",
      completed_at: null,
      created_at: "2026-07-05T00:00:00.000Z",
      current_stage: "reading",
      metadata: {},
      research_condition: "single_group_baseline",
      research_locked: false,
      research_mode: "writing_coach",
      session_id: "session-unassigned",
      status: "in_progress",
      student_anonymous_id: "anon-two",
      updated_at: "2026-07-05T00:00:00.000Z"
    };
    const studentRow = {
      class_group_id: "class-two",
      id: "student-two",
      login_id: "student-two",
      participant_code_hash: "hash",
      password_hash: null,
      student_anonymous_id: "anon-two",
      student_number: 2
    };
    const assignmentRow = {
      id: "assignment-unassigned",
      assignment: { id: "assignment-unassigned", title: "Old", assignedStudentIds: [] },
      class_group_id: "class-one",
      created_by_teacher_id: "teacher-test",
      research_condition: "single_group_baseline",
      research_mode: "writing_coach"
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes("/sessions?session_id=eq.session-unassigned")) return new Response(JSON.stringify([sessionRow]), { status: 200 });
      if (url.includes("/students?student_anonymous_id=eq.anon-two")) return new Response(JSON.stringify([studentRow]), { status: 200 });
      if (url.includes("/assignments?id=eq.assignment-unassigned")) return new Response(JSON.stringify([assignmentRow]), { status: 200 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = createSupabaseResearchStore({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });

    await expect(store.resumeSession("session-unassigned")).rejects.toMatchObject({ statusCode: 403 });
  });
});
