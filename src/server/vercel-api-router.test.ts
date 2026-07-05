import { describe, expect, it } from "vitest";
import { apiRoutePathFromUrl, isApiRoutePath } from "./vercel-api-router.js";

describe("Vercel API router", () => {
  it("maps rewritten Vercel API paths to existing route names", () => {
    expect(apiRoutePathFromUrl("/api?path=chat")).toBe("chat");
    expect(apiRoutePathFromUrl("/api?path=session/start")).toBe("session/start");
    expect(apiRoutePathFromUrl("/api?path=admin/upsert-roster")).toBe("admin/upsert-roster");
  });

  it("keeps direct API paths routable in local and preview environments", () => {
    expect(apiRoutePathFromUrl("/api/chat-turn")).toBe("chat-turn");
    expect(apiRoutePathFromUrl("/api/auth/teacher")).toBe("auth/teacher");
    expect(apiRoutePathFromUrl("/api/auth/student")).toBe("auth/student");
  });

  it("accepts only API paths that have a handler", () => {
    expect(isApiRoutePath("session/list")).toBe(true);
    expect(isApiRoutePath("auth/student")).toBe(true);
    expect(isApiRoutePath("admin/delete-test-data")).toBe(true);
    expect(isApiRoutePath("missing/route")).toBe(false);
  });
});
