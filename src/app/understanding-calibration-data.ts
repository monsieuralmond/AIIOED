import { UnderstandingCalibrationStages } from "../shared/research.js";
import type { UnderstandingCalibrationModule, UnderstandingCalibrationStage, UnderstandingProblemPrompt, UnderstandingSurveyItem } from "../shared/research.js";
import { ResearchActivityKeys, UnderstandingTaskConstructs } from "../shared/research-platform.js";
import type { ResearchActivityKey, UnderstandingTaskConstruct } from "../shared/research-platform.js";

export {
  problemRubrics,
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_PROTOCOL_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION
} from "./understanding-calibration-rubric.js";
export type { ProblemRubric, RubricCode, RubricScore } from "./understanding-calibration-rubric.js";

export type LikertItem = UnderstandingSurveyItem;
export type SurveyResponseType = NonNullable<UnderstandingSurveyItem["responseType"]>;

const topicPlaceholder = "{topic}";

export const surveyItemsForTopic = (items: readonly LikertItem[], topic: string): readonly LikertItem[] =>
  items.map((item) => ({
    ...item,
    ...(item.helper === undefined ? {} : { helper: item.helper.replaceAll(topicPlaceholder, topic) }),
    label: item.label.replaceAll(topicPlaceholder, topic)
  }));

export const surveyResponseType = (item: UnderstandingSurveyItem): SurveyResponseType => item.responseType ?? "likert";

export type IndependentProblem = {
  readonly activityKey: ResearchActivityKey;
  readonly answerArtifactKind: "problem1" | "problem2" | "problem3" | "problem4";
  readonly confidenceMeasureKind: "problem1_confidence" | "problem2_confidence" | "problem3_confidence" | "problem4_confidence";
  readonly confidenceStage: UnderstandingCalibrationStage;
  readonly number: 1 | 2 | 3 | 4;
  readonly postSurveyItems: readonly LikertItem[];
  readonly prompt: string;
  readonly stage: UnderstandingCalibrationStage;
  readonly taskConstruct: UnderstandingTaskConstruct;
  readonly title: string;
};

export type IndependentProblemPrompt = UnderstandingProblemPrompt;

export const confidencePrompt = {
  label: "방금 답변에 얼마나 확신하나요?"
} as const;

export const postProblemSurveyItems: readonly LikertItem[] = [
  { id: "confidence", label: confidencePrompt.label }
];

export const independentProblems: readonly IndependentProblem[] = [
  {
    activityKey: ResearchActivityKeys.coreExplanation,
    answerArtifactKind: "problem1",
    confidenceMeasureKind: "problem1_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem1Confidence,
    number: 1,
    postSurveyItems: postProblemSurveyItems,
    prompt: "초등학교 6학년 동생이 \"양자컴퓨터가 뭐야?\"라고 물었습니다.\n\n동생이 이해할 수 있도록 자신의 말로 쉽게 설명하세요.",
    stage: UnderstandingCalibrationStages.problem1,
    taskConstruct: UnderstandingTaskConstructs.coreExplanation,
    title: "자유 설명"
  },
  {
    activityKey: ResearchActivityKeys.mechanismExplanation,
    answerArtifactKind: "problem2",
    confidenceMeasureKind: "problem2_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem2Confidence,
    number: 2,
    postSurveyItems: postProblemSurveyItems,
    prompt: "동생이 \"그런데 왜 그렇게 빠른 거야?\"라고 다시 물었습니다.\n\n일반 컴퓨터와 양자컴퓨터가 정보를 처리하는 방식의 차이를 중심으로 설명하세요.",
    stage: UnderstandingCalibrationStages.problem2,
    taskConstruct: UnderstandingTaskConstructs.mechanismExplanation,
    title: "원리 설명"
  },
  {
    activityKey: ResearchActivityKeys.misconceptionCorrection,
    answerArtifactKind: "problem3",
    confidenceMeasureKind: "problem3_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem3Confidence,
    number: 3,
    postSurveyItems: postProblemSurveyItems,
    prompt: "친구가 말했습니다.\n\n\"양자컴퓨터는 모든 문제를 엄청 빨리 푸는 컴퓨터야.\"\n\n맞는 부분과 틀린 부분을 구분하여 설명하고 더 정확하게 고쳐주세요.",
    stage: UnderstandingCalibrationStages.problem3,
    taskConstruct: UnderstandingTaskConstructs.misconceptionCorrection,
    title: "오개념 수정"
  },
  {
    activityKey: ResearchActivityKeys.applicationJudgment,
    answerArtifactKind: "problem4",
    confidenceMeasureKind: "problem4_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem4Confidence,
    number: 4,
    postSurveyItems: postProblemSurveyItems,
    prompt: "어떤 사람이 이렇게 말했습니다.\n\n\"계산이 복잡한 문제라면 양자컴퓨터를 쓰면 무조건 더 좋겠네.\"\n\n이 말에 대해 어떻게 생각하는지 설명하세요.\n\n양자컴퓨터가 도움이 될 수 있는 경우와 그렇지 않을 수도 있는 경우를 함께 설명하세요.",
    stage: UnderstandingCalibrationStages.problem4,
    taskConstruct: UnderstandingTaskConstructs.applicationJudgment,
    title: "적용 판단"
  }
];

