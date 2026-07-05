import { describe, expect, it } from "vitest";
import {
  configuredIndependentProblems,
  configuredSurveyItems,
  emptyRatings,
  emptyTextResponses,
  independentProblemsForModule,
  predictionSurveyItems,
  predictionSurveyItemsForModule,
  preSurveyItems,
  nextProblemAfter,
  surveyItemsForTopic,
  surveyResponsesComplete,
  updateRating,
  updateTextResponse
} from "./understanding-calibration-data.js";

describe("surveyItemsForTopic", () => {
  it("renders topic-specific survey labels while preserving rating ids", () => {
    const preItems = surveyItemsForTopic(preSurveyItems, "양자컴퓨터");
    const predictionItems = surveyItemsForTopic(predictionSurveyItems, "양자컴퓨터");

    expect(preItems.map((item) => item.id)).toEqual(preSurveyItems.map((item) => item.id));
    expect(predictionItems.map((item) => item.id)).toEqual(predictionSurveyItems.map((item) => item.id));
    expect(preItems.map((item) => item.label)).toContain("나는 양자컴퓨터의 개념을 설명할 수 있다.");
    expect(predictionItems.map((item) => item.label)).toContain("나는 양자컴퓨터의 작동 원리를 설명할 수 있다.");
  });
});

describe("understanding calibration assignment configuration", () => {
  it("supports free-text survey items alongside Likert items", () => {
    const items = [
      { id: "likert_one", label: "나는 설명할 수 있다." },
      { id: "text_one", label: "내 말로 적어 보세요.", responseType: "text" }
    ] as const;
    const ratings = updateRating(emptyRatings(items), "likert_one", 4);
    const emptyTexts = emptyTextResponses(items);

    expect(surveyResponsesComplete(items, ratings, emptyTexts)).toBe(false);
    expect(surveyResponsesComplete(items, ratings, updateTextResponse(emptyTexts, "text_one", "짧은 설명"))).toBe(true);
  });

  it("uses teacher-configured survey labels and preserves added or deleted items", () => {
    const items = configuredSurveyItems(predictionSurveyItems, [
      { id: "pred_can_explain_concept", label: "나는 새 주제를 쉬운 말로 설명할 수 있다.", helper: "학생에게는 보조 설명으로 보입니다." },
      { id: "pred_custom_1", label: "나는 핵심 낱말을 예로 들어 설명할 수 있다." }
    ]);

    expect(items.map((item) => item.id)).toEqual(["pred_can_explain_concept", "pred_custom_1"]);
    expect(items[0]).toEqual({
      helper: "학생에게는 보조 설명으로 보입니다.",
      id: "pred_can_explain_concept",
      label: "나는 새 주제를 쉬운 말로 설명할 수 있다."
    });
    expect(items[1]?.label).toBe("나는 핵심 낱말을 예로 들어 설명할 수 있다.");
  });

  it("uses teacher-configured independent problems as the active problem sequence", () => {
    const problems = configuredIndependentProblems([
      { number: 1, title: "맞춤 자유 설명", prompt: "친구에게 이 개념을 설명하세요." },
      { number: 4, title: "맞춤 적용 판단", prompt: "새로운 상황에 적용해 보세요." }
    ]);

    expect(problems.map((problem) => problem.answerArtifactKind)).toEqual(["problem1", "problem4"]);
    expect(problems[0]).toEqual(expect.objectContaining({
      answerArtifactKind: "problem1",
      confidenceMeasureKind: "problem1_confidence",
      prompt: "친구에게 이 개념을 설명하세요.",
      title: "맞춤 자유 설명"
    }));
    expect(problems[1]).toEqual(expect.objectContaining({
      answerArtifactKind: "problem4",
      prompt: "새로운 상황에 적용해 보세요.",
      title: "맞춤 적용 판단"
    }));
    const firstProblem = problems[0];
    const secondProblem = problems[1];
    if (firstProblem === undefined || secondProblem === undefined) throw new Error("Expected two configured problems.");
    expect(nextProblemAfter(problems, firstProblem)).toBe(secondProblem);
  });

  it("reads survey and problem configuration from the understanding module", () => {
    const module = {
      independentProblems: [{ number: 2, title: "원리 맞춤", prompt: "작동 원리를 비교해 설명하세요." }],
      predictionSurveyItems: [{ id: "pred_can_apply_new_case", label: "나는 새 사례에 적용할 수 있다." }],
      version: "1.0"
    } as const;

    expect(predictionSurveyItemsForModule(module).at(-1)?.label).toBe("나는 새 사례에 적용할 수 있다.");
    expect(independentProblemsForModule(module)[0]?.title).toBe("원리 맞춤");
  });
});
