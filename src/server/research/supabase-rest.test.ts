import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./http.js";
import { SupabaseRestClient } from "./supabase-rest.js";

const cloudflareTimeoutHtml = `<!DOCTYPE html>
<html class="no-js" lang="en-US">
<head><title>supabase.co | 522: Connection timed out</title></head>
<body><h1>Connection timed out</h1><span class="code-label">Error code 522</span></body>
</html>`;

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
});
