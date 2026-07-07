import { ApiError } from "./http.js";

type QueryValue = boolean | number | string | undefined;

export type SupabaseConfig = {
  readonly serviceRoleKey: string;
  readonly timeoutMs?: number;
  readonly url: string;
};

const defaultTimeoutMs = 20_000;
const retryLimit = 1;
const retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504]);

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
  private readonly serviceRoleKey: string;
  private readonly timeoutMs: number;

  constructor(config: SupabaseConfig) {
    this.restUrl = `${config.url.replace(/\/$/, "")}/rest/v1`;
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
    for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.restUrl}${path}`, { ...init, signal: controller.signal });
        if (!response.ok) {
          const text = await response.text();
          if (attempt < retryLimit && retryableStatusCodes.has(response.status)) continue;
          throw new ApiError(response.status, text.length === 0 ? "Supabase request failed." : text);
        }
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError || attempt >= retryLimit) break;
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
