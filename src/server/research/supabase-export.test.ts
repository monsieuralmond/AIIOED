import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./http.js";
import { buildSupabaseExport } from "./supabase-export.js";
import { SupabaseRestClient } from "./supabase-rest.js";

const tableFromUrl = (input: RequestInfo | URL): string => {
  const pathname = new URL(String(input)).pathname;
  return pathname.split("/").filter((part) => part.length > 0).at(-1) ?? "";
};

const responseForTable = (table: string, sessionCount: number): Response => {
  if (table === "assignments") return new Response(JSON.stringify([{ id: "assignment-pilot" }]), { status: 200 });
  if (table === "sessions") {
    return new Response(
      JSON.stringify(Array.from({ length: sessionCount }, (_, index) => ({
        assignment_id: "assignment-pilot",
        assignment_snapshot: null,
        class_group_id: "class-pilot",
        completed_at: null,
        created_at: "2026-07-05T00:00:00.000Z",
        current_stage: "completed",
        metadata: {},
        research_condition: "single_group_baseline",
        research_mode: "understanding_calibration",
        session_id: `session-${index + 1}`,
        status: "completed",
        student_anonymous_id: `anon-${index + 1}`,
        updated_at: "2026-07-05T00:00:00.000Z"
      }))),
      { status: 200 }
    );
  }
  return new Response(JSON.stringify([]), { status: 200 });
};

const completedCalibrationRowsForTable = (table: string): Response => {
  if (table === "sessions") {
    return new Response(JSON.stringify([{
      assignment_id: "assignment-pilot",
      assignment_snapshot: {
        id: "assignment-pilot",
        passage: "양자컴퓨터 지문",
        question: "설명하세요.",
        researchCondition: "single_group_baseline",
        researchMode: "understanding_calibration",
        title: "양자컴퓨터",
        gradeLevel: "초등 고학년",
        targetLength: ""
      },
      class_group_id: "class-pilot",
      completed_at: "2026-07-05T00:20:00.000Z",
      created_at: "2026-07-05T00:00:00.000Z",
      current_stage: "completed",
      metadata: {},
      research_condition: "single_group_baseline",
      research_mode: "understanding_calibration",
      session_id: "session-completed",
      status: "completed",
      student_anonymous_id: "anon-001",
      updated_at: "2026-07-05T00:20:00.000Z"
    }]), { status: 200 });
  }
  if (table === "artifacts") {
    return new Response(JSON.stringify([
      ...[1, 2, 3, 4].map((number) => ({
        assignment_id: "assignment-pilot",
        class_group_id: "class-pilot",
        created_at: `2026-07-05T00:0${number}:00.000Z`,
        id: `artifact-problem-${number}`,
        kind: `problem${number}`,
        payload: { answer: `답변 ${number}`, questionNumber: number },
        session_id: "session-completed",
        stage: `problem_${number}`,
        student_anonymous_id: "anon-001",
        updated_at: null
      })),
      {
        assignment_id: "assignment-pilot",
        class_group_id: "class-pilot",
        created_at: "2026-07-05T00:18:00.000Z",
        id: "artifact-final-reflection",
        kind: "final_reflection",
        payload: { text: "마지막 생각" },
        session_id: "session-completed",
        stage: "final_reflection",
        student_anonymous_id: "anon-001",
        updated_at: null
      }
    ]), { status: 200 });
  }
  if (table === "measures") {
    return new Response(JSON.stringify([
      ...[1, 2, 3, 4].map((number) => ({
        assignment_id: "assignment-pilot",
        class_group_id: "class-pilot",
        created_at: `2026-07-05T00:1${number}:00.000Z`,
        id: `measure-confidence-${number}`,
        kind: `problem${number}_confidence`,
        payload: { confidence: number, questionNumber: number },
        session_id: "session-completed",
        stage: `problem_${number}_confidence`,
        student_anonymous_id: "anon-001"
      })),
      {
        assignment_id: "assignment-pilot",
        class_group_id: "class-pilot",
        created_at: "2026-07-05T00:17:00.000Z",
        id: "measure-reflection",
        kind: "reflection_self_report",
        payload: { ratings: {} },
        session_id: "session-completed",
        stage: "reflection_survey",
        student_anonymous_id: "anon-001"
      },
      {
        assignment_id: "assignment-pilot",
        class_group_id: "class-pilot",
        created_at: "2026-07-05T00:19:00.000Z",
        id: "measure-final-reflection",
        kind: "final_reflection_self_report",
        payload: { ratings: {} },
        session_id: "session-completed",
        stage: "final_reflection",
        student_anonymous_id: "anon-001"
      }
    ]), { status: 200 });
  }
  return new Response(JSON.stringify([]), { status: 200 });
};

describe("Supabase export", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects exports that exceed the configured session limit", async () => {
    process.env["EXPORT_SESSION_LIMIT"] = "2";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => responseForTable(tableFromUrl(input), 3)));

    await expect(buildSupabaseExport(new SupabaseRestClient({
      serviceRoleKey: "service-role-test",
      url: "https://example.supabase.co"
    }), {
      anonymized: true,
      completedOnly: false,
      teacherId: "teacher-research"
    })).rejects.toBeInstanceOf(ApiError);
  });

  it("keeps completed-status calibration sessions in the default completed export", async () => {
    process.env["EXPORT_SESSION_LIMIT"] = "20";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => completedCalibrationRowsForTable(tableFromUrl(input))));

    const bundle = await buildSupabaseExport(new SupabaseRestClient({
      serviceRoleKey: "service-role-test",
      url: "https://example.supabase.co"
    }), {
      anonymized: true,
      completedOnly: true
    });

    expect(bundle["session-wide.csv"]).toContain("session-completed");
    expect(bundle["raw-json.json"]).toMatchObject({
      completedOnly: true,
      sessions: [expect.objectContaining({ sessionId: "session-completed", status: "completed" })]
    });
  });
});
