import { ApiError } from "./http.js";

type QueryValue = boolean | number | string | undefined;

export type SupabaseConfig = {
  readonly retryLimit?: number;
  readonly serviceRoleKey: string;
  readonly timeoutMs?: number;
  readonly url: string;
};

const defaultTimeoutMs = 6_000;
const retryLimit = 0;
const retryDelayMs = 150;
const retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const cloudflareGatewayStatusCodes = new Set([520, 521, 522, 523, 524]);
const htmlLikePattern = /<\s*(?:!doctype|html)\b/iu;
const upstreamTimeoutPattern = /(?:upstream connect error|disconnect\/reset before headers|reset reason:\s*connection timeout)/iu;
const maxSupabaseErrorExcerptLength = 240;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const compactWhitespace = (value: string): string => value.replace(/\s+/gu, " ").trim();

const sanitizeExcerpt = (text: string): string => {
  const compacted = compactWhitespace(text);
  return compacted.length > maxSupabaseErrorExcerptLength
    ? `${compacted.slice(0, maxSupabaseErrorExcerptLength)}...`
    : compacted;
};

const extractSupabaseJsonMessage = (text: string): string | null => {
  try {
    const payload: unknown = JSON.parse(text);
    if (!isRecord(payload)) return null;
    for (const field of ["message", "error", "hint", "details"]) {
      const value = payload[field];
      if (typeof value === "string" && value.trim().length > 0) return sanitizeExcerpt(value);
    }
    return null;
  } catch {
    return null;
  }
};

const isHtmlErrorBody = (text: string, contentType: string | null): boolean =>
  contentType?.toLowerCase().includes("text/html") === true || htmlLikePattern.test(text);

const isUpstreamTimeoutBody = (text: string): boolean => upstreamTimeoutPattern.test(text);

const statusForSupabaseFailure = (status: number, text: string): number => {
  if (isUpstreamTimeoutBody(text)) return 504;
  if (status === 522 || status === 524) return 504;
  if (cloudflareGatewayStatusCodes.has(status)) return 503;
  return status;
};

const messageForSupabaseFailure = (status: number, text: string, contentType: string | null): string => {
  if (text.trim().length === 0) return "Supabase request failed.";
  if (isUpstreamTimeoutBody(text)) {
    return "Supabase 데이터베이스 연결이 일시적으로 지연되고 있습니다. 잠시 후 다시 저장하거나 Supabase 프로젝트 상태를 확인해 주세요.";
  }
  if (isHtmlErrorBody(text, contentType)) {
    if (cloudflareGatewayStatusCodes.has(status)) {
      return "Supabase 데이터베이스가 일시적으로 응답하지 않습니다. 잠시 후 다시 저장하거나 Supabase 프로젝트 상태를 확인해 주세요.";
    }
    return "Supabase가 HTML 오류 페이지를 반환했습니다. 배포 환경변수의 SUPABASE_URL과 프로젝트 상태를 확인해 주세요.";
  }
  const jsonMessage = extractSupabaseJsonMessage(text);
  if (jsonMessage !== null) return `Supabase request failed: ${jsonMessage}`;
  return `Supabase request failed: ${sanitizeExcerpt(text)}`;
};

const waitBeforeRetry = async (attempt: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, retryDelayMs * (attempt + 1));
  });

const encodeQuery = (query: Readonly<Record<string, QueryValue>> = {}): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded.length === 0 ? "" : `?${encoded}`;
};

export class SupabaseRestClient {
  private readonly restUrl: string;
  private readonly retryLimit: number;
  private readonly serviceRoleKey: string;
  private readonly timeoutMs: number;

  constructor(config: SupabaseConfig) {
    this.restUrl = `${config.url.replace(/\/$/, "")}/rest/v1`;
    this.retryLimit = config.retryLimit ?? retryLimit;
    this.serviceRoleKey = config.serviceRoleKey;
    this.timeoutMs = config.timeoutMs ?? defaultTimeoutMs;
  }

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      apikey: this.serviceRoleKey,
      authorization: `Bearer ${this.serviceRoleKey}`,
      "content-type": "application/json",
      ...extra
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryLimit; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.restUrl}${path}`, { ...init, signal: controller.signal });
        if (!response.ok) {
          const text = await response.text();
          if (attempt < this.retryLimit && retryableStatusCodes.has(response.status)) {
            await waitBeforeRetry(attempt);
            continue;
          }
          throw new ApiError(
            statusForSupabaseFailure(response.status, text),
            messageForSupabaseFailure(response.status, text, response.headers.get("content-type"))
          );
        }
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError || attempt >= this.retryLimit) break;
        await waitBeforeRetry(attempt);
      } finally {
        clearTimeout(timeout);
      }
    }
    if (lastError instanceof ApiError) throw lastError;
    throw new ApiError(504, "Supabase request timed out or failed.");
  }

  async delete<T>(table: string, query: string): Promise<T> {
    return this.request<T>(`/${table}?${query}`, {
      headers: this.headers({ prefer: "return=representation" }),
      method: "DELETE"
    });
  }

  async get<T>(table: string, query: string): Promise<T> {
    return this.request<T>(`/${table}?${query}`, {
      headers: this.headers(),
      method: "GET"
    });
  }

  async insert<T>(table: string, body: unknown): Promise<T> {
    return this.request<T>(`/${table}`, {
      body: JSON.stringify(body),
      headers: this.headers({ prefer: "return=representation" }),
      method: "POST"
    });
  }

  async patch<T>(table: string, query: string, body: unknown): Promise<T> {
    return this.request<T>(`/${table}?${query}`, {
      body: JSON.stringify(body),
      headers: this.headers({ prefer: "return=representation" }),
      method: "PATCH"
    });
  }

  async rpc<T>(functionName: string, body: unknown): Promise<T> {
    return this.request<T>(`/rpc/${functionName}`, {
      body: JSON.stringify(body),
      headers: this.headers({ prefer: "return=representation" }),
      method: "POST"
    });
  }

  async upsert<T>(table: string, body: unknown, onConflict?: string): Promise<T> {
    return this.request<T>(`/${table}${encodeQuery(onConflict === undefined ? {} : { on_conflict: onConflict })}`, {
      body: JSON.stringify(body),
      headers: this.headers({ prefer: "resolution=merge-duplicates,return=representation" }),
      method: "POST"
    });
  }

  async upsertIgnoringDuplicates<T>(table: string, body: unknown, onConflict: string): Promise<T> {
    return this.request<T>(`/${table}${encodeQuery({ on_conflict: onConflict })}`, {
      body: JSON.stringify(body),
      headers: this.headers({ prefer: "resolution=ignore-duplicates,return=representation" }),
      method: "POST"
    });
  }
}
