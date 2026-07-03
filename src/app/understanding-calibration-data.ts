import { UnderstandingCalibrationStages } from "../shared/research";
import type { UnderstandingCalibrationModule, UnderstandingCalibrationStage, UnderstandingProblemPrompt, UnderstandingSurveyItem } from "../shared/research";

export {
  problemRubrics,
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_PROTOCOL_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION
} from "./understanding-calibration-rubric";
export type { ProblemRubric, RubricCode, RubricScore } from "./understanding-calibration-rubric";

export type LikertItem = UnderstandingSurveyItem;

const topicPlaceholder = "{topic}";

export const surveyItemsForTopic = (items: readonly LikertItem[], topic: string): readonly LikertItem[] =>
  items.map((item) => ({
    ...item,
    label: item.label.replaceAll(topicPlaceholder, topic)
  }));

export type IndependentProblem = {
  readonly answerArtifactKind: "problem1" | "problem2" | "problem3" | "problem4";
  readonly confidenceMeasureKind: "problem1_confidence" | "problem2_confidence" | "problem3_confidence" | "problem4_confidence";
  readonly confidenceStage: UnderstandingCalibrationStage;
  readonly number: 1 | 2 | 3 | 4;
  readonly prompt: string;
  readonly stage: UnderstandingCalibrationStage;
  readonly title: string;
};

export type IndependentProblemPrompt = UnderstandingProblemPrompt;

export const independentProblems: readonly IndependentProblem[] = [
  {
    answerArtifactKind: "problem1",
    confidenceMeasureKind: "problem1_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem1Confidence,
    number: 1,
    prompt: "초등학교 6학년 동생이 \"양자컴퓨터가 뭐야?\"라고 물었습니다.\n\n동생이 이해할 수 있도록 자신의 말로 쉽게 설명하세요.",
    stage: UnderstandingCalibrationStages.problem1,
    title: "자유 설명"
  },
  {
    answerArtifactKind: "problem2",
    confidenceMeasureKind: "problem2_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem2Confidence,
    number: 2,
    prompt: "동생이 \"그런데 왜 그렇게 빠른 거야?\"라고 다시 물었습니다.\n\n일반 컴퓨터와 양자컴퓨터가 정보를 처리하는 방식의 차이를 중심으로 설명하세요.",
    stage: UnderstandingCalibrationStages.problem2,
    title: "원리 설명"
  },
  {
    answerArtifactKind: "problem3",
    confidenceMeasureKind: "problem3_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem3Confidence,
    number: 3,
    prompt: "친구가 말했습니다.\n\n\"양자컴퓨터는 모든 문제를 엄청 빨리 푸는 컴퓨터야.\"\n\n맞는 부분과 틀린 부분을 구분하여 설명하고 더 정확하게 고쳐주세요.",
    stage: UnderstandingCalibrationStages.problem3,
    title: "오개념 수정"
  },
  {
    answerArtifactKind: "problem4",
    confidenceMeasureKind: "problem4_confidence",
    confidenceStage: UnderstandingCalibrationStages.problem4Confidence,
    number: 4,
    prompt: "어떤 사람이 이렇게 말했습니다.\n\n\"계산이 복잡한 문제라면 양자컴퓨터를 쓰면 무조건 더 좋겠네.\"\n\n이 말에 대해 어떻게 생각하는지 설명하세요.\n\n양자컴퓨터가 도움이 될 수 있는 경우와 그렇지 않을 수도 있는 경우를 함께 설명하세요.",
    stage: UnderstandingCalibrationStages.problem4,
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
  problem_1_confidence: "확신도",
  problem_2: "문제 2",
  problem_2_confidence: "확신도",
  problem_3: "문제 3",
  problem_3_confidence: "확신도",
  problem_4: "문제 4",
  problem_4_confidence: "확신도",
  reflection_survey: "활동 돌아보기"
};

export const preSurveyItems: readonly LikertItem[] = [
  { id: "pre_heard", label: "나는 {topic}에 대해 들어본 적이 있다." },
  { id: "pre_can_describe", label: "나는 {topic}의 개념을 설명할 수 있다." },
  { id: "pre_can_explain_mechanism", label: "나는 {topic}의 원리나 이유를 설명할 수 있다." },
  { id: "pre_can_explain_boundary", label: "나는 {topic}의 한계를 설명할 수 있다." }
];

export const predictionSurveyItems: readonly LikertItem[] = [
  { id: "pred_can_explain_concept", label: "나는 {topic}을 쉽게 설명할 수 있다." },
  { id: "pred_can_explain_mechanism", label: "나는 {topic}의 작동 원리를 설명할 수 있다." },
  { id: "pred_can_correct_misconception", label: "나는 {topic}에 대한 잘못된 설명을 바로잡을 수 있다." },
  { id: "pred_can_apply_new_case", label: "나는 {topic}을 새로운 상황에 적용해 판단할 수 있다." }
];

export const confidencePrompt = {
  highLabel: "매우 자신 있음",
  label: "방금 작성한 답에 대해, 지금 어느 정도 자신 있나요?",
  lowLabel: "전혀 자신 없음"
} as const;

export const reflectionSurveyItems: readonly LikertItem[] = [
  { id: "reflection_initial_estimate", label: "활동 전에는 내가 더 잘 이해했다고 생각했다." },
  { id: "reflection_explaining_harder", label: "직접 설명하려니 생각보다 어려웠다." },
  { id: "reflection_chat_clear_expression_hard", label: "AI와 대화할 때는 알 것 같았지만 직접 표현하려니 부족한 부분이 있었다." },
  { id: "reflection_performance_harder", label: "내가 생각한 것보다 실제 수행이 어려웠다." },
  { id: "reflection_more_questions", label: "다시 AI와 대화할 수 있다면 더 질문하고 싶은 부분이 있다." }
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
        return defaultProblem === undefined ? [] : [{ ...defaultProblem, prompt: problem.prompt, title: problem.title }];
      });

export const preSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(preSurveyItems, module?.preSurveyItems);

export const predictionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(predictionSurveyItems, module?.predictionSurveyItems);

export const reflectionSurveyItemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly LikertItem[] =>
  configuredSurveyItems(reflectionSurveyItems, module?.reflectionSurveyItems);

export const independentProblemsForModule = (module: UnderstandingCalibrationModule | undefined): readonly IndependentProblem[] =>
  configuredIndependentProblems(module?.independentProblems);

export const problemForStage = (problems: readonly IndependentProblem[], stage: UnderstandingCalibrationStage): IndependentProblem | undefined =>
  problems.find((problem) => problem.stage === stage);

export const problemForConfidenceStage = (problems: readonly IndependentProblem[], stage: UnderstandingCalibrationStage): IndependentProblem | undefined =>
  problems.find((problem) => problem.confidenceStage === stage);

export const nextProblemAfter = (problems: readonly IndependentProblem[], problem: IndependentProblem): IndependentProblem | undefined =>
  problems[problems.findIndex((item) => item.number === problem.number) + 1];

export const isCalibrationStage = (stage: string): stage is UnderstandingCalibrationStage => calibrationStageOrder.some((item) => item === stage);

export const emptyRatings = (items: readonly LikertItem[]): Readonly<Record<string, number>> =>
  Object.fromEntries(items.map((item) => [item.id, 0]));

export const updateRating = (ratings: Readonly<Record<string, number>>, id: string, value: number): Readonly<Record<string, number>> => ({ ...ratings, [id]: value });

export const ratingsComplete = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>): boolean =>
  items.every((item) => {
    const value = ratings[item.id];
    return value !== undefined && value >= 1 && value <= 5;
  });
