import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "./research/http.js";
import { resetAiRequestLimitsForTests, reserveAiRequest, reserveAiRequestDurably } from "./ai-rate-limit.js";

const originalLimit = process.env["MAX_AI_REQUESTS_PER_MINUTE"];

describe("AI request quota", () => {
  afterEach(() => {
    resetAiRequestLimitsForTests();
    if (originalLimit === undefined) delete process.env["MAX_AI_REQUESTS_PER_MINUTE"];
    else process.env["MAX_AI_REQUESTS_PER_MINUTE"] = originalLimit;
  });

  it("limits requests per authenticated principal within one minute", () => {
    process.env["MAX_AI_REQUESTS_PER_MINUTE"] = "2";
    const principal = { id: "teacher-1", kind: "teacher" } as const;

    reserveAiRequest(principal, 10_000);
    reserveAiRequest(principal, 10_001);

    expect(() => reserveAiRequest(principal, 10_002)).toThrowError(ApiError);
    expect(() => reserveAiRequest(principal, 10_002)).toThrowError(/AI 요청이 너무 많습니다/);
  });

  it("keeps quotas separate for different principals", () => {
    process.env["MAX_AI_REQUESTS_PER_MINUTE"] = "1";

    reserveAiRequest({ id: "teacher-1", kind: "teacher" }, 10_000);
    expect(() => reserveAiRequest({ id: "teacher-1", kind: "teacher" }, 10_001)).toThrowError(ApiError);
    expect(() => reserveAiRequest({ id: "teacher-2", kind: "teacher" }, 10_001)).not.toThrow();
  });

  it("keeps student session chat quota broad enough for classroom use even when the env value is low", () => {
    process.env["MAX_AI_REQUESTS_PER_MINUTE"] = "1";

    expect(() => {
      for (let index = 0; index < 30; index += 1) {
        reserveAiRequest({ id: "session-1", kind: "session" }, 10_000 + index);
      }
    }).not.toThrow();
  });

  it("expires requests after one minute", () => {
    process.env["MAX_AI_REQUESTS_PER_MINUTE"] = "1";
    const principal = { id: "teacher-1", kind: "teacher" } as const;

    reserveAiRequest(principal, 10_000);

    expect(() => reserveAiRequest(principal, 70_000)).not.toThrow();
  });

  it("fails closed in production when shared quota storage is missing", async () => {
    const originalNodeEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];

    await expect(reserveAiRequestDurably({ id: "session-production", kind: "session" })).rejects.toMatchObject({ statusCode: 503 });

    if (originalNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = originalNodeEnv;
  });
});
