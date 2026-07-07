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

type SchemaHealth = {
  readonly apply_roster_mutation_available?: boolean;
  readonly delete_research_test_data_available?: boolean;
  readonly plaintext_password_columns_removed?: boolean;
  readonly version?: string;
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

const requiredProductionSecretCheck = (key: string): HealthCheck => {
  const configured = process.env[key]?.trim();
  const ok = process.env["NODE_ENV"] !== "production" || (configured !== undefined && configured.length > 0);
  return check(key.toLowerCase(), ok, ok ? undefined : `${key} is required in production.`);
};

const tableHealthCheck = async (db: SupabaseRestClient, table: RequiredTable): Promise<HealthCheck> => {
  try {
    await db.get<readonly Record<string, unknown>[]>(table.name, `select=${table.select}&limit=1`);
    return check(`supabase_table_${table.name}`, true);
  } catch (error) {
    return check(`supabase_table_${table.name}`, false, messageForError(error));
  }
};

const schemaHealthChecks = async (db: SupabaseRestClient): Promise<readonly HealthCheck[]> => {
  try {
    const health = await db.rpc<SchemaHealth>("research_schema_health", {});
    return [
      check("supabase_schema_health_rpc", true, health.version),
      check(
        "supabase_plaintext_password_columns_removed",
        health.plaintext_password_columns_removed === true,
        health.plaintext_password_columns_removed === true ? undefined : "students/teachers initial_password columns still exist."
      ),
      check(
        "supabase_apply_roster_mutation_rpc",
        health.apply_roster_mutation_available === true,
        health.apply_roster_mutation_available === true ? undefined : "apply_roster_mutation RPC is missing."
      ),
      check(
        "supabase_delete_research_test_data_rpc",
        health.delete_research_test_data_available === true,
        health.delete_research_test_data_available === true ? undefined : "delete_research_test_data RPC is missing."
      )
    ];
  } catch (error) {
    return [check("supabase_schema_health_rpc", false, messageForError(error))];
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
    requiredProductionSecretCheck("ADMIN_ID"),
    requiredProductionSecretCheck("ADMIN_LOGIN_ID"),
    requiredProductionSecretCheck("ADMIN_PASSWORD"),
    check(
      "gemini_api_key",
      env.aiMode === "mock" || env.geminiApiKey !== undefined,
      env.aiMode === "real" && env.geminiApiKey === undefined ? "GEMINI_API_KEY is required when READING_COACH_AI_MODE is real." : undefined
    )
  ];

  try {
    const db = new SupabaseRestClient({ serviceRoleKey: env.supabaseServiceRoleKey, url: env.supabaseUrl });
    checks.push(...await Promise.all(requiredTables.map((table) => tableHealthCheck(db, table))));
    checks.push(...await schemaHealthChecks(db));
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