export const calibrationStageOrder: readonly UnderstandingCalibrationStage[] = [
  UnderstandingCalibrationStages.preSurvey,
  UnderstandingCalibrationStages.reading,
  UnderstandingCalibrationStages.chat,
  UnderstandingCalibrationStages.predictionSurvey,
  UnderstandingCalibrationStages.problem1,
  UnderstandingCalibrationStages.problem1Confidence,
  UnderstandingCalibrationStages.problem2,
  UnderstandingCalibrationStages.problem2Confidence,
  UnderstandingCalibrationStages.problem3,
  UnderstandingCalibrationStages.problem3Confidence,
  UnderstandingCalibrationStages.problem4,
  UnderstandingCalibrationStages.problem4Confidence,
  UnderstandingCalibrationStages.reflectionSurvey,
  UnderstandingCalibrationStages.chatReview,
  UnderstandingCalibrationStages.finalReflection,
  UnderstandingCalibrationStages.completed
];

export const calibrationStageLabels: Readonly<Record<UnderstandingCalibrationStage, string>> = {
  calibration_chat: "AI에게 질문하기",
  calibration_reading: "글 읽기",
  chat_review: "대화 다시 보기",
  completed: "완료",
  final_reflection: "마무리 생각",
  pre_survey: "시작 전 확인",
  prediction_survey: "다음 활동 전 확인",
  problem_1: "문제 1",
  problem_1_confidence: "직후 확인",
  problem_2: "문제 2",
  problem_2_confidence: "직후 확인",
  problem_3: "문제 3",
  problem_3_confidence: "직후 확인",
  problem_4: "문제 4",
  problem_4_confidence: "직후 확인",
  reflection_survey: "활동 돌아보기"
};

export const preSurveyItems: readonly LikertItem[] = [
  { id: "pre_heard", label: "나는 {topic}에 대해 들어본 적이 있다." },
  { id: "pre_can_describe", label: "나는 {topic}의 개념을 설명할 수 있다." },
  { id: "pre_can_explain_mechanism", label: "나는 {topic}의 원리나 이유를 설명할 수 있다." },
  { id: "pre_can_explain_boundary", label: "나는 {topic}의 한계를 설명할 수 있다." },
  { helper: "{topic}에 대해 현재 떠오르는 생각을 자유롭게 써 보세요.", id: "pre_free_response", label: "{topic}에 대해 현재 알고 있는 내용을 써 보세요.", responseType: "text" }
];

export const predictionSurveyItems: readonly LikertItem[] = [
  { id: "pred_can_explain_concept", label: "나는 {topic}을 쉽게 설명할 수 있다." },
  { id: "pred_can_explain_mechanism", label: "나는 {topic}의 작동 원리를 설명할 수 있다." },
  { id: "pred_can_correct_misconception", label: "나는 {topic}에 대한 잘못된 설명을 바로잡을 수 있다." },
  { id: "pred_can_apply_new_case", label: "나는 {topic}을 새로운 상황에 적용해 판단할 수 있다." }
];

export const confidencePromptLabelForModule = (module: UnderstandingCalibrationModule | undefined): string =>
  module?.confidencePromptLabel?.trim() ?? confidencePrompt.label;

export const confidenceScaleLabels: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: "전혀 확신하지 않는다",
  2: "확신하지 않는다",
  3: "보통이다",
  4: "확신한다",
  5: "매우 확신한다"
} as const;

export const reflectionSurveyItems: readonly LikertItem[] = [
  { id: "reflection_explaining_harder", label: "활동을 해 보니 생각보다 설명하기 어려운 부분이 있었다." },
  { id: "reflection_initial_estimate", label: "활동 전에는 내가 더 잘 이해하고 있다고 생각했다." },
  { id: "reflection_ai_clear_expression_gap", label: "AI와 대화할 때는 알 것 같았지만, 직접 표현하려니 부족한 부분이 있었다." },
  { id: "reflection_mechanism_harder", label: "주제의 원리나 작동 이유를 설명하는 것이 생각보다 어려웠다." },
  { id: "reflection_boundary_harder", label: "주제의 한계나 예외를 설명하는 것이 생각보다 어려웠다." },
  { id: "reflection_application_harder", label: "주제가 어떤 상황에 도움이 되는지 판단하는 것이 생각보다 어려웠다." },
  { id: "reflection_more_questions", label: "다시 AI와 대화할 수 있다면 더 질문하고 싶은 부분이 있다." },
  { id: "reflection_knowledge_boundary_clearer", label: "이번 활동을 통해 내가 정확히 아는 부분과 아직 모르는 부분을 더 잘 구분하게 되었다." },
  { id: "reflection_hardest_part", label: "활동을 하면서 가장 어렵게 느껴진 부분은 무엇이었나요?", responseType: "text" },
  { id: "reflection_expression_gap_text", label: "AI와 대화할 때는 알 것 같았지만, 막상 직접 설명하려니 부족하다고 느낀 부분이 있다면 써 보세요.", responseType: "text" }
];

