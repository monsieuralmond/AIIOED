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
});
