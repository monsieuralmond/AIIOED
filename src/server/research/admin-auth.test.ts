import { afterEach, describe, expect, it } from "vitest";
import { authenticateAdmin } from "./admin-auth.js";

const originalNodeEnv = process.env["NODE_ENV"];
const originalSupabaseServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const originalSupabaseUrl = process.env["SUPABASE_URL"];

describe("admin authentication", () => {
  afterEach(() => {
    process.env["NODE_ENV"] = originalNodeEnv;
    delete process.env["ADMIN_ID"];
    delete process.env["ADMIN_LOGIN_ID"];
    delete process.env["ADMIN_PASSWORD"];
    delete process.env["SERVER_AUTH_SECRET"];
    if (originalSupabaseServiceRoleKey === undefined) delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    else process.env["SUPABASE_SERVICE_ROLE_KEY"] = originalSupabaseServiceRoleKey;
    if (originalSupabaseUrl === undefined) delete process.env["SUPABASE_URL"];
    else process.env["SUPABASE_URL"] = originalSupabaseUrl;
  });

  it("allows local fallback credentials outside production", async () => {
    process.env["NODE_ENV"] = "test";
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    delete process.env["SUPABASE_URL"];

    const result = await authenticateAdmin({ loginId: "admin", password: "test" });

    expect(result).toEqual(expect.objectContaining({
      adminId: "admin-root",
      displayName: "관리자"
    }));
  });

  it("does not allow the default admin password in production", async () => {
    process.env["NODE_ENV"] = "production";
    process.env["ADMIN_ID"] = "admin-root";
    process.env["ADMIN_LOGIN_ID"] = "admin";

    await expect(authenticateAdmin({ loginId: "admin", password: "test" })).rejects.toMatchObject({
      statusCode: 500
    });
  });
});
