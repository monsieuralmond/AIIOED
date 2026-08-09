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
export type CalibrationAudienceLevel = "adult_pilot" | "elementary_pilot" | "elementary_main";

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
  readonly answerArtifactKind: `problem${1 | 2 | 3 | 4 | 5}`;
  readonly confidenceMeasureKind: `problem${1 | 2 | 3 | 4 | 5}_confidence`;
  readonly confidenceStage: UnderstandingCalibrationStage;
  readonly constructKey?: string;
  readonly itemRole?: "core_performance" | "empathy_reasoning" | (string & {});
  readonly number: 1 | 2 | 3 | 4 | 5;
  readonly postSurveyItems: readonly LikertItem[];
  readonly prompt: string;
  readonly stage: UnderstandingCalibrationStage;
  readonly taskConstruct: UnderstandingTaskConstruct;
  readonly title: string;
};

export type IndependentProblemPrompt = UnderstandingProblemPrompt;

export const K_ALIGN_PROTOCOL_VERSION = "k_align_closed_book_v1";
export const K_ALIGN_AUDIENCE_LEVEL = "adult_pilot";
export const K_ALIGN_QUESTION_SET_VERSION = "quantum_adult_v1";
export const K_ALIGN_ELEMENTARY_QUESTION_SET_VERSION = "quantum_elementary_v1";
export const K_ALIGN_KS_VERSION = "quantum_ks_v1";
export const K_ALIGN_CONSTRUCT_FRAMEWORK_VERSION = "k_align_constructs_v1";
export const K_ALIGN_RUBRIC_VERSION = "pending";

export const calibrationAudienceOptions: readonly { readonly description: string; readonly label: string; readonly value: CalibrationAudienceLevel }[] = [
  { description: "교사 연수나 성인 파일럿에서 사용합니다.", label: "성인 파일럿", value: "adult_pilot" },
  { description: "초등학생 대상 예비 실험에서 사용합니다.", label: "초등학생 파일럿", value: "elementary_pilot" },
  { description: "초등학생 본 실험에서 사용합니다.", label: "초등학생 본실험", value: "elementary_main" }
];

export const isCalibrationAudienceLevel = (value: string): value is CalibrationAudienceLevel =>
  calibrationAudienceOptions.some((option) => option.value === value);

export const normalizedCalibrationAudienceLevel = (value: string | undefined): CalibrationAudienceLevel =>
  value !== undefined && isCalibrationAudienceLevel(value) ? value : K_ALIGN_AUDIENCE_LEVEL;

export const questionSetVersionForAudience = (audienceLevel: string | undefined): string =>
  normalizedCalibrationAudienceLevel(audienceLevel) === "adult_pilot" ? K_ALIGN_QUESTION_SET_VERSION : K_ALIGN_ELEMENTARY_QUESTION_SET_VERSION;

export const confidencePrompt = {
  label: "방금 작성한 답변이 평가 기준에 비추어 얼마나 잘 작성되었다고 생각합니까?"
} as const;

export const postProblemSurveyItems: readonly LikertItem[] = [
  { helper: "0 = 전혀 잘 작성되지 않았다 / 100 = 매우 잘 작성되었다", id: "confidence", label: confidencePrompt.label, responseType: "slider_0_100" }
];

