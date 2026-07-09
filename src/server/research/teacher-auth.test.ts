import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { credentialHash } from "./credentials.js";
import { authenticateTeacher } from "./teacher-auth.js";

const tableFromUrl = (url: string): string => {
  const pathname = new URL(url).pathname;
  return pathname.split("/").filter((part) => part.length > 0).at(-1) ?? "";
};

const parsedBody = (init?: RequestInit): unknown => {
  if (typeof init?.body !== "string") return undefined;
  const parsed: unknown = JSON.parse(init.body);
  return parsed;
};

describe("teacher authentication", () => {
  beforeEach(() => {
    process.env["SERVER_AUTH_SECRET"] = "server-auth-test";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not persist the entered teacher password after successful login", async () => {
    const recordedCalls: { readonly body: unknown; readonly method: string; readonly table: string; readonly url: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const table = tableFromUrl(url);
      recordedCalls.push({ body: parsedBody(init), method, table, url });
      if (method === "GET" && table === "teachers") {
        return new Response(JSON.stringify([{
          display_name: "연구 교사",
          id: "teacher-research",
          login_id: "teacher",
          password_hash: credentialHash("teacher-pw")
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: "teacher-research" }]), { status: 200 });
    }));

    await authenticateTeacher({ loginId: "teacher", password: "teacher-pw" });

    const teacherPatch = recordedCalls.find((call) => call.method === "PATCH" && call.table === "teachers");
    expect(teacherPatch).toBeUndefined();
    expect(recordedCalls.find((call) => call.method === "GET" && call.table === "teachers")?.url).not.toContain("initial_password");
  });

  it("retries a transient failed login database read once", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      new Response(JSON.stringify({ message: "temporary upstream failure" }), { status: 503 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(authenticateTeacher({ loginId: "teacher", password: "teacher-pw" })).rejects.toThrow("Supabase");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
