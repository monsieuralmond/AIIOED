import { afterEach, describe, expect, it } from "vitest";
import { authenticateAdmin } from "./admin-auth.js";

const originalNodeEnv = process.env["NODE_ENV"];

describe("admin authentication", () => {
  afterEach(() => {
    process.env["NODE_ENV"] = originalNodeEnv;
    delete process.env["ADMIN_ID"];
    delete process.env["ADMIN_LOGIN_ID"];
    delete process.env["ADMIN_PASSWORD"];
    delete process.env["SERVER_AUTH_SECRET"];
  });

  it("allows local fallback credentials outside production", async () => {
    process.env["NODE_ENV"] = "test";
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";

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