export const adultIndependentProblems: readonly IndependentProblem[] = [
  {
    activityKey: ResearchActivityKeys.coreExplanation,
    answerArtifactKind: "problem1",
    confidenceMeasureKind: "problem1_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem1Confidence,
    constructKey: "conceptual_explanation",
    itemRole: "core_performance",
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
    constructKey: "conceptual_interpretation",
    itemRole: "core_performance",
    number: 2,
    postSurveyItems: postProblemSurveyItems,
    prompt: "두 학생이 양자컴퓨터를 설명했습니다.\n\n학생 A\n\"양자컴퓨터는 CPU 성능이 좋아서 빠르다.\"\n\n학생 B\n\"양자컴퓨터는 일반 컴퓨터와 다른 정보 처리 방식을 사용하기 때문에 특정 문제에서 유리하다.\"\n\n더 적절한 설명을 선택하고 그 이유를 설명하세요.",
    stage: UnderstandingCalibrationStages.problem2,
    taskConstruct: UnderstandingTaskConstructs.mechanismExplanation,
    title: "설명 해석"
  },
  {
    activityKey: ResearchActivityKeys.misconceptionCorrection,
    answerArtifactKind: "problem3",
    confidenceMeasureKind: "problem3_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem3Confidence,
    constructKey: "conditional_application",
    itemRole: "core_performance",
    number: 3,
    postSurveyItems: postProblemSurveyItems,
    prompt: "다음 상황 중 양자컴퓨터가 가장 도움이 될 가능성이 높은 상황을 하나 선택하고 그 이유를 설명하세요.\n\n① 사진 100장의 크기를 줄이는 작업\n② 매우 많은 후보 가운데 좋은 조합을 찾아야 하는 복잡한 최적화 문제\n③ 인터넷 문서의 맞춤법 검사",
    stage: UnderstandingCalibrationStages.problem3,
    taskConstruct: UnderstandingTaskConstructs.misconceptionCorrection,
    title: "적용 판단"
  },
  {
    activityKey: ResearchActivityKeys.applicationJudgment,
    answerArtifactKind: "problem4",
    confidenceMeasureKind: "problem4_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem4Confidence,
    constructKey: "evidence_based_judgment",
    itemRole: "core_performance",
    number: 4,
    postSurveyItems: postProblemSurveyItems,
    prompt: "다음 주장에 대해 어떻게 생각합니까?\n\n\"양자컴퓨터가 개발되면 기존 컴퓨터는 모두 양자컴퓨터로 대체될 것이다.\"\n\n주장의 타당한 측면과 한계가 있는 측면을 모두 고려하여 설명하세요.",
    stage: UnderstandingCalibrationStages.problem4,
    taskConstruct: UnderstandingTaskConstructs.applicationJudgment,
    title: "관점 판단"
  },
  {
    activityKey: ResearchActivityKeys.applicationJudgment,
    answerArtifactKind: "problem5",
    confidenceMeasureKind: "problem5_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem5Confidence,
    constructKey: "epistemic_misconception_reasoning",
    itemRole: "empathy_reasoning",
    number: 5,
    postSurveyItems: postProblemSurveyItems,
    prompt: "왜 많은 사람들이\n\n\"양자컴퓨터는 모든 문제를 빠르게 푼다.\"\n\n라고 생각하게 되었을까요?\n\n그 이유를 설명하세요.",
    stage: UnderstandingCalibrationStages.problem5,
    taskConstruct: UnderstandingTaskConstructs.applicationJudgment,
    title: "오개념 이유 설명"
  }
];

export const elementaryIndependentProblems: readonly IndependentProblem[] = [
  {
    activityKey: ResearchActivityKeys.coreExplanation,
    answerArtifactKind: "problem1",
    confidenceMeasureKind: "problem1_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem1Confidence,
    constructKey: "conceptual_explanation",
    itemRole: "core_performance",
    number: 1,
    postSurveyItems: postProblemSurveyItems,
    prompt: "친구가 \"양자컴퓨터가 뭐야?\"라고 물었습니다.\n\n친구가 이해할 수 있도록 자신의 말로 쉽게 설명하세요.",
    stage: UnderstandingCalibrationStages.problem1,
    taskConstruct: UnderstandingTaskConstructs.coreExplanation,
    title: "쉽게 설명하기"
  },
  {
    activityKey: ResearchActivityKeys.mechanismExplanation,
    answerArtifactKind: "problem2",
    confidenceMeasureKind: "problem2_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem2Confidence,
    constructKey: "conceptual_interpretation",
    itemRole: "core_performance",
    number: 2,
    postSurveyItems: postProblemSurveyItems,
    prompt: "두 친구가 양자컴퓨터를 설명했습니다.\n\n친구 A\n\"양자컴퓨터는 부품이 더 좋아서 빠른 컴퓨터야.\"\n\n친구 B\n\"양자컴퓨터는 보통 컴퓨터와 다른 방식으로 정보를 다뤄서 어떤 문제에서 도움이 돼.\"\n\n누구의 설명이 더 알맞은지 고르고, 왜 그렇게 생각하는지 설명하세요.",
    stage: UnderstandingCalibrationStages.problem2,
    taskConstruct: UnderstandingTaskConstructs.mechanismExplanation,
    title: "설명 고르기"
  },
  {
    activityKey: ResearchActivityKeys.misconceptionCorrection,
    answerArtifactKind: "problem3",
    confidenceMeasureKind: "problem3_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem3Confidence,
    constructKey: "conditional_application",
    itemRole: "core_performance",
    number: 3,
    postSurveyItems: postProblemSurveyItems,
    prompt: "다음 중 양자컴퓨터가 가장 도움이 될 가능성이 큰 일을 하나 고르고, 이유를 설명하세요.\n\n① 사진 100장의 크기를 줄이기\n② 아주 많은 방법 중에서 좋은 조합 찾기\n③ 글의 맞춤법 검사하기",
    stage: UnderstandingCalibrationStages.problem3,
    taskConstruct: UnderstandingTaskConstructs.misconceptionCorrection,
    title: "어울리는 상황 찾기"
  },
  {
    activityKey: ResearchActivityKeys.applicationJudgment,
    answerArtifactKind: "problem4",
    confidenceMeasureKind: "problem4_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem4Confidence,
    constructKey: "evidence_based_judgment",
    itemRole: "core_performance",
    number: 4,
    postSurveyItems: postProblemSurveyItems,
    prompt: "어떤 사람이 이렇게 말했습니다.\n\n\"양자컴퓨터가 생기면 지금 쓰는 컴퓨터는 모두 사라질 거야.\"\n\n이 말에서 맞다고 볼 수 있는 부분과 조심해서 생각해야 할 부분을 함께 설명하세요.",
    stage: UnderstandingCalibrationStages.problem4,
    taskConstruct: UnderstandingTaskConstructs.applicationJudgment,
    title: "주장 판단하기"
  },
  {
    activityKey: ResearchActivityKeys.applicationJudgment,
    answerArtifactKind: "problem5",
    confidenceMeasureKind: "problem5_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem5Confidence,
    constructKey: "epistemic_misconception_reasoning",
    itemRole: "empathy_reasoning",
    number: 5,
    postSurveyItems: postProblemSurveyItems,
    prompt: "왜 어떤 사람들은\n\n\"양자컴퓨터는 모든 문제를 빠르게 풀 수 있다.\"\n\n라고 생각하게 될까요?\n\n그렇게 생각하는 이유를 설명하세요.",
    stage: UnderstandingCalibrationStages.problem5,
    taskConstruct: UnderstandingTaskConstructs.applicationJudgment,
    title: "오해가 생긴 이유"
  }
];

