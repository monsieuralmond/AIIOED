import { independentProblemsForModule } from "../app/understanding-calibration-data.js";
import { ResearchPlatformVersions, ResearchActivityKeys, ResearchJudgmentTypes, ResearchSystemEventTypes } from "../shared/research-platform.js";
import type { ResearchActivity, ResearchActivityKey, ResearchActivityType, ResearchExportManifest, ResearchJudgment, ResearchModelBundle, ResearchReadyIssue, ResearchReadyReport, ResearchResponse, ResearchSystemEvent, ResearchSystemEventType } from "../shared/research-platform.js";
import { UnderstandingCalibrationStages } from "../shared/research.js";
import type { ResearchArtifact, ResearchMeasure } from "../shared/research.js";
import type { ChatTurn, PilotEvent, PilotSession } from "../shared/types.js";

type ActivitySpec = {
  readonly activityKey: ResearchActivityKey;
  readonly activityType: ResearchActivityType;
  readonly construct: string;
  readonly sequence: number;
  readonly sourceStage: string;
  readonly title: string;
};

type BundleDraft = Omit<ResearchModelBundle, "ready"> & {
  readonly sessionBundle: PilotSession;
};

const defaultPromptVersionId = ResearchPlatformVersions.promptBundleVersion;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const stringValue = (payload: Readonly<Record<string, unknown>>, key: string): string => {
  const value = payload[key];
  return typeof value === "string" ? value : "";
};
const numberValue = (payload: Readonly<Record<string, unknown>>, key: string): number | null => {
  const value = payload[key];
  return isFiniteNumber(value) ? value : null;
};
const jsonText = (value: Readonly<Record<string, unknown>>): string => {
  const serialized = JSON.stringify(value);
  return serialized === "{}" ? "" : serialized;
};
const timestampMs = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const promptVersionId = (payload: Readonly<Record<string, unknown>> | undefined): string => {
  const value = payload?.["promptVersion"];
  return typeof value === "string" && value.trim().length > 0 ? value : defaultPromptVersionId;
};

export const researchExportManifest = (exportedAt: string): ResearchExportManifest => ({
  ...ResearchPlatformVersions,
  exportedAt
});

const activitySpecs = (session: PilotSession): readonly ActivitySpec[] => [
  { activityKey: ResearchActivityKeys.preSurvey, activityType: "survey", construct: "baseline_self_report", sequence: 1, sourceStage: UnderstandingCalibrationStages.preSurvey, title: "사전 설문" },
  { activityKey: ResearchActivityKeys.readingPassage, activityType: "reading", construct: "source_reading", sequence: 2, sourceStage: UnderstandingCalibrationStages.reading, title: "읽기 자료" },
  { activityKey: ResearchActivityKeys.aiChat, activityType: "chat", construct: "ai_supported_learning", sequence: 3, sourceStage: UnderstandingCalibrationStages.chat, title: "AI 대화" },
  { activityKey: ResearchActivityKeys.predictionSurvey, activityType: "survey", construct: "performance_prediction", sequence: 4, sourceStage: UnderstandingCalibrationStages.predictionSurvey, title: "수행 예측 설문" },
  ...independentProblemsForModule(session.modules.understandingCalibration).map((problem) => ({
    activityKey: problem.activityKey,
    activityType: "task",
    construct: problem.taskConstruct,
    sequence: problem.number + 4,
    sourceStage: problem.stage,
    title: problem.title
  }) satisfies ActivitySpec),
  { activityKey: ResearchActivityKeys.postPerformanceReflection, activityType: "survey", construct: "post_performance_reflection", sequence: 9, sourceStage: UnderstandingCalibrationStages.reflectionSurvey, title: "수행 후 돌아보기" },
  { activityKey: ResearchActivityKeys.chatReview, activityType: "reflection", construct: "chat_review", sequence: 10, sourceStage: UnderstandingCalibrationStages.chatReview, title: "대화 다시 보기" },
  { activityKey: ResearchActivityKeys.chatReviewReflection, activityType: "survey", construct: "chat_review_reflection", sequence: 11, sourceStage: UnderstandingCalibrationStages.finalReflection, title: "마무리 생각" }
];

