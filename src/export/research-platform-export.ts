import { ResearchActivityKeys } from "../shared/research-platform.js";
import type { ResearchActivityKey, ResearchModelBundle } from "../shared/research-platform.js";
import type { PilotSession, PilotState } from "../shared/types.js";
import { buildResearchModelBundle } from "./research-platform-model.js";

type ExportOptions = {
  readonly completedOnly?: boolean;
  readonly exportedAt?: string;
};

type CsvRow = Readonly<Record<string, string>>;

const value = (input: unknown): string => {
  const text = typeof input === "string" ? input : input === null || input === undefined ? "" : String(input);
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const csv = (columns: readonly string[], rows: readonly CsvRow[]): string =>
  [columns.join(","), ...rows.map((row) => columns.map((column) => value(row[column])).join(","))].join("\n");

const json = (input: unknown): string => JSON.stringify(input);

const includeSession = (session: PilotSession, options: ExportOptions | undefined): boolean =>
  !(options?.completedOnly ?? false) || session.status === "submitted" || session.status === "completed";

const bundleSessions = (sessions: readonly PilotSession[], options?: ExportOptions): readonly ResearchModelBundle[] => {
  const exportedAt = options?.exportedAt ?? new Date().toISOString();
  return sessions.filter((session) => includeSession(session, options)).map((session) => buildResearchModelBundle(session, exportedAt));
};

export const buildResearchModelBundles = (state: PilotState, options?: ExportOptions): readonly ResearchModelBundle[] =>
  bundleSessions(state.sessions, options);

export const buildResearchModelBundlesFromSessions = (sessions: readonly PilotSession[], options?: ExportOptions): readonly ResearchModelBundle[] =>
  bundleSessions(sessions, options);

const activityType = (bundle: ResearchModelBundle, activityKey: ResearchActivityKey): string =>
  bundle.activities.find((activity) => activity.activityKey === activityKey)?.activityType ?? "";

const construct = (bundle: ResearchModelBundle, activityKey: ResearchActivityKey): string =>
  bundle.activities.find((activity) => activity.activityKey === activityKey)?.construct ?? "";

export const exportResearchRawEventRowsFromBundles = (bundles: readonly ResearchModelBundle[]): readonly CsvRow[] =>
  bundles.flatMap((bundle) => bundle.systemEvents.map((event) => ({
    activityKey: event.activityKey,
    actorType: event.actorType,
    assignmentId: bundle.assignment.assignmentId,
    classGroupId: bundle.assignment.classGroupId,
    eventId: event.eventId,
    eventType: event.eventType,
    exportManifestVersion: bundle.manifest.exportManifestVersion,
    participantAnonId: bundle.participant.participantAnonId,
    payloadJson: json(event.payloadJson),
    protocolVersion: bundle.manifest.protocolVersion,
    schemaVersion: bundle.manifest.schemaVersion,
    sessionId: bundle.session.sessionId,
    sourceLegacyType: event.sourceLegacyType,
    studentAnonymousId: bundle.participant.studentAnonymousId,
    taxonomyVersion: bundle.manifest.taxonomyVersion,
    timestamp: event.timestamp,
    topicId: bundle.topic.topicId
  })));

export const exportResearchItemLongRowsFromBundles = (bundles: readonly ResearchModelBundle[]): readonly CsvRow[] =>
  bundles.flatMap((bundle) => [
    ...bundle.responses.map((response) => ({
      activityKey: response.activityKey,
      activityType: activityType(bundle, response.activityKey),
      actorType: response.actorType,
      assignmentId: bundle.assignment.assignmentId,
      classGroupId: bundle.assignment.classGroupId,
      construct: construct(bundle, response.activityKey),
      itemId: response.itemId,
      itemKind: "response",
      participantAnonId: bundle.participant.participantAnonId,
      payloadJson: json(response.responseJson),
      promptVersionId: response.promptVersionId,
      responseFormat: response.format,
      responseText: response.responseText,
      sessionId: bundle.session.sessionId,
      sourceRecordId: response.sourceRecordId,
      studentAnonymousId: bundle.participant.studentAnonymousId,
      submittedAt: response.submittedAt,
      topicId: bundle.topic.topicId,
      valueNumeric: "",
      valueText: ""
    })),
    ...bundle.judgments.map((judgment) => ({
      activityKey: judgment.activityKey,
      activityType: activityType(bundle, judgment.activityKey),
      actorType: "student",
      assignmentId: bundle.assignment.assignmentId,
      classGroupId: bundle.assignment.classGroupId,
      construct: construct(bundle, judgment.activityKey),
      itemId: judgment.itemId,
      itemKind: judgment.judgmentType,
      participantAnonId: bundle.participant.participantAnonId,
      payloadJson: json({ scaleMax: judgment.scaleMax, scaleMin: judgment.scaleMin }),
      promptVersionId: judgment.promptVersionId,
      responseFormat: "",
      responseText: "",
      sessionId: bundle.session.sessionId,
      sourceRecordId: judgment.sourceRecordId,
      studentAnonymousId: bundle.participant.studentAnonymousId,
      submittedAt: judgment.submittedAt,
      topicId: bundle.topic.topicId,
      valueNumeric: judgment.valueNumeric === null ? "" : String(judgment.valueNumeric),
      valueText: judgment.valueText
    }))
  ]);

const wideActivityKeys: readonly ResearchActivityKey[] = [
  ResearchActivityKeys.preSurvey,
  ResearchActivityKeys.readingPassage,
  ResearchActivityKeys.aiChat,
  ResearchActivityKeys.predictionSurvey,
  ResearchActivityKeys.coreExplanation,
  ResearchActivityKeys.mechanismExplanation,
  ResearchActivityKeys.misconceptionCorrection,
  ResearchActivityKeys.applicationJudgment,
  ResearchActivityKeys.postPerformanceReflection,
  ResearchActivityKeys.chatReview,
  ResearchActivityKeys.chatReviewReflection
];

const wideColumns = [
  "sessionId", "participantAnonId", "studentAnonymousId", "assignmentId", "classGroupId", "topicId", "researchMode", "researchCondition", "status", "currentStage", "startedAt", "updatedAt", "completedAt", "schemaVersion", "taxonomyVersion", "protocolVersion", "promptBundleVersion", "exportManifestVersion", "researchReady", "researchReadyIssueCount",
  ...wideActivityKeys.flatMap((key) => [`${key}__response_text`, `${key}__response_json`, `${key}__judgment_confidence`])
];

export const exportResearchSessionWideRowsFromBundles = (bundles: readonly ResearchModelBundle[]): readonly CsvRow[] =>
  bundles.map((bundle) => {
    const row: Record<string, string> = {
      assignmentId: bundle.assignment.assignmentId,
      classGroupId: bundle.assignment.classGroupId,
      completedAt: bundle.session.completedAt,
      currentStage: bundle.session.currentStage,
      exportManifestVersion: bundle.manifest.exportManifestVersion,
      participantAnonId: bundle.participant.participantAnonId,
      promptBundleVersion: bundle.manifest.promptBundleVersion,
      protocolVersion: bundle.manifest.protocolVersion,
      researchCondition: bundle.session.researchCondition,
      researchMode: bundle.session.researchMode,
      researchReady: String(bundle.ready.isReady),
      researchReadyIssueCount: String(bundle.ready.issues.length),
      schemaVersion: bundle.manifest.schemaVersion,
      sessionId: bundle.session.sessionId,
      startedAt: bundle.session.startedAt,
      status: bundle.session.status,
      studentAnonymousId: bundle.participant.studentAnonymousId,
      taxonomyVersion: bundle.manifest.taxonomyVersion,
      topicId: bundle.topic.topicId,
      updatedAt: bundle.session.updatedAt
    };
    wideActivityKeys.forEach((key) => {
      const responses = bundle.responses.filter((response) => response.activityKey === key);
      const confidence = bundle.judgments.find((judgment) => judgment.activityKey === key && judgment.judgmentType === "confidence");
      row[`${key}__response_text`] = responses.map((response) => response.responseText).filter((text) => text.length > 0).join("\n\n");
      row[`${key}__response_json`] = json(responses.map((response) => response.responseJson));
      row[`${key}__judgment_confidence`] = confidence?.valueText ?? "";
    });
    return row;
  });

const rawEventColumns = ["sessionId", "participantAnonId", "studentAnonymousId", "assignmentId", "classGroupId", "topicId", "activityKey", "eventType", "actorType", "timestamp", "sourceLegacyType", "eventId", "payloadJson", "schemaVersion", "taxonomyVersion", "protocolVersion", "exportManifestVersion"];
const itemLongColumns = ["sessionId", "participantAnonId", "studentAnonymousId", "assignmentId", "classGroupId", "topicId", "activityKey", "activityType", "construct", "itemKind", "itemId", "actorType", "responseFormat", "responseText", "valueNumeric", "valueText", "promptVersionId", "submittedAt", "sourceRecordId", "payloadJson"];

export const stringifyResearchRawEventsCsv = (state: PilotState, options?: ExportOptions): string =>
  csv(rawEventColumns, exportResearchRawEventRowsFromBundles(buildResearchModelBundles(state, options)));

export const stringifyResearchItemLongCsv = (state: PilotState, options?: ExportOptions): string =>
  csv(itemLongColumns, exportResearchItemLongRowsFromBundles(buildResearchModelBundles(state, options)));

export const stringifyResearchSessionWideCsv = (state: PilotState, options?: ExportOptions): string =>
  csv(wideColumns, exportResearchSessionWideRowsFromBundles(buildResearchModelBundles(state, options)));

export const stringifyResearchBenchmarkJsonl = (state: PilotState, options?: ExportOptions): string =>
  buildResearchModelBundles(state, options).map((bundle) => JSON.stringify(bundle)).join("\n");

export const researchPlatformFilesFromSessions = (sessions: readonly PilotSession[], options?: ExportOptions): Readonly<Record<"benchmark.jsonl" | "item-long.csv" | "raw-events.csv" | "session-wide.csv", string>> => {
  const bundles = buildResearchModelBundlesFromSessions(sessions, options);
  return {
    "benchmark.jsonl": bundles.map((bundle) => JSON.stringify(bundle)).join("\n"),
    "item-long.csv": csv(itemLongColumns, exportResearchItemLongRowsFromBundles(bundles)),
    "raw-events.csv": csv(rawEventColumns, exportResearchRawEventRowsFromBundles(bundles)),
    "session-wide.csv": csv(wideColumns, exportResearchSessionWideRowsFromBundles(bundles))
  };
};
