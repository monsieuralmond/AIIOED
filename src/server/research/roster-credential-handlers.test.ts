import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueAdminToken, issueTeacherToken } from "./auth.js";
import { loadRoster, upsertRoster } from "./roster-handlers.js";

type RecordedFetch = {
  readonly body: unknown;
  readonly method: string;
  readonly table: string;
  readonly url: string;
};

const teacherRequest = (teacherId: string): IncomingMessage => {
  const request = new IncomingMessage(new Socket());
  request.headers = {
    "x-research-teacher-id": teacherId,
    "x-research-teacher-token": issueTeacherToken(teacherId)
  };
  return request;
};

const adminRequest = (): IncomingMessage => {
  const request = new IncomingMessage(new Socket());
  request.headers = {
    "x-research-admin-id": "admin-root",
    "x-research-admin-token": issueAdminToken("admin-root")
  };
  return request;
};

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

describe("roster credential persistence", () => {
  beforeEach(() => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads stored initial student passwords for teacher account management", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      if (method === "GET" && table === "classes") {
        return new Response(JSON.stringify([
          { id: "class-pilot", name: "파일럿 반", teacher_id: "teacher-research" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "students") {
        return new Response(JSON.stringify([
          {
            class_group_id: "class-pilot",
            display_label: "민서",
            id: "student-s001",
            initial_password: "pw-001",
            login_id: "s001",
            student_anonymous_id: "anon-class-pilot-001",
            student_number: 1
          }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const roster = await loadRoster({ teacherId: "teacher-research" }, teacherRequest("teacher-research"));

    if (!isRecord(roster) || !Array.isArray(roster["students"]) || !isRecord(roster["students"][0])) throw new Error("loaded roster students are invalid.");
    expect(roster["students"][0]["password"]).toBe("pw-001");
  });

  it("loads original participant codes but does not expose teacher passwords to teachers", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      if (method === "GET" && table === "classes") {
        return new Response(JSON.stringify([
          { id: "class-pilot", name: "파일럿 반", teacher_id: "teacher-research" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "students") {
        return new Response(JSON.stringify([
          {
            class_group_id: "class-pilot",
            display_label: "민서",
            id: "student-s001",
            initial_participant_code: "S 001",
            initial_password: "pw-001",
            login_id: "s001",
            student_anonymous_id: "anon-class-pilot-001",
            student_number: 1
          }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([
          {
            display_name: "연구 교사",
            id: "teacher-research",
            initial_password: "teacher-pw",
            login_id: "teacher"
          }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const roster = await loadRoster({ teacherId: "teacher-research" }, teacherRequest("teacher-research"));

    if (!isRecord(roster) || !Array.isArray(roster["students"]) || !Array.isArray(roster["teachers"])) throw new Error("loaded roster is invalid.");
    const student = roster["students"][0];
    const teacher = roster["teachers"][0];
    if (!isRecord(student) || !isRecord(teacher)) throw new Error("loaded roster rows are invalid.");
    expect(student["participantCode"]).toBe("S 001");
    expect(teacher).not.toHaveProperty("password");
  });

  it("loads stored teacher passwords for admin account management", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([
          {
            display_name: "연구 교사",
            id: "teacher-research",
            initial_password: "teacher-pw",
            login_id: "teacher"
          }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const roster = await loadRoster({}, adminRequest());

    if (!isRecord(roster) || !Array.isArray(roster["teachers"]) || !isRecord(roster["teachers"][0])) throw new Error("loaded roster teachers are invalid.");
    expect(roster["teachers"][0]["password"]).toBe("teacher-pw");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("select=id,display_name,initial_password,login_id"),
      expect.anything()
    );
  });

  it("loads only the active teacher account for teacher roster reads", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      if (method === "GET" && table === "teachers" && url.includes("id=eq.teacher-research")) {
        return new Response(JSON.stringify([
          {
            display_name: "연구 교사",
            id: "teacher-research",
            initial_password: "teacher-pw",
            login_id: "teacher"
          }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([
          {
            display_name: "연구 교사",
            id: "teacher-research",
            initial_password: "teacher-pw",
            login_id: "teacher"
          },
          {
            display_name: "보조 교사",
            id: "teacher-helper",
            initial_password: "helper-pw",
            login_id: "helper"
          }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const roster = await loadRoster({ teacherId: "teacher-research" }, teacherRequest("teacher-research"));

    if (!isRecord(roster) || !Array.isArray(roster["teachers"])) throw new Error("loaded roster is invalid.");
    expect(roster["teachers"]).toEqual([expect.objectContaining({ id: "teacher-research" })]);
    expect(roster["teachers"][0]).not.toHaveProperty("password");
  });

  it("preserves existing credential hashes when roster rows omit passwords", async () => {
    const calls: RecordedFetch[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      calls.push({ body: parsedBody(init), method, table, url });
      if (method === "POST" && table === "exports") return new Response(JSON.stringify([{ id: "export-roster" }]), { status: 200 });
      if (method === "GET" && table === "classes") {
        return new Response(JSON.stringify([
          { id: "class-pilot", teacher_id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([
          { id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }
        ]), { status: 200 });
      }
      if (method === "GET" && table === "students" && url.includes("id=in.(student-s001)")) {
        return new Response(JSON.stringify([
          { class_group_id: "class-pilot", id: "student-s001", student_anonymous_id: "anon-class-pilot-001" }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await upsertRoster({
      assignments: [],
      classes: [{ id: "class-pilot", name: "파일럿 반", teacherId: "teacher-research" }],
      students: [{
        classGroupId: "class-pilot",
        displayLabel: "민서",
        id: "student-s001",
        loginId: "s001",
        participantCode: "S001",
        studentAnonymousId: "anon-class-pilot-001",
        studentNumber: 1
      }],
      teacherId: "teacher-research",
      teachers: [{ displayName: "연구 교사", id: "teacher-research", loginId: "teacher" }]
    }, teacherRequest("teacher-research"));

    const teacherPatch = calls.find((call) => call.method === "PATCH" && call.table === "teachers");
    const studentPatch = calls.find((call) => call.method === "PATCH" && call.table === "students");
    expect(calls.some((call) => call.method === "POST" && call.table === "teachers")).toBe(false);
    expect(calls.some((call) => call.method === "POST" && call.table === "students")).toBe(false);
    expect(teacherPatch?.body).toEqual({ display_name: "연구 교사", login_id: "teacher" });
    expect(studentPatch?.body).toEqual({
      class_group_id: "class-pilot",
      display_label: "민서",
      login_id: "s001",
      participant_code_hash: expect.any(String),
      student_anonymous_id: "anon-class-pilot-001",
      student_number: 1
    });
    expect(JSON.stringify(teacherPatch?.body)).not.toContain("password_hash");
    expect(JSON.stringify(studentPatch?.body)).not.toContain("password_hash");
  });

  it("rejects deleting roster rows that belong to another teacher", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      if (method === "GET" && table === "classes" && url.includes("teacher_id=eq.teacher-research")) return new Response(JSON.stringify([]), { status: 200 });
      if (method === "GET" && table === "classes" && url.includes("id=in.(class-foreign)")) {
        return new Response(JSON.stringify([{ id: "class-foreign", teacher_id: "teacher-other" }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(upsertRoster({
      assignments: [],
      classes: [],
      deletedClassIds: ["class-foreign"],
      students: [],
      teacherId: "teacher-research"
    }, teacherRequest("teacher-research"))).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects stale roster revisions before writing a snapshot", async () => {
    const calls: RecordedFetch[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      calls.push({ body: parsedBody(init), method, table, url });
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([{ id: "teacher-research", updated_at: "2026-07-05T00:00:00.000Z" }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(upsertRoster({
      assignments: [],
      classes: [],
      expectedRosterRevision: "stale-revision",
      students: [],
      teacherId: "teacher-research"
    }, teacherRequest("teacher-research"))).rejects.toMatchObject({ statusCode: 409 });
    expect(calls.some((call) => call.method === "POST" && call.table === "exports")).toBe(false);
  });
});
