import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAssignment } from "../../shared/fixtures.js";
import { ResearchConditions, ResearchModes } from "../../shared/research.js";
import { credentialHash } from "./credentials.js";
import { authenticateStudent } from "./student-auth.js";

const tableFromUrl = (url: string): string => {
  const pathname = new URL(url).pathname;
  return pathname.split("/").filter((part) => part.length > 0).at(-1) ?? "";
};

describe("student authentication", () => {
  beforeEach(() => {
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates a student account without requiring an already assigned session", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      const table = tableFromUrl(url);
      if (table === "students") {
        return new Response(JSON.stringify([{
          class_group_id: "class-test",
          display_label: "김민서",
          id: "student-1",
          initial_participant_code: "1",
          login_id: "1",
          password_hash: credentialHash("1"),
          student_anonymous_id: "anon-class-test-001",
          student_number: 1
        }]), { status: 200 });
      }
      if (table === "assignments") return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ error: "unexpected table" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await authenticateStudent({ participantCode: "1" });

    expect(response.student).toEqual({
      anonymousId: "anon-class-test-001",
      classGroupId: "class-test",
      displayName: "김민서",
      id: "student-1",
      loginId: "1",
      participantCode: "1",
      studentNumber: 1
    });
    expect(response.assignments).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("initial_password"), expect.anything());
  });

  it("returns assigned tasks after student account authentication", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const table = tableFromUrl(String(input));
      if (table === "students") {
        return new Response(JSON.stringify([{
          class_group_id: "class-test",
          display_label: "김민서",
          id: "student-1",
          initial_participant_code: "1",
          login_id: "1",
          password_hash: credentialHash("1"),
          student_anonymous_id: "anon-class-test-001",
          student_number: 1
        }]), { status: 200 });
      }
      if (table === "assignments") {
        return new Response(JSON.stringify([{
          assignment: { ...sampleAssignment, assignedStudentIds: ["student-1"], classGroupId: "class-test", title: "새 과제" },
          class_group_id: "class-test",
          created_by_teacher_id: "teacher-test",
          id: "assignment-test",
          research_condition: ResearchConditions.singleGroupBaseline,
          research_mode: ResearchModes.writingCoach
        }]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected table" }), { status: 404 });
    }));

    const response = await authenticateStudent({ loginId: "1", password: "1" });

    expect(response.assignments).toHaveLength(1);
    expect(response.assignments[0]?.id).toBe("assignment-test");
    expect(response.assignments[0]?.classGroupId).toBe("class-test");
  });

  it("rejects a student id login when the password is wrong", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const table = tableFromUrl(String(input));
      if (table === "students") {
        return new Response(JSON.stringify([{
          class_group_id: "class-test",
          display_label: "김민서",
          id: "student-1",
          initial_participant_code: "1",
          login_id: "1",
          password_hash: credentialHash("1"),
          student_anonymous_id: "anon-class-test-001",
          student_number: 1
        }]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected table" }), { status: 404 });
    }));

    await expect(authenticateStudent({ loginId: "1", password: "wrong" })).rejects.toThrow("Student credentials are invalid.");
  });

  it("omits class assignments that are not assigned to the authenticated student", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const table = tableFromUrl(String(input));
      if (table === "students") {
        return new Response(JSON.stringify([{
          class_group_id: "class-test",
          display_label: "김민서",
          id: "student-1",
          initial_participant_code: "1",
          login_id: "1",
          password_hash: credentialHash("1"),
          student_anonymous_id: "anon-class-test-001",
          student_number: 1
        }]), { status: 200 });
      }
      if (table === "assignments") {
        return new Response(JSON.stringify([{
          assignment: { ...sampleAssignment, assignedStudentIds: ["student-2"], classGroupId: "class-test", title: "다른 학생 과제" },
          class_group_id: "class-test",
          created_by_teacher_id: "teacher-test",
          id: "assignment-other-student",
          research_condition: ResearchConditions.singleGroupBaseline,
          research_mode: ResearchModes.writingCoach
        }]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected table" }), { status: 404 });
    }));

    const response = await authenticateStudent({ loginId: "1", participantCode: "1", password: "1" });

    expect(response.assignments).toEqual([]);
  });
});
