import type { ResearchCondition, ResearchMode, ResearchSessionStatus } from "./research.js";

export const ResearchPlatformVersions = {
  derivedPipelineVersion: "research-platform-derived.v1",
  exportManifestVersion: "research-platform-export.v1",
  promptBundleVersion: "understanding-calibration-prompts.v1",
  protocolVersion: "understanding-calibration-protocol.v2",
  schemaVersion: "research-platform-schema.v1",
  taxonomyVersion: "research-platform-taxonomy.v1"
} as const;

export const ResearchActivityKeys = {
  aiChat: "ai_chat",
  applicationJudgment: "application_judgment",
  chatReview: "chat_review",
  chatReviewReflection: "chat_review_reflection",
  coreExplanation: "core_explanation",
  mechanismExplanation: "mechanism_explanation",
  misconceptionCorrection: "misconception_correction",
  postPerformanceReflection: "post_performance_reflection",
  predictionSurvey: "prediction_survey",
  preSurvey: "pre_survey",
  readingPassage: "reading_passage"
} as const;

export const ResearchSystemEventTypes = {
  activityCompleted: "activity_completed",
  activityStarted: "activity_started",
  artifactCreated: "artifact_created",
  judgmentSubmitted: "judgment_submitted",
  responseSubmitted: "response_submitted",
  sessionCompleted: "session_completed",
  sessionStarted: "session_started",
  systemError: "system_error"
} as const;

export const ResearchJudgmentTypes = {
  confidence: "confidence",
  selfPrediction: "self_prediction",
  selfReflection: "self_reflection"
} as const;

export const UnderstandingTaskConstructs = {
  applicationJudgment: "application_judgment",
  coreExplanation: "core_explanation",
  mechanismExplanation: "mechanism_explanation",
  misconceptionCorrection: "misconception_correction"
} as const;

export type ResearchActivityKey = (typeof ResearchActivityKeys)[keyof typeof ResearchActivityKeys] | (string & {});
export type ResearchSystemEventType = (typeof ResearchSystemEventTypes)[keyof typeof ResearchSystemEventTypes];
export type ResearchJudgmentType = (typeof ResearchJudgmentTypes)[keyof typeof ResearchJudgmentTypes] | (string & {});
export type ResearchActorType = "assistant" | "student" | "system";
export type ResearchActivityType = "chat" | "reading" | "reflection" | "survey" | "task";
export type ResearchResponseFormat = "chat" | "free_text" | "likert_map" | "mixed_survey";
export type UnderstandingTaskConstruct = (typeof UnderstandingTaskConstructs)[keyof typeof UnderstandingTaskConstructs];

export type ResearchExportManifest = {
  readonly derivedPipelineVersion: string;
  readonly exportManifestVersion: string;
  readonly exportedAt: string;
  readonly promptBundleVersion: string;
  readonly protocolVersion: string;
  readonly schemaVersion: string;
  readonly taxonomyVersion: string;
};

export type ResearchSessionEntity = {
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly completedAt: string;
  readonly currentStage: string;
  readonly researchCondition: ResearchCondition;
  readonly researchMode: ResearchMode;
  readonly sessionId: string;
  readonly startedAt: string;
  readonly status: ResearchSessionStatus;
  readonly studentAnonymousId: string;
  readonly updatedAt: string;
};

export type ResearchParticipantEntity = {
  readonly classGroupId: string;
  readonly participantAnonId: string;
  readonly studentAnonymousId: string;
};

export type ResearchTopicEntity = {
  readonly sourceText: string;
  readonly topicId: string;
  readonly title: string;
};

export type ResearchAssignmentEntity = {
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly promptText: string;
  readonly title: string;
};

export type ResearchActivity = {
  readonly activityId: string;
  readonly activityKey: ResearchActivityKey;
  readonly activityType: ResearchActivityType;
  readonly completedAt: string;
  readonly construct: string;
  readonly promptVersionId: string;
  readonly sequence: number;
  readonly sourceStage: string;
  readonly startedAt: string;
  readonly title: string;
};

export type ResearchResponse = {
  readonly activityKey: ResearchActivityKey;
  readonly actorType: ResearchActorType;
  readonly format: ResearchResponseFormat;
  readonly itemId: string;
  readonly promptVersionId: string;
  readonly responseJson: Record<string, unknown>;
  readonly responseText: string;
  readonly sessionId: string;
  readonly sourceRecordId: string;
  readonly submittedAt: string;
};

export type ResearchJudgment = {
  readonly activityKey: ResearchActivityKey;
  readonly itemId: string;
  readonly judgmentType: ResearchJudgmentType;
  readonly promptVersionId: string;
  readonly scaleMax: number;
  readonly scaleMin: number;
  readonly sessionId: string;
  readonly sourceRecordId: string;
  readonly submittedAt: string;
  readonly valueNumeric: number | null;
  readonly valueText: string;
};

export type ResearchSystemEvent = {
  readonly activityKey: ResearchActivityKey;
  readonly actorType: ResearchActorType;
  readonly eventId: string;
  readonly eventType: ResearchSystemEventType;
  readonly payloadJson: Record<string, unknown>;
  readonly sessionId: string;
  readonly sourceLegacyType: string;
  readonly timestamp: string;
};

export type ResearchReadyIssue = {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
};

export type ResearchReadyReport = {
  readonly isReady: boolean;
  readonly issues: readonly ResearchReadyIssue[];
};

export type ResearchModelBundle = {
  readonly activities: readonly ResearchActivity[];
  readonly assignment: ResearchAssignmentEntity;
  readonly judgments: readonly ResearchJudgment[];
  readonly manifest: ResearchExportManifest;
  readonly participant: ResearchParticipantEntity;
  readonly ready: ResearchReadyReport;
  readonly responses: readonly ResearchResponse[];
  readonly session: ResearchSessionEntity;
  readonly systemEvents: readonly ResearchSystemEvent[];
  readonly topic: ResearchTopicEntity;
};
