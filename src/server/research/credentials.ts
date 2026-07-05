import { createHash } from "node:crypto";

const credentialSecret = (): string => process.env["SERVER_AUTH_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "reading-coach-local-dev-secret";

export const credentialHash = (value: string): string =>
  createHash("sha256").update(`${credentialSecret()}:${value}`).digest("hex");