export const independentProblems = adultIndependentProblems;

export const independentProblemsForAudience = (audienceLevel: string | undefined): readonly IndependentProblem[] =>
  normalizedCalibrationAudienceLevel(audienceLevel) === "adult_pilot" ? adultIndependentProblems : elementaryIndependentProblems;

export const calibrationStageOrder: readonly UnderstandingCalibrationStage[] = [
  UnderstandingCalibrationStages.preSurvey,
  UnderstandingCalibrationStages.guide,
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
  UnderstandingCalibrationStages.problem5,
  UnderstandingCalibrationStages.problem5Confidence,
  UnderstandingCalibrationStages.selfKnowledge,
  UnderstandingCalibrationStages.overallSelfEvaluation,
  UnderstandingCalibrationStages.reflectionSurvey,
  UnderstandingCalibrationStages.completed
];

export const calibrationStageLabels: Readonly<Record<UnderstandingCalibrationStage, string>> = {
  calibration_chat: "AI에게 질문하기",
  calibration_guide: "안내",
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
  problem_5: "문제 5",
  problem_5_confidence: "직후 확인",
  self_knowledge: "자기 점검",
  overall_self_evaluation: "전체 자기평가",
  reflection_survey: "활동 돌아보기"
};

export const preSurveyItems: readonly LikertItem[] = [
  { id: "pre_heard", label: "나는 {topic}에 대해 들어본 적이 있다." },
  { helper: "0 = 전혀 이해하지 못했다 / 100 = 매우 잘 이해하고 있다", id: "prior_understanding_confidence", label: "현재 {topic} 내용을 얼마나 이해하고 있다고 생각합니까?", responseType: "slider_0_100" },
  { helper: "{topic}에 대해 현재 떠오르는 생각을 자유롭게 써 보세요.", id: "pre_free_response", label: "{topic}에 대해 현재 알고 있는 내용을 써 보세요.", responseType: "text" }
];

export const predictionSurveyItems: readonly LikertItem[] = [
  { id: "ready_to_start", label: "현재 문제를 해결할 준비가 되었다고 생각합니까?", responseType: "yes_no" },
  { helper: "0 = 전혀 이해하지 못했다 / 100 = 매우 잘 이해하고 있다", id: "understanding_0_100", label: "현재 이 내용을 얼마나 이해했다고 생각합니까?", responseType: "slider_0_100" }
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
  { id: "reflection_ai_helped", label: "AI와의 대화가 이해에 도움이 되었습니까?", responseType: "text" },
  { id: "reflection_most_helpful_question", label: "가장 도움이 되었던 질문은 무엇이었습니까?", responseType: "text" },
  { id: "reflection_memorize_or_understand", label: "답을 외우려고 했습니까? 아니면 이해하려고 했습니까?", responseType: "text" },
  { id: "reflection_next_question", label: "다시 한다면 AI에게 무엇을 다르게 질문하겠습니까?", responseType: "text" }
];

export const selfKnowledgePrompt =
  "AI와 대화하기 전과 비교했을 때 처음 생각과 달라진 점은 무엇입니까?\n\n아직도 이해되지 않는 부분이 있다면 무엇입니까?";

