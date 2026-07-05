import { afterEach, describe, expect, it, vi } from "vitest";
import { researchDeploymentHealth } from "./health.js";

const tableFromUrl = (input: RequestInfo | URL): string => {
  const pathname = new URL(String(input)).pathname;
  return pathname.split("/").filter((part) => part.length > 0).at(-1) ?? "";
};

describe("deployment health", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks every required Supabase table instead of only one table", async () => {
    process.env["GEMINI_API_KEY"] = "gemini-test";
    process.env["READING_COACH_AI_MODE"] = "real";
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    const requestedTables: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      requestedTables.push(tableFromUrl(input));
      return new Response(JSON.stringify([]), { status: 200 });
    }));

    const health = await researchDeploymentHealth();

    expect(health.ok).toBe(true);
    expect(new Set(requestedTables)).toEqual(new Set([
      "artifacts",
      "assignments",
      "chat_turns",
      "classes",
      "deletion_logs",
      "events",
      "exports",
      "measures",
      "sessions",
      "students",
      "teachers"
    ]));
  });
});
