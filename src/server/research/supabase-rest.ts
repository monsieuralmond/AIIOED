import { ApiError } from "./http.js";

type QueryValue = boolean | number | string | undefined;

export type SupabaseConfig = {
  readonly serviceRoleKey: string;
  readonly url: string;
};

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

  constructor(config: SupabaseConfig) {
    this.restUrl = `${config.url.replace(/\/$/, "")}/rest/v1`;
    this.serviceRoleKey = config.serviceRoleKey;
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
    const response = await fetch(`${this.restUrl}${path}`, init);
    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(response.status, text.length === 0 ? "Supabase request failed." : text);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
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

  async upsert<T>(table: string, body: unknown, onConflict?: string): Promise<T> {
    return this.request<T>(`/${table}${encodeQuery(onConflict === undefined ? {} : { on_conflict: onConflict })}`, {
      body: JSON.stringify(body),
      headers: this.headers({ prefer: "resolution=merge-duplicates,return=representation" }),
      method: "POST"
    });
  }
}
