import { describe, expect, it } from "vitest";
import { createReviewSuggestions } from "../review/review.js";
import { createSession, recordFeedbackGenerated, recordSuggestionCheck, updateOutline, warnWeakOutline } from "../session/session.js";
import { sampleAssignment, sampleOutline, sampleStudents } from "../shared/fixtures.js";
import { processSignalsForSession } from "./teacher-process-record.js";

describe("processSignalsForSession", () => {
  it("surfaces source, feedback, and revision-check events for teacher labeling", () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("Sample student missing.");
    const draft = "일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리기 때문이다.";
    const sourceSuggestion = createReviewSuggestions({ draft, outline: sampleOutline }).find((suggestion) => suggestion.id === "source");
    if (sourceSuggestion === undefined) throw new Error("Expected source suggestion.");

    const withOutline = updateOutline(updateOutline(createSession(sampleAssignment, student), sampleOutline), sampleOutline);
    const withOutlineCheck = warnWeakOutline(withOutline, sampleOutline);
    const withFeedback = recordFeedbackGenerated(withOutlineCheck, [sourceSuggestion]);
    const withRevisionCheck = recordSuggestionCheck(withFeedback, sourceSuggestion, {
      message: "초안에 출처 표시가 아직 보이지 않습니다.",
      resolved: false
    });

    const signals = processSignalsForSession(withRevisionCheck);

    expect(signals.map((signal) => signal.label)).toEqual(expect.arrayContaining(["출처 메모", "개요 점검", "제안 보기", "수정 확인"]));
    expect(signals.filter((signal) => signal.label === "출처 메모")).toHaveLength(1);
    expect(signals.find((signal) => signal.label === "출처 메모")?.value).toBe("2회");
    expect(signals.find((signal) => signal.label === "수정 확인")).toEqual(expect.objectContaining({
      tone: "warning",
      value: "미해결"
    }));
  });
});
