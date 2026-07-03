import { describe, expect, it } from "vitest";
import type { Assignment } from "../shared/types";
import { calibrationDraftFromAssignment, resolveCalibrationDraft } from "./calibration-assignment-config";
import { independentProblems, predictionSurveyItems, preSurveyItems } from "./understanding-calibration-data";

const assignment: Assignment = {
  gradeLevel: "초등 고학년",
  id: "assignment-test",
  passage: "양자컴퓨터 지문",
  question: "양자컴퓨터 설명하기",
  targetLength: "300자",
  title: "양자컴퓨터"
};

describe("calibration assignment config display draft", () => {
  it("shows default research items as reference placeholders instead of prefilled answers", () => {
    const draft = calibrationDraftFromAssignment(assignment);

    expect(draft.errorStatement).toBe("");
    expect(draft.preSurveyItems[0]?.label).toBe("");
    expect(draft.predictionSurveyItems[0]?.label).toBe("");
    expect(draft.independentProblems[0]?.title).toBe("");
    expect(draft.independentProblems[0]?.prompt).toBe("");

    const resolved = resolveCalibrationDraft(draft);

    expect(resolved.preSurveyItems[0]?.label).toBe(preSurveyItems[0]?.label);
    expect(resolved.predictionSurveyItems[0]?.label).toBe(predictionSurveyItems[0]?.label);
    expect(resolved.independentProblems[0]?.title).toBe(independentProblems[0]?.title);
    expect(resolved.independentProblems[0]?.prompt).toBe(independentProblems[0]?.prompt);
  });

  it("preserves teacher-authored overrides as actual editable values", () => {
    const draft = calibrationDraftFromAssignment({
      ...assignment,
      calibrationConfig: {
        errorStatement: "맞춤 오류 문장",
        independentProblems: [{ number: 1, prompt: "맞춤 문제 지시문", title: "맞춤 문제" }],
        predictionSurveyItems: [{ id: predictionSurveyItems[0]?.id ?? "", label: "맞춤 예측 문항" }],
        preSurveyItems: [{ id: preSurveyItems[0]?.id ?? "", label: "맞춤 사전 문항" }],
        reflectionSurveyItems: [],
        sourceText: "양자컴퓨터 지문",
        topic: "양자컴퓨터"
      }
    });

    expect(draft.errorStatement).toBe("맞춤 오류 문장");
    expect(draft.preSurveyItems[0]?.label).toBe("맞춤 사전 문항");
    expect(draft.predictionSurveyItems[0]?.label).toBe("맞춤 예측 문항");
    expect(draft.independentProblems[0]?.title).toBe("맞춤 문제");
    expect(draft.independentProblems[0]?.prompt).toBe("맞춤 문제 지시문");
  });

  it("resolves added survey items and deleted performance items without restoring removed defaults", () => {
    const draft = calibrationDraftFromAssignment({
      ...assignment,
      calibrationConfig: {
        errorStatement: "맞춤 오류 문장",
        independentProblems: [
          { number: 1, prompt: independentProblems[0]?.prompt ?? "", title: independentProblems[0]?.title ?? "" },
          { number: 4, prompt: "마지막 적용 문제", title: "적용 문제" }
        ],
        predictionSurveyItems: [
          { id: predictionSurveyItems[0]?.id ?? "", label: predictionSurveyItems[0]?.label ?? "" },
          { id: "pred_custom_1", label: "나는 새 문항에도 응답할 수 있다." }
        ],
        preSurveyItems: [],
        reflectionSurveyItems: [],
        sourceText: "양자컴퓨터 지문",
        topic: "양자컴퓨터"
      }
    });

    expect(draft.independentProblems.map((problem) => problem.number)).toEqual([1, 4]);
    expect(draft.independentProblems[0]?.title).toBe("");
    expect(draft.predictionSurveyItems.map((item) => item.id)).toEqual(["pred_can_explain_concept", "pred_custom_1"]);
    expect(draft.predictionSurveyItems[0]?.label).toBe("");

    const resolved = resolveCalibrationDraft(draft);

    expect(resolved.independentProblems.map((problem) => problem.number)).toEqual([1, 4]);
    expect(resolved.independentProblems[0]?.title).toBe(independentProblems[0]?.title);
    expect(resolved.predictionSurveyItems[0]?.label).toBe(predictionSurveyItems[0]?.label);
    expect(resolved.predictionSurveyItems[1]?.label).toBe("나는 새 문항에도 응답할 수 있다.");
  });
});
