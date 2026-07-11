import { z } from "zod";
import { credentialHash } from "./credentials.js";
import { ApiError } from "./http.js";
import { issueAdminToken } from "./auth.js";

const adminLoginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1)
});

const requiredCredential = (key: string, localFallback: string): string => {
  const configured = process.env[key]?.trim();
  if (configured !== undefined && configured.length > 0) return configured;
  const hasSupabaseConfig = (process.env["SUPABASE_URL"]?.trim().length ?? 0) > 0 && (process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim().length ?? 0) > 0;
  if (process.env["NODE_ENV"] === "production" || hasSupabaseConfig) throw new ApiError(500, `${key} is required on the server.`);
  return localFallback;
};

const adminCredentials = (): { readonly adminId: string; readonly displayName: string; readonly loginId: string; readonly password: string } => ({
  adminId: requiredCredential("ADMIN_ID", "admin-root"),
  displayName: process.env["ADMIN_DISPLAY_NAME"]?.trim() || "관리자",
  loginId: requiredCredential("ADMIN_LOGIN_ID", "admin"),
  password: requiredCredential("ADMIN_PASSWORD", "test")
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
