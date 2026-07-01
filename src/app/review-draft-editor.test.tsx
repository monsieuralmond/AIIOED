import { describe, expect, it } from "vitest";
import { createReviewSuggestions } from "../review/review";
import { sampleOutline } from "../shared/fixtures";
import { reviewFocus } from "./review-draft-editor";

const suggestionById = (id: string, draft: string) => {
  const suggestion = createReviewSuggestions({ draft, outline: sampleOutline }).find((item) => item.id === id);
  if (suggestion === undefined) throw new Error(`Expected ${id} suggestion.`);
  return suggestion;
};

describe("reviewFocus", () => {
  it("moves evidence feedback from the opening sentence to the evidence sentence", () => {
    const draft = "일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리기 때문이다.";
    const focus = reviewFocus(suggestionById("evidence", draft), draft, sampleOutline);

    expect(focus?.highlightText).toBe("분해가 오래 걸리기 때문이다.");
    expect(focus?.excerpt).toBe("분해가 오래 걸리기 때문이다.");
  });

  it("points source feedback to the evidence sentence that needs a citation marker", () => {
    const draft = "일회용 플라스틱은 줄여야 한다. 생태계에 피해를 준다는 점도 중요하다.";
    const focus = reviewFocus(suggestionById("source", draft), draft, sampleOutline);

    expect(focus?.label).toBe("근거 출처 표시");
    expect(focus?.highlightText).toBe("생태계에 피해를 준다는 점도 중요하다.");
  });
});