const activityKeyForStage = (session: PilotSession, stage: string): ResearchActivityKey => {
  const problem = independentProblemsForModule(session.modules.understandingCalibration).find((item) => item.stage === stage || item.confidenceStage === stage);
  if (problem !== undefined) return problem.activityKey;
  if (stage === UnderstandingCalibrationStages.reading) return ResearchActivityKeys.readingPassage;
  if (stage === UnderstandingCalibrationStages.chat) return ResearchActivityKeys.aiChat;
  if (stage === UnderstandingCalibrationStages.predictionSurvey) return ResearchActivityKeys.predictionSurvey;
  if (stage === UnderstandingCalibrationStages.reflectionSurvey) return ResearchActivityKeys.postPerformanceReflection;
  if (stage === UnderstandingCalibrationStages.chatReview) return ResearchActivityKeys.chatReview;
  if (stage === UnderstandingCalibrationStages.finalReflection) return ResearchActivityKeys.chatReviewReflection;
  return ResearchActivityKeys.preSurvey;
};

const timesForStage = (session: PilotSession, stage: string): readonly string[] => [
  ...session.events.filter((event) => event.stage === stage).map((event) => event.timestamp),
  ...session.artifacts.filter((artifact) => artifact.stage === stage).map((artifact) => artifact.createdAt),
  ...session.measures.filter((measure) => measure.stage === stage).map((measure) => measure.collectedAt),
  ...session.chatTurns.filter((turn) => turn.timestamp.length > 0 && stage === UnderstandingCalibrationStages.chat).map((turn) => turn.timestamp)
].sort((left, right) => timestampMs(left) - timestampMs(right));

const activitiesFromSession = (session: PilotSession): readonly ResearchActivity[] =>
  activitySpecs(session).map((spec) => {
    const times = timesForStage(session, spec.sourceStage);
    const first = times[0] ?? "";
    const last = times.at(-1) ?? "";
    return {
      activityId: `${session.sessionId}:activity:${spec.activityKey}`,
      activityKey: spec.activityKey,
      activityType: spec.activityType,
      completedAt: last,
      construct: spec.construct,
      promptVersionId: defaultPromptVersionId,
      sequence: spec.sequence,
      sourceStage: spec.sourceStage,
      startedAt: first,
      title: spec.title
    };
  });

const textFromSurvey = (payload: Readonly<Record<string, unknown>>): string => {
  const textResponses = payload["textResponses"];
  if (typeof textResponses !== "object" || textResponses === null || Array.isArray(textResponses)) return "";
  return Object.values(textResponses).filter((item): item is string => typeof item === "string" && item.trim().length > 0).join("\n");
};

const responseForMeasure = (session: PilotSession, measure: ResearchMeasure): ResearchResponse => ({
  activityKey: activityKeyForStage(session, measure.stage),
  actorType: "student",
  format: textFromSurvey(measure.payload).length > 0 ? "mixed_survey" : "likert_map",
  itemId: `${measure.id}:response`,
  promptVersionId: promptVersionId(measure.payload),
  responseJson: measure.payload,
  responseText: textFromSurvey(measure.payload),
  sessionId: session.sessionId,
  sourceRecordId: measure.id,
  submittedAt: measure.collectedAt
});

const responseForArtifact = (session: PilotSession, artifact: ResearchArtifact): ResearchResponse => ({
  activityKey: activityKeyForStage(session, artifact.stage),
  actorType: "student",
  format: "free_text",
  itemId: `${artifact.id}:response`,
  promptVersionId: promptVersionId(artifact.payload),
  responseJson: artifact.payload,
  responseText: stringValue(artifact.payload, "answer") || stringValue(artifact.payload, "text"),
  sessionId: session.sessionId,
  sourceRecordId: artifact.id,
  submittedAt: artifact.createdAt
});

