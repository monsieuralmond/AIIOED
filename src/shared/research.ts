export const ResearchModes = {
  understandingCalibration: "understanding_calibration",
  writingCoach: "writing_coach"
} as const;

export const ResearchConditions = {
  challenge: "challenge",
  evidenceCheck: "evidence_check",
  explanationRich: "explanation_rich",
  singleGroupBaseline: "single_group_baseline"
} as const;

export const ActiveResearchConditions = {
  singleGroupBaseline: ResearchConditions.singleGroupBaseline
} as const;

export type KnownResearchMode = (typeof ResearchModes)[keyof typeof ResearchModes];
export type KnownResearchCondition = (typeof ResearchConditions)[keyof typeof ResearchConditions];
export type ActiveResearchCondition = (typeof ActiveResearchConditions)[keyof typeof ActiveResearchConditions];

export type ResearchMode = KnownResearchMode | (string & {});
export type ResearchCondition = KnownResearchCondition | (string & {});

export const activeResearchCondition = (condition: ResearchCondition | undefined): ActiveResearchCondition => {
  switch (condition) {
    case ResearchConditions.singleGroupBaseline:
    case ResearchConditions.evidenceCheck:
    case ResearchConditions.challenge:
    case ResearchConditions.explanationRich:
    default:
      return ActiveResearchConditions.singleGroupBaseline;
  }
};

export type ResearchSessionStatus = "not_started" | "in_progress" | "submitted" | "completed" | (string & {});

export const UnderstandingCalibrationStages = {
  preSurvey: "pre_survey",
  reading: "calibration_reading",
  chat: "calibration_chat",
  predictionSurvey: "prediction_survey",
  problem1: "problem_1",
  problem1Confidence: "problem_1_confidence",
  problem2: "problem_2",
  problem2Confidence: "problem_2_confidence",
  problem3: "problem_3",
  problem3Confidence: "problem_3_confidence",
  problem4: "problem_4",
  problem4Confidence: "problem_4_confidence",
  reflectionSurvey: "reflection_survey",
  chatReview: "chat_review",
  finalReflection: "final_reflection",
  completed: "completed"
} as const;

export type UnderstandingCalibrationStage = (typeof UnderstandingCalibrationStages)[keyof typeof UnderstandingCalibrationStages];

export type UnderstandingCalibrationEventType =
  | "calibration_pre_survey_submitted"
  | "calibration_reading_started"
  | "calibration_reading_completed"
  | "calibration_chat_started"
  | "calibration_chat_turn_created"
  | "calibration_chat_completed"
  | "calibration_prediction_survey_submitted"
  | "calibration_chat_review_submitted"
  | "calibration_study_completed"
  | "question_started"
  | "question_submitted"
  | "confidence_submitted"
  | "reflection_submitted";

export type UnderstandingTransferChoice = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

export type UnderstandingSurveyItem = {
  readonly helper?: string;
  readonly id: string;
  readonly label: string;
};

export type UnderstandingProblemPrompt = {
  readonly number: 1 | 2 | 3 | 4;
  readonly prompt: string;
  readonly title: string;
};

export type UnderstandingCalibrationConfig = {
  readonly aiContext?: string;
  readonly errorStatement?: string;
  readonly independentProblems?: readonly UnderstandingProblemPrompt[];
  readonly independentTasks?: readonly string[];
  readonly maxChatMinutes?: number;
  readonly predictionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly preSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly reflectionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly sourceText?: string;
  readonly topic?: string;
  readonly transferChoices?: readonly UnderstandingTransferChoice[];
};

export type UnderstandingCalibrationModule = {
  readonly aiContext?: string;
  readonly errorStatement?: string;
  readonly independentProblems?: readonly UnderstandingProblemPrompt[];
  readonly independentTasks?: readonly string[];
  readonly maxChatMinutes?: number;
  readonly predictionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly preSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly reflectionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly stageRecords?: Readonly<Record<string, UnderstandingCalibrationStageRecord>>;
  readonly sourceText?: string;
  readonly topic?: string;
  readonly transferChoices?: readonly UnderstandingTransferChoice[];
  readonly version: "1.0";
};

export type UnderstandingCalibrationStageRecord = {
  readonly artifactIds?: readonly string[];
  readonly completedAt?: string;
  readonly eventIds?: readonly string[];
  readonly measureIds?: readonly string[];
  readonly stage: string;
  readonly submittedAt?: string;
};

export type ResearchArtifact = {
  readonly createdAt: string;
  readonly id: string;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly stage: string;
  readonly updatedAt?: string;
};

export type ResearchMeasure = {
  readonly collectedAt: string;
  readonly id: string;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly stage: string;
};

export type ResearchModules = {
  readonly understandingCalibration?: UnderstandingCalibrationModule;
  readonly [moduleKey: string]: unknown;
};
