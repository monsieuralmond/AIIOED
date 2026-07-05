import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCoachResponse, requestReviewSuggestions } from "./api-client.js";

const reviewRequest = {
  draft: "양자컴퓨터는 일반 컴퓨터와 계산 방식이 다르다.",
  outline: {
    claim: "양자컴퓨터",
    counterargument: "",
    evidence: ["큐비트"],
    question: "양자컴퓨터",
    reasoning: "원리 설명"
  }
} as const;

describe("AI API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a request failure when an API route returns an empty error body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 405 })));

    await expect(requestReviewSuggestions(reviewRequest)).rejects.toThrow("AI 요청에 실패했습니다.");
  });

  it("rejects a successful route response with no body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));

    await expect(requestReviewSuggestions(reviewRequest)).rejects.toThrow("AI 서버가 빈 응답을 반환했습니다.");
  });

  it("rejects an empty coach answer instead of saving a silent turn", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ text: "", type: "question" })));

    await expect(
      requestCoachResponse({
        assignment: {
          gradeLevel: "초등 고학년",
          id: "assignment-1",
          passage: "테스트 지문",
          question: "테스트 질문",
          targetLength: "짧게",
          title: "테스트 과제"
        },
        draft: "초안",
        message: "도와줘",
        outline: {
          claim: "주장",
          counterargument: "",
          evidence: [],
          question: "질문",
          reasoning: "이유"
        }
      })
    ).rejects.toThrow("AI 응답 형식이 올바르지 않습니다.");
  });
});
