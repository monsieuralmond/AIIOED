import { UnderstandingCalibrationStages } from "../shared/research";
import type { UnderstandingCalibrationStage, UnderstandingTransferChoice } from "../shared/research";

export type LikertItem = {
  readonly helper?: string;
  readonly id: string;
  readonly label: string;
};

export const calibrationStageOrder: readonly UnderstandingCalibrationStage[] = [
  UnderstandingCalibrationStages.preSurvey,
  UnderstandingCalibrationStages.reading,
  UnderstandingCalibrationStages.chat,
  UnderstandingCalibrationStages.predictionSurvey,
  UnderstandingCalibrationStages.independentTasks,
  UnderstandingCalibrationStages.postTaskSurvey,
  UnderstandingCalibrationStages.chatReview,
  UnderstandingCalibrationStages.completed
];

export const calibrationStageLabels: Readonly<Record<UnderstandingCalibrationStage, string>> = {
  calibration_chat: "AI에게 질문하기",
  calibration_reading: "글 읽기",
  chat_review: "대화 다시 보기",
  completed: "완료",
  independent_tasks: "활동하기",
  post_task_survey: "활동 후 확인",
  pre_survey: "시작 전 확인",
  prediction_survey: "다음 활동 전 확인"
};

export const preSurveyItems: readonly LikertItem[] = [
  { id: "pre_heard", label: "나는 이 주제에 대해 들어본 적이 있다." },
  { id: "pre_can_describe", label: "나는 이 주제가 무엇인지 설명할 수 있다." },
  { id: "pre_can_explain_mechanism", label: "나는 이 주제의 원리나 이유를 설명할 수 있다." },
  { id: "pre_can_explain_boundary", label: "나는 이 주제의 한계를 설명할 수 있다." }
];

export const predictionSurveyItems: readonly LikertItem[] = [
  { id: "pred_can_describe", label: "나는 이 주제를 내 말로 설명할 수 있다." },
  { id: "pred_can_compare", label: "나는 비슷한 것과 다른 점을 비교할 수 있다." },
  { id: "pred_can_explain_mechanism", label: "나는 왜 그런지 이유를 설명할 수 있다." },
  { id: "pred_can_explain_boundary", label: "나는 언제 맞고 언제 조심해야 하는지 말할 수 있다." },
  { id: "pred_can_transfer", label: "나는 다른 상황에도 이 내용을 적용할 수 있다." }
];

export const postTaskSurveyItems: readonly LikertItem[] = [
  { id: "post_overestimated", label: "처음 생각보다 설명하기가 어려웠다." },
  { id: "post_difficult_to_explain", label: "아는 것과 설명하는 것은 다를 수 있다고 느꼈다." },
  { id: "post_ai_felt_clear_but_hard", label: "AI와 이야기할 때는 쉬워 보였지만 혼자 쓰니 어려운 부분이 있었다." },
  { id: "post_gap_awareness", label: "내가 더 확인해야 할 부분을 발견했다." },
  { id: "post_want_more_questions", label: "다음에는 AI에게 더 구체적으로 물어보고 싶다." }
];

export const chatReviewItems: readonly LikertItem[] = [
  { id: "review_missed_important", label: "대화 중 중요한 부분을 그냥 지나친 것 같다." },
  { id: "review_mistook_ai_as_understanding", label: "AI 설명이 명확해서 내가 안다고 느낀 부분이 있었다." },
  { id: "review_should_have_asked_more", label: "더 물어봤다면 내 답이 나아졌을 것 같다." },
  { id: "review_missing_in_my_answer", label: "내 답에 빠진 부분이 보인다." }
];

export const defaultErrorStatement = "양자컴퓨터는 모든 문제를 일반 컴퓨터보다 빠르게 해결한다.";

export const defaultIndependentTasks: readonly string[] = [
  "컴퓨터를 잘 모르는 친구에게 이 주제가 무엇인지 쉽게 설명해 주세요.",
  "아래 문장이 맞는지 판단하고 이유를 적어 주세요.",
  "새로운 상황에 가장 잘 적용되는 설명을 고르고 이유를 적어 주세요."
];

export const defaultTransferChoices: readonly UnderstandingTransferChoice[] = [
  { id: "A", label: "A", text: "글에서 본 단어를 그대로 다시 말한다." },
  { id: "B", label: "B", text: "핵심 원리를 새로운 예에 맞추어 설명한다." },
  { id: "C", label: "C", text: "AI가 말한 내용을 기억나는 대로 길게 적는다." },
  { id: "D", label: "D", text: "잘 모르겠다고 쓰고 넘어간다." }
];

export const isCalibrationStage = (stage: string): stage is UnderstandingCalibrationStage => calibrationStageOrder.some((item) => item === stage);

export const emptyRatings = (items: readonly LikertItem[]): Readonly<Record<string, number>> =>
  Object.fromEntries(items.map((item) => [item.id, 0]));

export const updateRating = (ratings: Readonly<Record<string, number>>, id: string, value: number): Readonly<Record<string, number>> => ({ ...ratings, [id]: value });

export const ratingsComplete = (items: readonly LikertItem[], ratings: Readonly<Record<string, number>>): boolean =>
  items.every((item) => {
    const value = ratings[item.id];
    return value !== undefined && value >= 1 && value <= 5;
  });
