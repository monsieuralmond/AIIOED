import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./http.js";
import { SupabaseRestClient } from "./supabase-rest.js";

const cloudflareTimeoutHtml = `<!DOCTYPE html>
<html class="no-js" lang="en-US">
<head><title>supabase.co | 522: Connection timed out</title></head>
<body><h1>Connection timed out</h1><span class="code-label">Error code 522</span></body>
</html>`;
const upstreamTimeoutText = "upstream connect error or disconnect/reset before headers. reset reason: connection timeout";

describe("SupabaseRestClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not expose Cloudflare HTML pages when Supabase times out", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      new Response(cloudflareTimeoutHtml, {
        headers: { "content-type": "text/html; charset=UTF-8" },
        status: 522
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SupabaseRestClient({
      serviceRoleKey: "service-role-test",
      timeoutMs: 1_000,
      url: "https://project.supabase.co"
    });

    try {
      await client.get("classes", "select=id");
      throw new Error("Expected SupabaseRestClient to reject.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      if (!(error instanceof ApiError)) throw error;
      expect(error.statusCode).toBe(504);
      expect(error.message).toContain("Supabase");
      expect(error.message).not.toContain("<!DOCTYPE html>");
      expect(error.message).not.toContain("<html");
    }
  });

  it("does not expose upstream proxy timeout text when Supabase disconnects before headers", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      new Response(upstreamTimeoutText, {
        headers: { "content-type": "text/plain; charset=utf-8" },
        status: 503
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SupabaseRestClient({
      serviceRoleKey: "service-role-test",
      timeoutMs: 1_000,
      url: "https://project.supabase.co"
    });

    try {
      await client.insert("classes", { id: "class-timeout" });
      throw new Error("Expected SupabaseRestClient to reject.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      if (!(error instanceof ApiError)) throw error;
      expect(error.statusCode).toBe(504);
      expect(error.message).toContain("Supabase");
      expect(error.message).not.toContain("upstream connect error");
      expect(error.message).not.toContain("reset reason");
    }
  });

  it("does not retry failed database reads by default", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      new Response(JSON.stringify({ message: "database is unavailable" }), { status: 503 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SupabaseRestClient({
      serviceRoleKey: "service-role-test",
      url: "https://project.supabase.co"
    });

    await expect(client.get("classes", "select=id")).rejects.toThrow("Supabase request failed");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("can opt in to retrying transient failures", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "temporary" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "class-pilot" }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SupabaseRestClient({
      retryLimit: 1,
      serviceRoleKey: "service-role-test",
      url: "https://project.supabase.co"
    });

    await expect(client.get("classes", "select=id")).resolves.toEqual([{ id: "class-pilot" }]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
