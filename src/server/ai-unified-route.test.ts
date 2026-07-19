import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUnifiedAiJsonHandler } from "./ai-unified-route.js";
import type { AiServerConfig } from "./gemini-client.js";
import { emptyRequest, requestWithAdminToken } from "./research/handlers-test-utils.js";
import { resetAiRequestLimitsForTests } from "./ai-rate-limit.js";

const config: AiServerConfig = {
  apiKey: undefined,
  mode: "mock",
  model: "mock",
  provider: "openai"
};

const calibrationPayload = {
  history: [],
  message: "양자컴퓨터가 뭐야?",
  passage: "양자컴퓨터는 양자 상태를 활용하는 컴퓨터다.",
  topic: "양자컴퓨터"
};

describe("unified AI route", () => {
  const originalNodeEnv = process.env["NODE_ENV"];
  const originalServerAuthSecret = process.env["SERVER_AUTH_SECRET"];

  beforeEach(() => {
    process.env["NODE_ENV"] = "production";
    process.env["SERVER_AUTH_SECRET"] = "ai-route-test-secret";
  });

  afterEach(() => {
    delete process.env["MAX_AI_REQUESTS_PER_MINUTE"];
    if (originalNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = originalNodeEnv;
    if (originalServerAuthSecret === undefined) delete process.env["SERVER_AUTH_SECRET"];
    else process.env["SERVER_AUTH_SECRET"] = originalServerAuthSecret;
    resetAiRequestLimitsForTests();
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
  });

  it("rejects unauthenticated calls before invoking an AI handler", async () => {
    const handler = createUnifiedAiJsonHandler(config);

    await expect(handler({ kind: "calibrationChat", payload: calibrationPayload }, emptyRequest())).rejects.toMatchObject({
      statusCode: 401
    });
  });

  it("does not reserve quota for authenticated calibration chat calls", async () => {
    process.env["MAX_AI_REQUESTS_PER_MINUTE"] = "1";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    const fetchMock = vi.fn(async (): Promise<Response> => new Response(JSON.stringify({ allowed: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = createUnifiedAiJsonHandler(config);
    const request = requestWithAdminToken("admin-ai-test");

    await expect(handler({ kind: "calibrationChat", payload: calibrationPayload }, request)).resolves.toMatchObject({
      text: expect.any(String)
    });
    await expect(handler({ kind: "calibrationChat", payload: calibrationPayload }, request)).resolves.toMatchObject({
      text: expect.any(String)
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not reserve quota for writing feedback AI calls", async () => {
    process.env["MAX_AI_REQUESTS_PER_MINUTE"] = "1";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    const fetchMock = vi.fn(async (): Promise<Response> => new Response(JSON.stringify({ allowed: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = createUnifiedAiJsonHandler(config);
    const request = requestWithAdminToken("admin-ai-test");
    const outline = {
      claim: "양자컴퓨터를 설명한다",
      counterargument: "",
      evidence: ["큐비트", "특정 계산"],
      question: "자료 메모",
      reasoning: "정보 처리 방식이 다르기 때문이다."
    };
    const suggestion = {
      category: "내용과 초점",
      focusLabel: "초안의 첫 부분",
      id: "claim",
      resolved: false,
      text: "초안 첫부분에서 글이 무엇을 설명하거나 다루려는지 분명히 드러나는지 확인해보세요."
    };

    await expect(handler({ kind: "reviewSuggestions", payload: { draft: "짧은 글", outline } }, request)).resolves.toHaveProperty("suggestions");
    await expect(handler({ kind: "reviewCheck", payload: { draft: "양자컴퓨터를 설명한다. 큐비트와 특정 계산을 다룬다.", outline, suggestion } }, request)).resolves.toMatchObject({
      suggestionId: "claim"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows writing coach calls without session auth so active writing work is not blocked by a stale browser token", async () => {
    const handler = createUnifiedAiJsonHandler(config);
    const outline = {
      claim: "양자컴퓨터를 설명한다",
      counterargument: "",
      evidence: ["큐비트"],
      question: "자료 메모",
      reasoning: "정보 처리 방식이 다르기 때문이다."
    };

    await expect(handler({
      kind: "coach",
      payload: {
        assignment: {
          gradeLevel: "초등 고학년",
          id: "assignment-writing-ai-auth",
          passage: "양자컴퓨터는 큐비트를 활용한다.",
          question: "쉽게 설명하는 글을 쓰세요.",
          targetLength: "400자",
          title: "양자컴퓨터"
        },
        draft: "양자컴퓨터는",
        message: "다음 문장을 어떻게 이어가면 좋을까?",
        outline
      }
    }, emptyRequest())).resolves.toMatchObject({
      text: expect.any(String)
    });
  });
});
