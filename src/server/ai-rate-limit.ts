import type { AiPrincipal } from "./research/auth.js";
import { ApiError } from "./research/http.js";
import { SupabaseRestClient } from "./research/supabase-rest.js";

const minuteMs = 60_000;
const minimumSessionRequestsPerMinute = 120;
const requestsByPrincipal = new Map<string, readonly number[]>();

const configuredRequestsPerMinute = (): number => {
  const raw = process.env["MAX_AI_REQUESTS_PER_MINUTE"];
  if (raw === undefined) return 12;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
};

const maxRequestsPerMinute = (principal: AiPrincipal): number => {
  const configured = configuredRequestsPerMinute();
  return principal.kind === "session" ? Math.max(configured, minimumSessionRequestsPerMinute) : configured;
};

const keyFor = (principal: AiPrincipal): string => `${principal.kind}:${principal.id}`;

export const reserveAiRequest = (principal: AiPrincipal, nowMs = Date.now()): void => {
  const key = keyFor(principal);
  const recent = (requestsByPrincipal.get(key) ?? []).filter((timestamp) => nowMs - timestamp < minuteMs);
  if (recent.length >= maxRequestsPerMinute(principal)) {
    requestsByPrincipal.set(key, recent);
    throw new ApiError(429, "AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  }
  requestsByPrincipal.set(key, [...recent, nowMs]);
};

export const resetAiRequestLimitsForTests = (): void => {
  requestsByPrincipal.clear();
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const reserveAiRequestDurably = async (principal: AiPrincipal): Promise<void> => {
  const url = process.env["SUPABASE_URL"]?.trim();
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (url === undefined || serviceRoleKey === undefined) {
    if (process.env["NODE_ENV"] === "production") {
      throw new ApiError(503, "AI quota storage is not configured on the server.");
    }
    reserveAiRequest(principal);
    return;
  }
  const db = new SupabaseRestClient({ serviceRoleKey, url });
  const result = await db.rpc<unknown>("reserve_ai_request", {
    principal_id: principal.id,
    principal_kind: principal.kind,
    request_limit: maxRequestsPerMinute(principal)
  });
  if (!isRecord(result) || result["allowed"] !== true) throw new ApiError(429, "AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
};