export const finalReflectionSurveyItems: readonly LikertItem[] = [
  { id: "final_review_missed_important_content", label: "다시 보니 내가 놓친 중요한 내용이 있었다." },
  { id: "final_review_needs_check", label: "AI가 설명해 준 내용을 읽을 때는 이해한 것 같았지만, 실제로는 더 확인이 필요한 부분이 있었다." },
  { id: "final_review_should_ask_deeper", label: "내가 AI에게 더 깊이 질문했어야 하는 부분이 있었다." },
  { id: "final_review_answer_missing_content", label: "내 답변에서 빠진 중요한 내용이 있었다." },
  { id: "final_review_helped_boundary", label: "다시 본 AI 대화는 내가 무엇을 알고 무엇을 모르는지 확인하는 데 도움이 되었다." },
  { id: "final_review_helpful_part", label: "다시 본 AI 대화 중 가장 도움이 된 부분은 무엇이었나요?", responseType: "text" },
  { id: "final_review_needed_check", label: "다시 보니 더 확인했어야 한다고 느낀 부분은 무엇인가요?", responseType: "text" }
];

export const configuredSurveyItems = (defaults: readonly LikertItem[], configured: readonly UnderstandingSurveyItem[] | undefined): readonly LikertItem[] =>
  configured === undefined ? defaults : configured.map((item) => {
    const defaultItem = defaults.find((candidate) => candidate.id === item.id);
    return defaultItem === undefined ? item : { ...defaultItem, ...item };
  });

export const configuredIndependentProblems = (configured: readonly UnderstandingProblemPrompt[] | undefined): readonly IndependentProblem[] =>
  configured === undefined
    ? independentProblems
    : configured.flatMap((problem) => {
        const defaultProblem = independentProblems.find((candidate) => candidate.number === problem.number);
        return defaultProblem === undefined
          ? []
          : [{
              ...defaultProblem,
              postSurveyItems: configuredSurveyItems(postProblemSurveyItems, problem.postSurveyItems),
              prompt: problem.prompt,
              title: problem.title
            }];
      });

export const preSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(preSurveyItems, module?.preSurveyItems);

export const predictionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(predictionSurveyItems, module?.predictionSurveyItems);

export const reflectionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(reflectionSurveyItems, module?.reflectionSurveyItems);

export const finalReflectionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(finalReflectionSurveyItems, module?.finalReflectionSurveyItems);

export const independentProblemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly IndependentProblem[] =>
  configuredIndependentProblems(module?.independentProblems);

export const confidenceValueFromPostSurvey = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>): number | null => {
  const directConfidence = ratings["confidence"];
  if (typeof directConfidence === "number" && directConfidence >= 1 && directConfidence <= 5) return directConfidence;
  const firstLikertItem = items.find((item) => surveyResponseType(item) === "likert");
  if (firstLikertItem === undefined) return null;
  const value = ratings[firstLikertItem.id];
  return typeof value === "number" && value >= 1 && value <= 5 ? value : null;
};

export const problemForStage = (problems: readonly IndependentProblem[], stage: UnderstandingCalibrationStage): IndependentProblem | undefined =>
  problems.find((problem) => problem.stage === stage);

export const problemForConfidenceStage = (problems: readonly IndependentProblem[], stage: UnderstandingCalibrationStage): IndependentProblem | undefined =>
  problems.find((problem) => problem.confidenceStage === stage);

export const nextProblemAfter = (problems: readonly IndependentProblem[], problem: IndependentProblem): IndependentProblem | undefined =>
  problems[problems.findIndex((item) => item.number === problem.number) + 1];

export const isCalibrationStage = (stage: string): stage is UnderstandingCalibrationStage => calibrationStageOrder.some((item) => item === stage);

export const emptyRatings = (items: readonly LikertItem[]): Readonly<Record<string, number>> =>
  Object.fromEntries(items.filter((item) => surveyResponseType(item) === "likert").map((item) => [item.id, 0]));

export const emptyTextResponses = (items: readonly LikertItem[]): Readonly<Record<string, string>> =>
  Object.fromEntries(items.filter((item) => surveyResponseType(item) === "text").map((item) => [item.id, ""]));

export const updateRating = (ratings: Readonly<Record<string, number>>, id: string, value: number): Readonly<Record<string, number>> => ({ ...ratings, [id]: value });

export const updateTextResponse = (responses: Readonly<Record<string, string>>, id: string, value: string): Readonly<Record<string, string>> => ({ ...responses, [id]: value });

export const ratingsComplete = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>): boolean =>
  items.filter((item) => surveyResponseType(item) === "likert").every((item) => {
    const value = ratings[item.id];
    return value !== undefined && value >= 1 && value <= 5;
  });

export const textResponsesComplete = (items: readonly LikertItem[], responses: Readonly<Record<string, string>>): boolean =>
  items.filter((item) => surveyResponseType(item) === "text").every((item) => (responses[item.id] ?? "").trim().length > 0);

export const surveyResponsesComplete = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>, textResponses: Readonly<Record<string, string>>): boolean =>
  ratingsComplete(items, ratings) && textResponsesComplete(items, textResponses);
