import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rosterUpsertSchema } from "./schemas.js";
import { assertNoLockedResearchDataDeletion } from "./roster-locked-sessions.js";
import { SupabaseRestClient } from "./supabase-rest.js";

const tableFromUrl = (url: string): string => {
  const pathname = new URL(url).pathname;
  return pathname.split("/").filter((part) => part.length > 0).at(-1) ?? "";
};

describe("roster research data deletion guard", () => {
  beforeEach(() => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects deletion when a matching research session exists", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (tableFromUrl(url) === "sessions" && url.includes("assignment_id=in.")) {
        return new Response(JSON.stringify([{ session_id: "session-locked" }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const db = new SupabaseRestClient({ serviceRoleKey: "service-role-test", url: "https://example.supabase.co" });
    const input = rosterUpsertSchema.parse({
      deletedAssignmentIds: ["assignment-old"],
      deletedClassIds: [],
      deletedStudentIds: [],
      students: []
    });

    await expect(assertNoLockedResearchDataDeletion(db, input, [])).rejects.toMatchObject({
      message: "이미 수집된 연구 데이터가 있어 일반 화면에서 삭제할 수 없습니다.",
      statusCode: 409
    });
  });
});
