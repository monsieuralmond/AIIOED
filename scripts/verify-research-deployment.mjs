import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const loadEnvFile = (path) => {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
};

loadEnvFile(resolve(".env"));
loadEnvFile(resolve(".env.local"));

const required = (key) => {
  const value = process.env[key]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${key} is required.`);
  return value;
};

const optional = (key) => {
  const value = process.env[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
};

const parseParticipantCodes = (value) => {
  if (value === undefined) return [];
  if (value.startsWith("auto:")) {
    const count = Number.parseInt(value.slice("auto:".length), 10);
    if (!Number.isFinite(count) || count <= 0) throw new Error("VERIFY_PARTICIPANT_CODES auto count must be positive.");
    return Array.from({ length: count }, (_, index) => `S${String(index + 1).padStart(3, "0")}`);
  }
  return value.split(",").map((code) => code.trim()).filter((code) => code.length > 0);
};

const requestJson = async (baseUrl, path, body, headers = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(new URL(path, baseUrl), {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
      method: "POST",
      signal: controller.signal
    });
    const text = await response.text();
    const payload = text.trim().length === 0 ? {} : JSON.parse(text);
    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : `HTTP ${response.status}`;
      throw new Error(`${path} failed: ${message}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const assertStringField = (value, field) => {
  if (typeof value?.[field] !== "string" || value[field].length === 0) throw new Error(`Response field ${field} is missing.`);
  return value[field];
};

const assertDeploymentHealth = (health) => {
  if (health?.ok === true) return;
  if (!Array.isArray(health?.checks)) throw new Error(`Deployment health failed: ${JSON.stringify(health)}`);
  const failed = health.checks
    .filter((check) => check?.ok !== true)
    .map((check) => {
      const name = typeof check?.name === "string" ? check.name : "unknown_check";
      const message = typeof check?.message === "string" ? `: ${check.message}` : "";
      return `${name}${message}`;
    });
  throw new Error(`Deployment health failed:\n${failed.map((item) => `- ${item}`).join("\n")}`);
};

const assertRequiredHealthChecks = (health) => {
  if (!Array.isArray(health?.checks)) throw new Error("Deployment health response did not include checks.");
  const checkNames = new Set(health.checks.map((check) => check?.name).filter((name) => typeof name === "string"));
  for (const requiredCheck of [
    "supabase_schema_health_rpc",
    "supabase_plaintext_password_columns_removed",
    "supabase_apply_roster_mutation_rpc",
    "supabase_delete_research_test_data_rpc",
    "supabase_sync_research_session_rpc",
    "supabase_session_uniqueness",
    "supabase_ai_request_quota_rpc",
    "supabase_reset_research_session_rpc",
    "supabase_reset_research_session_archive"
  ]) {
    if (!checkNames.has(requiredCheck)) throw new Error(`Deployment health check ${requiredCheck} is missing. Apply the latest Supabase migrations first.`);
  }
};

const main = async () => {
  const baseUrl = new URL(optional("APP_BASE_URL") ?? "http://127.0.0.1:5173/");
  const teacher = await requestJson(baseUrl, "/api/auth/teacher", {
    loginId: required("VERIFY_TEACHER_LOGIN_ID"),
    password: required("VERIFY_TEACHER_PASSWORD")
  });
  const teacherId = assertStringField(teacher, "teacherId");
  const teacherToken = assertStringField(teacher, "teacherToken");
  const teacherHeaders = {
    "x-research-teacher-id": teacherId,
    "x-research-teacher-token": teacherToken
  };

  const health = await requestJson(baseUrl, "/api/admin/health", {}, teacherHeaders);
  assertDeploymentHealth(health);
  assertRequiredHealthChecks(health);

  const adminLoginId = optional("VERIFY_ADMIN_LOGIN_ID") ?? optional("ADMIN_LOGIN_ID");
  const adminPassword = optional("VERIFY_ADMIN_PASSWORD") ?? optional("ADMIN_PASSWORD");
  if (adminLoginId !== undefined && adminPassword !== undefined) {
    const admin = await requestJson(baseUrl, "/api/auth/admin", {
      loginId: adminLoginId,
      password: adminPassword
    });
    assertStringField(admin, "adminId");
    assertStringField(admin, "adminToken");
  }

  const codes = parseParticipantCodes(optional("VERIFY_PARTICIPANT_CODES"));
  if (codes.length > 0) {
    const sessions = await Promise.all(codes.map((participantCode) => requestJson(baseUrl, "/api/session/start", { participantCode })));
    const sessionIds = new Set(sessions.map((session) => assertStringField(session, "sessionId")));
    const studentIds = new Set(sessions.map((session) => assertStringField(session, "studentAnonymousId")));
    if (sessionIds.size !== codes.length || studentIds.size !== codes.length) throw new Error("Concurrent participant sessions were not isolated.");

    if (optional("VERIFY_CHAT") === "1") {
      await Promise.all(sessions.map((session, index) => requestJson(baseUrl, "/api/chat", {
        message: "자료의 핵심을 한 문장으로 설명해줘.",
        requestId: `verify-${Date.now()}-${index + 1}`,
        sessionId: assertStringField(session, "sessionId")
      }, { "x-research-session-token": assertStringField(session, "sessionToken") })));
    }
  }

  console.log(JSON.stringify({
    baseUrl: baseUrl.toString(),
    health: "ok",
    participantSessionCount: codes.length,
    verifiedAt: new Date().toISOString()
  }, null, 2));
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown deployment verification failure.";
  console.error(message);
  process.exitCode = 1;
});