const responseForChatTurn = (session: PilotSession, turn: ChatTurn): ResearchResponse => ({
  activityKey: ResearchActivityKeys.aiChat,
  actorType: turn.role,
  format: "chat",
  itemId: `${turn.id}:response`,
  promptVersionId: defaultPromptVersionId,
  responseJson: turn.responseType === undefined ? {} : { responseType: turn.responseType },
  responseText: turn.text,
  sessionId: session.sessionId,
  sourceRecordId: turn.id,
  submittedAt: turn.timestamp
});

const responsesFromSession = (session: PilotSession): readonly ResearchResponse[] => [
  ...session.measures.map((measure) => responseForMeasure(session, measure)),
  ...session.artifacts.map((artifact) => responseForArtifact(session, artifact)),
  ...session.chatTurns.map((turn) => responseForChatTurn(session, turn))
];

const judgmentsFromSession = (session: PilotSession): readonly ResearchJudgment[] =>
  independentProblemsForModule(session.modules.understandingCalibration).flatMap((problem) => {
    const measure = session.measures.find((item) => item.kind === problem.confidenceMeasureKind);
    if (measure === undefined) return [];
    const confidence = numberValue(measure.payload, "confidence");
    return [{
      activityKey: problem.activityKey,
      itemId: `${measure.id}:judgment:confidence`,
      judgmentType: ResearchJudgmentTypes.confidence,
      promptVersionId: promptVersionId(measure.payload),
      scaleMax: 5,
      scaleMin: 1,
      sessionId: session.sessionId,
      sourceRecordId: measure.id,
      submittedAt: measure.collectedAt,
      valueNumeric: confidence,
      valueText: confidence === null ? "" : String(confidence)
    }];
  });

const eventTypeForLegacy = (event: PilotEvent): ResearchSystemEventType => {
  if (event.type === "calibration_study_completed") return ResearchSystemEventTypes.sessionCompleted;
  if (event.type.endsWith("_started") || event.type === "question_started" || event.type === "confidence_started") return ResearchSystemEventTypes.activityStarted;
  if (event.type.endsWith("_completed")) return ResearchSystemEventTypes.activityCompleted;
  if (event.type === "confidence_submitted") return ResearchSystemEventTypes.judgmentSubmitted;
  if (event.type === "calibration_chat_turn_created" || event.type.endsWith("_submitted") || event.type === "question_submitted") return ResearchSystemEventTypes.responseSubmitted;
  return ResearchSystemEventTypes.systemError;
};

const systemEventsFromSession = (session: PilotSession): readonly ResearchSystemEvent[] => [
  ...session.events.map((event): ResearchSystemEvent => ({
    activityKey: activityKeyForStage(session, event.stage),
    actorType: "system",
    eventId: event.id,
    eventType: eventTypeForLegacy(event),
    payloadJson: event.payload,
    sessionId: session.sessionId,
    sourceLegacyType: event.type,
    timestamp: event.timestamp
  })),
  ...session.artifacts.map((artifact): ResearchSystemEvent => ({
    activityKey: activityKeyForStage(session, artifact.stage),
    actorType: "system",
    eventId: `${artifact.id}:artifact_created`,
    eventType: ResearchSystemEventTypes.artifactCreated,
    payloadJson: artifact.payload,
    sessionId: session.sessionId,
    sourceLegacyType: `artifact:${artifact.kind}`,
    timestamp: artifact.createdAt
  })),
  ...session.measures.map((measure): ResearchSystemEvent => ({
    activityKey: activityKeyForStage(session, measure.stage),
    actorType: "system",
    eventId: `${measure.id}:measure_submitted`,
    eventType: measure.kind.endsWith("_confidence") ? ResearchSystemEventTypes.judgmentSubmitted : ResearchSystemEventTypes.responseSubmitted,
    payloadJson: measure.payload,
    sessionId: session.sessionId,
    sourceLegacyType: `measure:${measure.kind}`,
    timestamp: measure.collectedAt
  }))
].sort((left, right) => timestampMs(left.timestamp) - timestampMs(right.timestamp));