export const overallSelfEvaluationItem: LikertItem = {
  helper: "0 = 전혀 잘 수행하지 못했다 / 100 = 매우 잘 수행했다",
  id: "overall_self_evaluation",
  label: "전체적으로 이번 평가를 얼마나 잘 수행했다고 생각합니까?",
  responseType: "slider_0_100"
};

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

export const configuredIndependentProblems = (configured: readonly UnderstandingProblemPrompt[] | undefined, audienceLevel: string | undefined = K_ALIGN_AUDIENCE_LEVEL): readonly IndependentProblem[] => {
  const defaults = independentProblemsForAudience(audienceLevel);
  return (
  configured === undefined
    ? defaults
    : configured.flatMap((problem) => {
        const defaultProblem = defaults.find((candidate) => candidate.number === problem.number);
        return defaultProblem === undefined
          ? []
          : [{
              ...defaultProblem,
              ...(problem.constructKey === undefined ? {} : { constructKey: problem.constructKey }),
              ...(problem.itemRole === undefined ? {} : { itemRole: problem.itemRole }),
              postSurveyItems: configuredSurveyItems(postProblemSurveyItems, problem.postSurveyItems),
              prompt: problem.prompt,
              title: problem.title
            }];
      })
  );
};

export const preSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(preSurveyItems, module?.preSurveyItems);

export const predictionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(predictionSurveyItems, module?.predictionSurveyItems);

export const reflectionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(reflectionSurveyItems, module?.reflectionSurveyItems);

export const finalReflectionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(finalReflectionSurveyItems, module?.finalReflectionSurveyItems);

export const independentProblemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly IndependentProblem[] =>
  configuredIndependentProblems(module?.independentProblems, module?.audienceLevel);

export const confidenceValueFromPostSurvey = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>): number | null => {
  const directConfidence = ratings["confidence"];
  if (typeof directConfidence === "number" && directConfidence >= 0 && directConfidence <= 100) return directConfidence;
  const firstLikertItem = items.find((item) => surveyResponseType(item) === "likert" || surveyResponseType(item) === "slider_0_100");
  if (firstLikertItem === undefined) return null;
  const value = ratings[firstLikertItem.id];
  return typeof value === "number" && value >= 0 && value <= 100 ? value : null;
};

export const problemForStage = (problems: readonly IndependentProblem[], stage: UnderstandingCalibrationStage): IndependentProblem | undefined =>
  problems.find((problem) => problem.stage === stage);

export const problemForConfidenceStage = (problems: readonly IndependentProblem[], stage: UnderstandingCalibrationStage): IndependentProblem | undefined =>
  problems.find((problem) => problem.confidenceStage === stage);

export const nextProblemAfter = (problems: readonly IndependentProblem[], problem: IndependentProblem): IndependentProblem | undefined =>
  problems[problems.findIndex((item) => item.number === problem.number) + 1];

export const isCalibrationStage = (stage: string): stage is UnderstandingCalibrationStage => calibrationStageOrder.some((item) => item === stage);

export const emptyRatings = (items: readonly LikertItem[]): Readonly<Record<string, number>> =>
  Object.fromEntries(items.filter((item) => surveyResponseType(item) !== "text").map((item) => [item.id, -1]));

export const emptyTextResponses = (items: readonly LikertItem[]): Readonly<Record<string, string>> =>
  Object.fromEntries(items.filter((item) => surveyResponseType(item) === "text").map((item) => [item.id, ""]));

export const updateRating = (ratings: Readonly<Record<string, number>>, id: string, value: number): Readonly<Record<string, number>> => ({ ...ratings, [id]: value });

export const updateTextResponse = (responses: Readonly<Record<string, string>>, id: string, value: string): Readonly<Record<string, string>> => ({ ...responses, [id]: value });

export const ratingsComplete = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>): boolean =>
  items.filter((item) => surveyResponseType(item) !== "text").every((item) => {
    const value = ratings[item.id];
    if (surveyResponseType(item) === "likert") return value !== undefined && value >= 1 && value <= 5;
    if (surveyResponseType(item) === "slider_0_100") return value !== undefined && value >= 0 && value <= 100;
    if (surveyResponseType(item) === "yes_no") return value === 0 || value === 1;
    return false;
  });

export const textResponsesComplete = (items: readonly LikertItem[], responses: Readonly<Record<string, string>>): boolean =>
  items.filter((item) => surveyResponseType(item) === "text").every((item) => (responses[item.id] ?? "").trim().length > 0);

export const surveyResponsesComplete = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>, textResponses: Readonly<Record<string, string>>): boolean =>
  ratingsComplete(items, ratings) && textResponsesComplete(items, textResponses);
