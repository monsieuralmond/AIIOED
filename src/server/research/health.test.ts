import { afterEach, describe, expect, it, vi } from "vitest";
import { researchDeploymentHealth } from "./health.js";

const originalEnv = { ...process.env };

const tableFromUrl = (input: RequestInfo | URL): string => {
  const pathname = new URL(String(input)).pathname;
  return pathname.split("/").filter((part) => part.length > 0).at(-1) ?? "";
};

describe("deployment health", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("checks every required Supabase table instead of only one table", async () => {
    process.env["ADMIN_ID"] = "admin-root";
    process.env["ADMIN_LOGIN_ID"] = "admin";
    process.env["ADMIN_PASSWORD"] = "admin-password-test";
    process.env["AI_PROVIDER"] = "openai";
    process.env["OPENAI_API_KEY"] = "openai-test";
    process.env["READING_COACH_AI_MODE"] = "real";
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    const requestedTables: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const table = tableFromUrl(input);
      requestedTables.push(table);
      if (table === "research_schema_health") {
        return new Response(JSON.stringify({
          apply_roster_mutation_available: true,
          ai_request_quota_available: true,
          delete_research_test_data_available: true,
          plaintext_password_columns_removed: true,
          reset_research_session_archives_before_delete: true,
          reset_research_session_available: true,
          session_uniqueness_available: true,
          sync_research_session_available: true,
          version: "013_archive_before_teacher_session_reset"
        }), { status: 200 });
      }
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
      "teachers",
      "research_schema_health"
    ]));
  });

  it("reports missing production admin credentials before deployment", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["ADMIN_ID"];
    delete process.env["ADMIN_LOGIN_ID"];
    delete process.env["ADMIN_PASSWORD"];
    process.env["AI_PROVIDER"] = "openai";
    process.env["OPENAI_API_KEY"] = "openai-test";
    process.env["READING_COACH_AI_MODE"] = "real";
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const table = tableFromUrl(input);
      if (table === "research_schema_health") {
        return new Response(JSON.stringify({
          apply_roster_mutation_available: true,
          delete_research_test_data_available: true,
          plaintext_password_columns_removed: true,
          reset_research_session_archives_before_delete: true,
          reset_research_session_available: true
        }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));

    const health = await researchDeploymentHealth();

    expect(health.ok).toBe(false);
    expect(health.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "admin_id", ok: false }),
      expect.objectContaining({ name: "admin_login_id", ok: false }),
      expect.objectContaining({ name: "admin_password", ok: false })
    ]));
  });

  it("fails health when the teacher reset archive migration is missing", async () => {
    process.env["ADMIN_ID"] = "admin-root";
    process.env["ADMIN_LOGIN_ID"] = "admin";
    process.env["ADMIN_PASSWORD"] = "admin-password-test";
    process.env["AI_PROVIDER"] = "openai";
    process.env["OPENAI_API_KEY"] = "openai-test";
    process.env["READING_COACH_AI_MODE"] = "real";
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const table = tableFromUrl(input);
      if (table === "research_schema_health") {
        return new Response(JSON.stringify({
          apply_roster_mutation_available: true,
          ai_request_quota_available: true,
          delete_research_test_data_available: true,
          plaintext_password_columns_removed: true,
          reset_research_session_archives_before_delete: false,
          reset_research_session_available: true,
          session_uniqueness_available: true,
          sync_research_session_available: true,
          version: "012_secure_privileged_research_rpcs"
        }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));

    const health = await researchDeploymentHealth();

    expect(health.ok).toBe(false);
    expect(health.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "supabase_reset_research_session_archive",
        ok: false
      })
    ]));
  });
});