const readyReport = (bundle: BundleDraft): ResearchReadyReport => {
  const activityKeys = new Set(bundle.activities.map((activity) => activity.activityKey));
  const responseKeys = new Set(bundle.responses.filter((response) => response.responseText.length > 0 || jsonText(response.responseJson).length > 0).map((response) => response.activityKey));
  const judgmentKeys = new Set(bundle.judgments.filter((judgment) => judgment.judgmentType === "confidence" && judgment.valueNumeric !== null).map((judgment) => judgment.activityKey));
  const taskKeys = independentProblemsForModule(bundle.sessionBundle.modules.understandingCalibration).map((problem) => problem.activityKey);
  const requiredResponseKeys = [ResearchActivityKeys.preSurvey, ResearchActivityKeys.aiChat, ResearchActivityKeys.predictionSurvey, ...taskKeys, ResearchActivityKeys.postPerformanceReflection, ResearchActivityKeys.chatReviewReflection];
  const issues: ResearchReadyIssue[] = [
    ...activitySpecs(bundle.sessionBundle).filter((spec) => !activityKeys.has(spec.activityKey)).map((spec) => ({ code: "missing_activity", message: `${spec.activityKey} activity가 없습니다.`, severity: "error" }) satisfies ResearchReadyIssue),
    ...requiredResponseKeys.filter((key) => !responseKeys.has(key)).map((key) => ({ code: "missing_response", message: `${key} response가 없습니다.`, severity: "error" }) satisfies ResearchReadyIssue),
    ...taskKeys.filter((key) => !judgmentKeys.has(key)).map((key) => ({ code: "missing_confidence_judgment", message: `${key} confidence judgment가 없습니다.`, severity: "error" }) satisfies ResearchReadyIssue),
    ...(bundle.session.studentAnonymousId.length === 0 ? [{ code: "missing_participant", message: "participantAnonId가 없습니다.", severity: "error" } satisfies ResearchReadyIssue] : [])
  ];
  return { isReady: issues.every((issue) => issue.severity !== "error"), issues };
};

export const buildResearchModelBundle = (session: PilotSession, exportedAt: string): ResearchModelBundle => {
  const draft: BundleDraft = {
    activities: activitiesFromSession(session),
    assignment: {
      assignmentId: session.assignment.id,
      classGroupId: session.assignment.classGroupId ?? "",
      promptText: session.assignment.question,
      title: session.assignment.title
    },
    judgments: judgmentsFromSession(session),
    manifest: researchExportManifest(exportedAt),
    participant: {
      classGroupId: session.assignment.classGroupId ?? "",
      participantAnonId: session.student.anonymousId,
      studentAnonymousId: session.student.anonymousId
    },
    responses: responsesFromSession(session),
    session: {
      assignmentId: session.assignment.id,
      classGroupId: session.assignment.classGroupId ?? "",
      completedAt: session.completedAt ?? "",
      currentStage: session.currentStage,
      researchCondition: session.researchCondition,
      researchMode: session.researchMode,
      sessionId: session.sessionId,
      startedAt: session.createdAt,
      status: session.status,
      studentAnonymousId: session.student.anonymousId,
      updatedAt: session.updatedAt
    },
    sessionBundle: session,
    systemEvents: systemEventsFromSession(session),
    topic: {
      sourceText: session.modules.understandingCalibration?.sourceText ?? session.assignment.passage,
      topicId: session.modules.understandingCalibration?.topic ?? session.assignment.title,
      title: session.modules.understandingCalibration?.topic ?? session.assignment.title
    }
  };
  return {
    activities: draft.activities,
    assignment: draft.assignment,
    judgments: draft.judgments,
    manifest: draft.manifest,
    participant: draft.participant,
    ready: readyReport(draft),
    responses: draft.responses,
    session: draft.session,
    systemEvents: draft.systemEvents,
    topic: draft.topic
  };
};
