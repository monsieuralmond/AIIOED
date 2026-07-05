import { describe, expect, it } from "vitest";
import { createReviewSuggestions, reviewSuggestionIsResolved } from "./review.js";
import { sampleOutline } from "../shared/fixtures.js";

describe("deterministic review suggestions", () => {
  it("returns evidence and counterargument suggestions for incomplete drafts", () => {
    const suggestions = createReviewSuggestions({
      outline: sampleOutline,
      draft: "일회용 플라스틱은 줄여야 한다. 환경에 좋지 않기 때문이다."
    });

    expect(suggestions.map((suggestion) => suggestion.category)).toContain("자료와 설명");
    expect(suggestions.map((suggestion) => suggestion.category)).toContain("구조와 흐름");
  });

  it("checks whether a selected suggestion has been fixed in the current draft", () => {
    const suggestion = createReviewSuggestions({
      outline: sampleOutline,
      draft: "일회용 플라스틱은 줄여야 한다. 환경에 좋지 않기 때문이다."
    }).find((item) => item.id === "evidence");

    expect(suggestion).toBeDefined();
    if (suggestion === undefined) throw new Error("Expected evidence suggestion.");
    expect(reviewSuggestionIsResolved({
      outline: sampleOutline,
      draft: "일회용 플라스틱은 줄여야 한다. 분해가 오래 걸린다. 생태계에 피해를 준다.",
      suggestion
    })).toBe(true);
  });

  it("asks students to mark where evidence came from", () => {
    const suggestions = createReviewSuggestions({
      outline: sampleOutline,
      draft: "일회용 플라스틱은 줄여야 한다. 분해가 오래 걸린다. 생태계에 피해를 준다. 위생과 편리함이 중요하다는 의견도 있다. 하지만 오래 남는 피해를 줄이려면 재사용 가능한 물건을 써야 한다. 학교와 집에서 포장을 줄이면 쓰레기도 줄일 수 있다."
    });
    const sourceSuggestion = suggestions.find((item) => item.id === "source");

    expect(sourceSuggestion).toBeDefined();
    if (sourceSuggestion === undefined) throw new Error("Expected source suggestion.");
    expect(reviewSuggestionIsResolved({
      outline: sampleOutline,
      draft: "일회용 플라스틱은 줄여야 한다. 지문에 따르면 분해가 오래 걸린다. 또 생태계에 피해를 준다. 위생과 편리함이 중요하다는 의견도 있다. 하지만 오래 남는 피해를 줄이려면 재사용 가능한 물건을 써야 한다.",
      suggestion: sourceSuggestion
    })).toBe(true);
  });
});
