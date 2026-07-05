import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAssignment } from "../../shared/fixtures.js";
import { ResearchConditions, ResearchModes } from "../../shared/research.js";
import { loadRoster, upsertRoster } from "./roster-handlers.js";

type RecordedFetch = {
  readonly body: unknown;
  readonly method: string;
  readonly table: string;
  readonly url: string;
};

const request = (): IncomingMessage => new IncomingMessage(new Socket());

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const tableFromUrl = (url: string): string => {
  const pathname = new URL(url).pathname;
  return pathname.split("/").filter((part) => part.length > 0).at(-1) ?? "";
};

const parsedBody = (init?: RequestInit): unknown => {
  if (typeof init?.body !== "string") return undefined;
  const parsed: unknown = JSON.parse(init.body);
  return parsed;
};

describe("roster handlers", () => {
  beforeEach(() => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps an unassigned assignment in the canonical roster table", async () => {
    const calls: RecordedFetch[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      calls.push({ body: parsedBody(init), method, table, url });
      if (method === "GET" && table === "classes") return new Response(JSON.stringify([{ id: "class-pilot" }]), { status: 200 });
      if (method === "POST" && table === "exports") return new Response(JSON.stringify([{ id: "export-roster" }]), { status: 200 });
      if (method === "GET" && table === "classes") {
        return new Response(JSON.stringify([
          { id: "class-old", teacher_id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" },
          { id: "class-pilot", teacher_id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "assignments") {
        return new Response(JSON.stringify([
          { id: "assignment-old", created_by_teacher_id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([
          { id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await upsertRoster({
      assignments: [{
        createdByTeacherId: "teacher-research",
        id: sampleAssignment.id,
        payload: { ...sampleAssignment, classGroupId: undefined },
        researchCondition: ResearchConditions.singleGroupBaseline,
        researchMode: ResearchModes.writingCoach,
        title: sampleAssignment.title
      }],
      classes: [],
      students: [],
      teacherId: "teacher-research"
    }, request());

    expect(calls.some((call) => call.method === "POST" && call.table === "exports")).toBe(true);
    const assignmentUpsert = calls.find((call) => call.method === "POST" && call.table === "assignments");
    expect(assignmentUpsert?.body).toEqual([expect.objectContaining({
      class_group_id: null,
      id: sampleAssignment.id
    })]);
  });

  it("stores sanitized roster snapshots and deletes only explicitly requested rows", async () => {
    const calls: RecordedFetch[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      calls.push({ body: parsedBody(init), method, table, url });
      if (method === "POST" && table === "exports") return new Response(JSON.stringify([{ id: "export-roster" }]), { status: 200 });
      if (method === "GET" && table === "classes") {
        return new Response(JSON.stringify([
          { id: "class-old", teacher_id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" },
          { id: "class-pilot", teacher_id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "assignments") {
        return new Response(JSON.stringify([
          { id: "assignment-old", created_by_teacher_id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([
          { id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await upsertRoster({
      assignments: [],
      classes: [],
      deletedAssignmentIds: ["assignment-old"],
      deletedClassIds: ["class-old"],
      deletedStudentIds: ["student-old"],
      deletedTeacherIds: ["teacher-research"],
      students: [{
        classGroupId: "class-pilot",
        displayLabel: "민서",
        id: "student-s001",
        loginId: "s001",
        participantCode: "S001",
        password: "pw001",
        studentAnonymousId: "anon-class-pilot-001",
        studentNumber: 1
      }],
      teacherId: "teacher-research",
      teachers: [{
        displayName: "연구 교사",
        id: "teacher-research",
        loginId: "teacher",
        password: "teacher-pw"
      }]
    }, request());

    const exportCall = calls.find((call) => call.method === "POST" && call.table === "exports");
    if (exportCall === undefined || !isRecord(exportCall.body)) throw new Error("export snapshot was not stored.");
    const snapshot = exportCall.body["payload"];
    expect(JSON.stringify(snapshot)).not.toContain("pw001");
    expect(JSON.stringify(snapshot)).not.toContain("S001");
    const studentUpsert = calls.find((call) => call.method === "POST" && call.table === "students");
    expect(studentUpsert?.body).toEqual([expect.objectContaining({
      id: "student-s001",
      initial_participant_code: "S001",
      initial_password: "pw001",
      password_hash: expect.any(String)
    })]);
    const teacherUpsert = calls.find((call) => call.method === "POST" && call.table === "teachers");
    expect(teacherUpsert?.body).toEqual([expect.objectContaining({
      id: "teacher-research",
      initial_password: "teacher-pw",
      password_hash: expect.any(String)
    })]);
    const deleteCalls = calls.filter((call) => call.method === "DELETE");
    expect(deleteCalls.map((call) => call.table).sort()).toEqual(["assignments", "classes", "students", "students", "teachers"]);
    expect(deleteCalls.some((call) => call.table === "students" && call.url.includes("id=in.(student-old)"))).toBe(true);
    expect(deleteCalls.some((call) => call.table === "students" && call.url.includes("class_group_id=in.(class-old)"))).toBe(true);
  });

  it("allows the active teacher to create another teacher account", async () => {
    const calls: RecordedFetch[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      calls.push({ body: parsedBody(init), method, table, url });
      if (method === "POST" && table === "exports") return new Response(JSON.stringify([{ id: "export-roster" }]), { status: 200 });
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([
          { id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await upsertRoster({
      assignments: [],
      classes: [],
      students: [],
      teacherId: "teacher-research",
      teachers: [
        {
          displayName: "연구 교사",
          id: "teacher-research",
          loginId: "teacher",
          password: "teacher-pw"
        },
        {
          displayName: "보조 교사",
          id: "teacher-helper",
          loginId: "helper",
          password: "helper-pw"
        }
      ]
    }, request());

    const teacherUpsert = calls.find((call) => call.method === "POST" && call.table === "teachers");
    expect(teacherUpsert?.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "teacher-helper",
        initial_password: "helper-pw",
        login_id: "helper",
        password_hash: expect.any(String)
      })
    ]));
  });

  it("loads the current roster tables instead of resurrecting a stale roster snapshot", async () => {
    const calls: RecordedFetch[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      calls.push({ body: parsedBody(init), method, table, url });
      if (method === "GET" && table === "exports") {
        return new Response(JSON.stringify([{
          payload: {
            assignments: [{
              createdByTeacherId: "teacher-research",
              id: sampleAssignment.id,
              payload: sampleAssignment,
              researchCondition: ResearchConditions.singleGroupBaseline,
              researchMode: ResearchModes.writingCoach,
              title: sampleAssignment.title
            }],
            classes: [],
            students: []
          }
        }]), { status: 200 });
      }
      if (method === "GET" && (table === "classes" || table === "assignments" || table === "students")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const roster = await loadRoster({}, request());

    expect(roster).toEqual({
      assignments: [],
      classes: [],
      deletedAssignmentIds: [],
      deletedClassIds: [],
      deletedStudentIds: [],
      deletedTeacherIds: [],
      students: [],
      teachers: []
    });
    expect(calls.some((call) => call.method === "GET" && call.table === "exports")).toBe(false);
  });

});
