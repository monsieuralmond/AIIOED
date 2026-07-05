import { ApiError } from "./http.js";
import { researchServerEnv } from "./env.js";
import { SupabaseRestClient } from "./supabase-rest.js";

type HealthCheck = {
  readonly message?: string;
  readonly name: string;
  readonly ok: boolean;
};

type RequiredTable = {
  readonly name: string;
  readonly select: string;
};

export type DeploymentHealth = {
  readonly checks: readonly HealthCheck[];
  readonly generatedAt: string;
  readonly ok: boolean;
};

const requiredTables = [
  { name: "teachers", select: "id" },
  { name: "classes", select: "id" },
  { name: "assignments", select: "id" },
  { name: "students", select: "id" },
  { name: "sessions", select: "session_id" },
  { name: "chat_turns", select: "id" },
  { name: "events", select: "id" },
  { name: "artifacts", select: "id" },
  { name: "measures", select: "id" },
  { name: "exports", select: "id" },
  { name: "deletion_logs", select: "id" }
] as const satisfies readonly RequiredTable[];

const messageForError = (error: unknown): string => error instanceof Error ? error.message : "Unknown error.";

const check = (name: string, ok: boolean, message?: string): HealthCheck => ({
  ...(message === undefined ? {} : { message }),
  name,
  ok
});

const tableHealthCheck = async (db: SupabaseRestClient, table: RequiredTable): Promise<HealthCheck> => {
  try {
    await db.get<readonly Record<string, unknown>[]>(table.name, `select=${table.select}&limit=1`);
    return check(`supabase_table_${table.name}`, true);
  } catch (error) {
    return check(`supabase_table_${table.name}`, false, messageForError(error));
  }
};

export const researchDeploymentHealth = async (): Promise<DeploymentHealth> => {
  const generatedAt = new Date().toISOString();
  let env;
  try {
    env = researchServerEnv();
  } catch (error) {
    return {
      checks: [check("server_environment", false, messageForError(error))],
      generatedAt,
      ok: false
    };
  }

  const checks: HealthCheck[] = [
    check("supabase_url", env.supabaseUrl.length > 0),
    check("supabase_service_role_key", env.supabaseServiceRoleKey.length > 0),
    check(
      "server_auth_secret",
      env.serverAuthSecret !== undefined || process.env["NODE_ENV"] !== "production",
      process.env["NODE_ENV"] === "production" && env.serverAuthSecret === undefined ? "SERVER_AUTH_SECRET is required in production." : undefined
    ),
    check(
      "gemini_api_key",
      env.aiMode === "mock" || env.geminiApiKey !== undefined,
      env.aiMode === "real" && env.geminiApiKey === undefined ? "GEMINI_API_KEY is required when READING_COACH_AI_MODE is real." : undefined
    )
  ];

  try {
    const db = new SupabaseRestClient({ serviceRoleKey: env.supabaseServiceRoleKey, url: env.supabaseUrl });
    checks.push(...await Promise.all(requiredTables.map((table) => tableHealthCheck(db, table))));
  } catch (error) {
    checks.push(check("supabase_rest_connection", false, messageForError(error)));
  }

  return {
    checks,
    generatedAt,
    ok: checks.every((item) => item.ok)
  };
};

export const requireHealthyDeployment = async (): Promise<void> => {
  const health = await researchDeploymentHealth();
  if (!health.ok) throw new ApiError(503, "Deployment health check failed.");
};
