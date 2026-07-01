import { describe, expect, it } from "vitest";
import { createSession, enterStage, recordFeedbackGenerated, recordSuggestionCheck, resolveSuggestion, updateOutline, updateTeacherReview } from "./session";
import { sampleAssignment } from "../shared/fixtures";
import type { ReviewSuggestion } from "../shared/types";

describe("pilot session logging", () => {
  it("creates ordered process data with required export fields", () => {
    const session = createSession(sampleAssignment);
    const afterReading = enterStage(session, "reading");
    const afterOutline = updateOutline(afterReading, {
      claim: "일회용 플라스틱은 줄여야 한다",
      evidence: ["분해가 오래 걸린다", "생태계에 피해를 준다"],
      reasoning: "편리함보다 환경 피해가 더 오래 남기 때문이다.",
      counterargument: "위생과 편리함도 중요하다는 반론이 있다.",
      question: "지문: 플라스틱 분해와 생태계 피해 문장"
    });

    expect(afterOutline.events.map((event) => event.type)).toContain("stage_entered");
    expect(afterOutline.events.map((event) => event.type)).toContain("source_added");
    expect(afterOutline.outlineSnapshots).toHaveLength(1);
    expect(afterOutline.metadata.llmMode).toBe("mock");
    expect(afterOutline.pasteEvents).toEqual([]);
  });

  it("records review feedback lifecycle events", () => {
    const suggestion: ReviewSuggestion = {
      id: "suggestion-evidence",
      category: "근거와 설명",
      text: "근거가 주장과 어떻게 연결되는지 확인하세요.",
      focusLabel: "근거가 들어가야 할 문장",
      resolved: false
    };
    const session = enterStage(createSession(sampleAssignment), "review");
    const withFeedback = recordFeedbackGenerated(session, [suggestion]);
    const withCheck = recordSuggestionCheck(withFeedback, suggestion, {
      message: "아직 근거가 하나만 보여요.",
      resolved: false
    });
    const withResolution = resolveSuggestion(withCheck, suggestion);
    const generatedEvent = withFeedback.events.find((item) => item.type === "feedback_generated");
    const checkedEvent = withCheck.events.find((item) => item.type === "suggestion_checked");

    expect(generatedEvent?.payload).toEqual(expect.objectContaining({
      suggestions: [expect.objectContaining({ id: "suggestion-evidence", focusLabel: "근거가 들어가야 할 문장" })]
    }));
    expect(checkedEvent?.payload).toEqual(expect.objectContaining({
      message: "아직 근거가 하나만 보여요.",
      resolved: false,
      suggestionId: "suggestion-evidence"
    }));
    expect(withResolution.events.map((item) => item.type)).toEqual(expect.arrayContaining(["feedback_generated", "feedback_viewed", "suggestion_checked", "suggestion_resolved"]));
  });

  it("records teacher review status and memo on the session", () => {
    const session = createSession(sampleAssignment);
    const reviewed = updateTeacherReview(session, "teacher-research", {
      note: "근거 요청과 반론 작성이 확인됨.",
      status: "reviewed"
    });
    const reviewEvent = reviewed.events.find((item) => item.type === "teacher_review_updated");

    expect(reviewed.teacherReview).toEqual(expect.objectContaining({
      note: "근거 요청과 반론 작성이 확인됨.",
      status: "reviewed",
      updatedByTeacherId: "teacher-research"
    }));
    expect(reviewEvent?.payload).toEqual(expect.objectContaining({
      note: "근거 요청과 반론 작성이 확인됨.",
      status: "reviewed",
      updatedByTeacherId: "teacher-research"
    }));
  });
});
