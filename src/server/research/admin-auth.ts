import { z } from "zod";
import { credentialHash } from "./credentials.js";
import { ApiError } from "./http.js";
import { issueAdminToken } from "./auth.js";

const adminLoginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1)
});

const adminCredentials = (): { readonly adminId: string; readonly displayName: string; readonly loginId: string; readonly password: string } => ({
  adminId: process.env["ADMIN_ID"]?.trim() || "admin-root",
  displayName: process.env["ADMIN_DISPLAY_NAME"]?.trim() || "관리자",
  loginId: process.env["ADMIN_LOGIN_ID"]?.trim() || "admin",
  password: process.env["ADMIN_PASSWORD"]?.trim() || "test"
});

export const authenticateAdmin = async (payload: unknown): Promise<{
  readonly adminId: string;
  readonly adminToken: string;
  readonly displayName: string;
}> => {
  const input = adminLoginSchema.parse(payload);
  const credentials = adminCredentials();
  if (input.loginId !== credentials.loginId || credentialHash(input.password) !== credentialHash(credentials.password)) {
    throw new ApiError(401, "Admin login failed.");
  }
  return {
    adminId: credentials.adminId,
    adminToken: issueAdminToken(credentials.adminId),
    displayName: credentials.displayName
  };
};
