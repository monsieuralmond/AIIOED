import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAssignment } from "../../shared/fixtures.js";
import { ResearchConditions, ResearchModes } from "../../shared/research.js";
import { issueAdminToken, issueTeacherToken } from "./auth.js";
import { loadRoster, upsertRoster } from "./roster-handlers.js";

type RecordedFetch = {
  readonly body: unknown;
  readonly method: string;
  readonly table: string;
  readonly url: string;
};

const requestWithHeaders = (headers: Record<string, string>): IncomingMessage => {
  const request = new IncomingMessage(new Socket());
  request.headers = headers;
  return request;
};

const adminRequest = (): IncomingMessage => requestWithHeaders({
  "x-research-admin-id": "admin-root",
  "x-research-admin-token": issueAdminToken("admin-root")
});

const teacherRequest = (teacherId: string): IncomingMessage => requestWithHeaders({
  "x-research-teacher-id": teacherId,
  "x-research-teacher-token": issueTeacherToken(teacherId)
});

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

const rosterMutationPayload = (calls: readonly RecordedFetch[]): Record<string, unknown> => {
  const rpcCall = calls.find((call) => call.method === "POST" && call.table === "apply_roster_mutation");
  if (rpcCall === undefined || !isRecord(rpcCall.body) || !isRecord(rpcCall.body["payload"])) throw new Error("roster mutation payload was not sent.");
  return rpcCall.body["payload"];
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
    }, teacherRequest("teacher-research"));

    const mutation = rosterMutationPayload(calls);
    expect(mutation["assignments"]).toEqual([expect.objectContaining({
      class_group_id: null,
      id: sampleAssignment.id
    })]);
    expect(mutation["snapshot"]).toEqual(expect.objectContaining({
      export_kind: "app_roster_snapshot",
      payload: expect.objectContaining({ assignments: expect.any(Array) })
    }));
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
    }, adminRequest());

    const mutation = rosterMutationPayload(calls);
    const snapshot = isRecord(mutation["snapshot"]) ? mutation["snapshot"]["payload"] : undefined;
    expect(JSON.stringify(snapshot)).not.toContain("pw001");
    expect(JSON.stringify(snapshot)).not.toContain("S001");
    expect(mutation["studentsWithPasswords"]).toEqual([expect.objectContaining({
      id: "student-s001",
      initial_participant_code: "S001",
      password_hash: expect.any(String)
    })]);
    expect(mutation["teachersWithPasswords"]).toEqual([expect.objectContaining({
      id: "teacher-research",
      password_hash: expect.any(String)
    })]);
    expect(JSON.stringify(mutation)).not.toContain("initial_password");
    expect(mutation).toEqual(expect.objectContaining({
      deletedAssignmentIds: ["assignment-old"],
      deletedClassIds: ["class-old"],
      deletedStudentIds: ["student-old"],
      deletedTeacherIds: ["teacher-research"]
    }));
  });

  it("rejects the active teacher creating another teacher account", async () => {
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

    await expect(upsertRoster({
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
    }, teacherRequest("teacher-research"))).rejects.toMatchObject({ statusCode: 403 });

    expect(calls.some((call) => call.method === "POST" && call.table === "teachers")).toBe(false);
  });

  it("allows the admin to create another teacher account", async () => {
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
    }, adminRequest());

    const mutation = rosterMutationPayload(calls);
    expect(mutation["teachersWithPasswords"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "teacher-helper",
        login_id: "helper",
        password_hash: expect.any(String)
      })
    ]));
    expect(JSON.stringify(mutation)).not.toContain("helper-pw");
  });

  it("allows a teacher to change only their own password", async () => {
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
          password: "changed-pw"
        }
      ]
    }, teacherRequest("teacher-research"));

    const mutation = rosterMutationPayload(calls);
    expect(mutation["teachersWithPasswords"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "teacher-research",
        login_id: "teacher",
        password_hash: expect.any(String)
      })
    ]));
    expect(JSON.stringify(mutation)).not.toContain("changed-pw");
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

    const roster = await loadRoster({}, adminRequest());

    expect(roster).toEqual(expect.objectContaining({
      assignments: [],
      classes: [],
      deletedAssignmentIds: [],
      deletedClassIds: [],
      deletedStudentIds: [],
      deletedTeacherIds: [],
      students: [],
      teachers: []
    }));
    if (!isRecord(roster)) throw new Error("loaded roster is invalid.");
    expect(typeof roster["rosterRevision"]).toBe("string");
    expect(calls.some((call) => call.method === "GET" && call.table === "exports")).toBe(false);
  });

});
