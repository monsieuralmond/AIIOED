import { describe, expect, it } from "vitest";
import type { Assignment } from "../shared/types.js";
import { calibrationDraftFromAssignment, resolveCalibrationDraft } from "./calibration-assignment-config.js";
import { finalReflectionSurveyItems, independentProblems, postProblemSurveyItems, predictionSurveyItems, preSurveyItems } from "./understanding-calibration-data.js";

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
    expect(draft.finalReflectionSurveyItems[0]?.label).toBe("");
    expect(draft.preSurveyItems[0]?.label).toBe("");
    expect(draft.predictionSurveyItems[0]?.label).toBe("");
    expect(draft.independentProblems[0]?.title).toBe("");
    expect(draft.independentProblems[0]?.prompt).toBe("");
    expect(draft.independentProblems[0]?.postSurveyItems[0]?.label).toBe("");

    const resolved = resolveCalibrationDraft(draft);

    expect(resolved.preSurveyItems[0]?.label).toBe(preSurveyItems[0]?.label);
    expect(resolved.finalReflectionSurveyItems[0]?.label).toBe(finalReflectionSurveyItems[0]?.label);
    expect(resolved.predictionSurveyItems[0]?.label).toBe(predictionSurveyItems[0]?.label);
    expect(resolved.independentProblems[0]?.title).toBe(independentProblems[0]?.title);
    expect(resolved.independentProblems[0]?.prompt).toBe(independentProblems[0]?.prompt);
    expect(resolved.independentProblems[0]?.postSurveyItems[0]?.label).toBe(postProblemSurveyItems[0]?.label);
  });

  it("preserves teacher-authored overrides as actual editable values", () => {
    const draft = calibrationDraftFromAssignment({
      ...assignment,
      calibrationConfig: {
        errorStatement: "맞춤 오류 문장",
        finalReflectionSurveyItems: [{ id: finalReflectionSurveyItems[0]?.id ?? "", label: "맞춤 마무리 문항" }],
        independentProblems: [{ number: 1, postSurveyItems: [{ id: "confidence", label: "문제 1 답을 얼마나 믿나요?" }], prompt: "맞춤 문제 지시문", title: "맞춤 문제" }],
        predictionSurveyItems: [{ id: predictionSurveyItems[0]?.id ?? "", label: "맞춤 예측 문항" }],
        preSurveyItems: [{ id: preSurveyItems[0]?.id ?? "", label: "맞춤 사전 문항" }],
        reflectionSurveyItems: [],
        sourceText: "양자컴퓨터 지문",
        topic: "양자컴퓨터"
      }
    });

    expect(draft.errorStatement).toBe("맞춤 오류 문장");
    expect(draft.finalReflectionSurveyItems[0]?.label).toBe("맞춤 마무리 문항");
    expect(draft.preSurveyItems[0]?.label).toBe("맞춤 사전 문항");
    expect(draft.predictionSurveyItems[0]?.label).toBe("맞춤 예측 문항");
    expect(draft.independentProblems[0]?.title).toBe("맞춤 문제");
    expect(draft.independentProblems[0]?.prompt).toBe("맞춤 문제 지시문");
    expect(draft.independentProblems[0]?.postSurveyItems[0]?.label).toBe("문제 1 답을 얼마나 믿나요?");
  });

  it("resolves added survey items and deleted performance items without restoring removed defaults", () => {
    const draft = calibrationDraftFromAssignment({
      ...assignment,
      calibrationConfig: {
        errorStatement: "맞춤 오류 문장",
        finalReflectionSurveyItems: [
          { id: finalReflectionSurveyItems[0]?.id ?? "", label: finalReflectionSurveyItems[0]?.label ?? "" },
          { id: "final_custom_1", label: "마지막으로 새롭게 확인한 내용을 적을 수 있다.", responseType: "text" }
        ],
        independentProblems: [
          { number: 1, postSurveyItems: [{ id: "confidence", label: postProblemSurveyItems[0]?.label ?? "" }], prompt: independentProblems[0]?.prompt ?? "", title: independentProblems[0]?.title ?? "" },
          { number: 4, postSurveyItems: [{ id: "problem4_post_custom_1", label: "문제 4 뒤에 남길 생각을 쓴다.", responseType: "text" }], prompt: "마지막 적용 문제", title: "적용 문제" }
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
    expect(draft.independentProblems[0]?.postSurveyItems[0]?.label).toBe("");
    expect(draft.finalReflectionSurveyItems[0]?.label).toBe("");
    expect(draft.predictionSurveyItems.map((item) => item.id)).toEqual(["pred_can_explain_concept", "pred_custom_1"]);
    expect(draft.predictionSurveyItems[0]?.label).toBe("");

    const resolved = resolveCalibrationDraft(draft);

    expect(resolved.independentProblems.map((problem) => problem.number)).toEqual([1, 4]);
    expect(resolved.independentProblems[0]?.title).toBe(independentProblems[0]?.title);
    expect(resolved.independentProblems[0]?.postSurveyItems[0]?.label).toBe(postProblemSurveyItems[0]?.label);
    expect(resolved.independentProblems[1]?.postSurveyItems[0]?.label).toBe("문제 4 뒤에 남길 생각을 쓴다.");
    expect(resolved.finalReflectionSurveyItems[0]?.label).toBe(finalReflectionSurveyItems[0]?.label);
    expect(resolved.finalReflectionSurveyItems[1]?.label).toBe("마지막으로 새롭게 확인한 내용을 적을 수 있다.");
    expect(resolved.predictionSurveyItems[0]?.label).toBe(predictionSurveyItems[0]?.label);
    expect(resolved.predictionSurveyItems[1]?.label).toBe("나는 새 문항에도 응답할 수 있다.");
  });
});
