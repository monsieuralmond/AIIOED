export const ResearchModes = {
  guidedWriting: "guided_writing",
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

export const GuidedWritingStages = {
  completed: "guided_completed",
  feedback: "guided_feedback",
  material: "guided_material",
  outline: "guided_outline",
  sources: "guided_sources",
  topic: "guided_topic",
  writing: "guided_writing"
} as const;

export type GuidedWritingStage = (typeof GuidedWritingStages)[keyof typeof GuidedWritingStages];

export const UnderstandingCalibrationStages = {
  preSurvey: "pre_survey",
  guide: "calibration_guide",
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
  problem5: "problem_5",
  problem5Confidence: "problem_5_confidence",
  selfKnowledge: "self_knowledge",
  overallSelfEvaluation: "overall_self_evaluation",
  reflectionSurvey: "reflection_survey",
  chatReview: "chat_review",
  finalReflection: "final_reflection",
  completed: "completed"
} as const;

export type UnderstandingCalibrationStage = (typeof UnderstandingCalibrationStages)[keyof typeof UnderstandingCalibrationStages];

export type UnderstandingCalibrationEventType =
  | "calibration_pre_survey_submitted"
  | "calibration_guide_started"
  | "calibration_reading_started"
  | "calibration_reading_completed"
  | "calibration_chat_started"
  | "calibration_chat_turn_created"
  | "calibration_chat_failed"
  | "calibration_chat_completed"
  | "evaluation_gate_cancelled"
  | "evaluation_gate_confirmed"
  | "evaluation_gate_opened"
  | "evaluation_started"
  | "passage_locked"
  | "chat_locked"
  | "calibration_prediction_survey_submitted"
  | "pre_evaluation_submitted"
  | "calibration_chat_review_submitted"
  | "calibration_study_completed"
  | "question_started"
  | "question_submitted"
  | "confidence_started"
  | "confidence_submitted"
  | "self_knowledge_started"
  | "self_knowledge_submitted"
  | "overall_self_evaluation_started"
  | "overall_self_evaluation_submitted"
  | "reflection_started"
  | "reflection_submitted"
  | "chat_review_started"
  | "chat_review_submitted"
  | "final_reflection_submitted"
  | "irreversible_transition_cancelled"
  | "irreversible_transition_confirmed"
  | "irreversible_transition_prompt_shown";

export type UnderstandingTransferChoice = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

export type UnderstandingSurveyItem = {
  readonly helper?: string;
  readonly id: string;
  readonly label: string;
  readonly responseType?: "likert" | "slider_0_100" | "text" | "yes_no";
};

export type UnderstandingProblemPrompt = {
  readonly constructKey?: string;
  readonly itemRole?: "core_performance" | "empathy_reasoning" | (string & {});
  readonly number: 1 | 2 | 3 | 4 | 5;
  readonly postSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly prompt: string;
  readonly title: string;
};

export type UnderstandingCalibrationConfig = {
  readonly aiContext?: string;
  readonly audienceLevel?: "adult_pilot" | "elementary_pilot" | "elementary_main" | (string & {});
  readonly confidencePromptLabel?: string;
  readonly constructFrameworkVersion?: string;
  readonly errorStatement?: string;
  readonly finalReflectionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly independentProblems?: readonly UnderstandingProblemPrompt[];
  readonly independentTasks?: readonly string[];
  readonly ksVersion?: string;
  readonly maxChatMinutes?: number;
  readonly predictionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly protocolVersion?: string;
  readonly questionSetVersion?: string;
  readonly preSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly reflectionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly rubricVersion?: string;
  readonly selfKnowledgePrompt?: string;
  readonly overallSelfEvaluationPrompt?: string;
  readonly sourceText?: string;
  readonly topic?: string;
  readonly transferChoices?: readonly UnderstandingTransferChoice[];
};

export type UnderstandingCalibrationModule = {
  readonly aiContext?: string;
  readonly audienceLevel?: "adult_pilot" | "elementary_pilot" | "elementary_main" | (string & {});
  readonly confidencePromptLabel?: string;
  readonly constructFrameworkVersion?: string;
  readonly errorStatement?: string;
  readonly finalReflectionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly independentProblems?: readonly UnderstandingProblemPrompt[];
  readonly independentTasks?: readonly string[];
  readonly ksVersion?: string;
  readonly maxChatMinutes?: number;
  readonly predictionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly protocolVersion?: string;
  readonly questionSetVersion?: string;
  readonly preSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly reflectionSurveyItems?: readonly UnderstandingSurveyItem[];
  readonly rubricVersion?: string;
  readonly selfKnowledgePrompt?: string;
  readonly overallSelfEvaluationPrompt?: string;
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
