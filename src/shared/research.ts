export const ResearchModes = {
  understandingCalibration: "understanding_calibration",
  writingCoach: "writing_coach"
} as const;

export type KnownResearchMode = (typeof ResearchModes)[keyof typeof ResearchModes];

export type ResearchMode = KnownResearchMode | (string & {});

export type ResearchSessionStatus = "not_started" | "in_progress" | "submitted" | "completed" | (string & {});

export const UnderstandingCalibrationStages = {
  preSurvey: "pre_survey",
  reading: "calibration_reading",
  chat: "calibration_chat",
  predictionSurvey: "prediction_survey",
  independentTasks: "independent_tasks",
  postTaskSurvey: "post_task_survey",
  chatReview: "chat_review",
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
  | "calibration_independent_tasks_submitted"
  | "calibration_post_task_survey_submitted"
  | "calibration_chat_review_submitted"
  | "calibration_study_completed";

export type UnderstandingTransferChoice = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

export type UnderstandingCalibrationConfig = {
  readonly aiContext?: string;
  readonly errorStatement?: string;
  readonly independentTasks?: readonly string[];
  readonly maxChatMinutes?: number;
  readonly sourceText?: string;
  readonly topic?: string;
  readonly transferChoices?: readonly UnderstandingTransferChoice[];
};

export type UnderstandingCalibrationModule = {
  readonly aiContext?: string;
  readonly errorStatement?: string;
  readonly independentTasks?: readonly string[];
  readonly maxChatMinutes?: number;
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
