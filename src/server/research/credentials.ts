import { createHash } from "node:crypto";
import { ApiError } from "./http.js";

const credentialSecret = (): string => {
  const configured = process.env["SERVER_AUTH_SECRET"]?.trim();
  if (configured !== undefined && configured.length > 0) return configured;
  if (process.env["NODE_ENV"] === "production") throw new ApiError(500, "SERVER_AUTH_SECRET is required on the server.");
  return process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "reading-coach-local-dev-secret";
};

export const credentialHash = (value: string): string =>
  createHash("sha256").update(`${credentialSecret()}:${value}`).digest("hex");
