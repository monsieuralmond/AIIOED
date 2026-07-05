import type { PilotEventType, PilotState } from "../shared/types.js";

type ResearchEventSpeaker = "assistant" | "student" | "system_event";

export type ResearchEventCsvRow = {
  readonly sessionId: string;
  readonly studentAnonymousId: string;
  readonly assignmentId: string;
  readonly researchMode: string;
  readonly researchCondition: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly timestamp: string;
  readonly stage: string;
  readonly speaker: ResearchEventSpeaker;
  readonly userMessage: string;
  readonly assistantMessage: string;
  readonly requestTags: string;
  readonly aiMode: string;
  readonly model: string;
  readonly payloadJson: string;
};

export type ResearchArtifactMeasureCsvRow = {
  readonly sessionId: string;
  readonly studentAnonymousId: string;
  readonly assignmentId: string;
  readonly researchMode: string;
  readonly researchCondition: string;
  readonly recordGroup: "artifact" | "measure";
  readonly recordId: string;
  readonly recordKind: string;
  readonly timestamp: string;
  readonly stage: string;
  readonly payloadJson: string;
};

const eventColumns: readonly (keyof ResearchEventCsvRow)[] = [
  "sessionId",
  "studentAnonymousId",
  "assignmentId",
  "researchMode",
  "researchCondition",
  "eventId",
  "eventType",
  "timestamp",
  "stage",
  "speaker",
  "userMessage",
  "assistantMessage",
  "requestTags",
  "aiMode",
  "model",
  "payloadJson"
];

const artifactMeasureColumns: readonly (keyof ResearchArtifactMeasureCsvRow)[] = [
  "sessionId",
  "studentAnonymousId",
  "assignmentId",
  "researchMode",
  "researchCondition",
  "recordGroup",
  "recordId",
  "recordKind",
  "timestamp",
  "stage",
  "payloadJson"
];

const csvValue = (value: string): string => `"${value.replaceAll("\"", "\"\"")}"`;

const payloadValue = (payload: Record<string, unknown>, key: string): string => {
  const value = payload[key];
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "" : serialized;
};

const payloadJson = (payload: Record<string, unknown>): string => {
  const serialized = JSON.stringify(payload);
  return serialized === undefined ? "{}" : serialized;
};

const speakerForEvent = (type: PilotEventType): ResearchEventSpeaker => {
  if (type === "student_message") return "student";
  if (type === "assistant_message") return "assistant";
  return "system_event";
};

export const exportResearchEventRows = (state: PilotState): readonly ResearchEventCsvRow[] =>
  state.sessions.flatMap((session) =>
    session.events.map((event): ResearchEventCsvRow => ({
      aiMode: payloadValue(event.payload, "aiMode"),
      assistantMessage: payloadValue(event.payload, "assistantMessage") || (event.type === "assistant_message" ? payloadValue(event.payload, "text") : ""),
      assignmentId: session.assignment.id,
      eventId: event.id,
      eventType: event.type,
      model: payloadValue(event.payload, "model"),
      payloadJson: payloadJson(event.payload),
      requestTags: payloadValue(event.payload, "requestTags"),
      researchCondition: session.researchCondition,
      researchMode: session.researchMode,
      sessionId: session.sessionId,
      speaker: speakerForEvent(event.type),
      stage: event.stage,
      studentAnonymousId: session.student.anonymousId,
      timestamp: event.timestamp,
      userMessage: payloadValue(event.payload, "userMessage") || (event.type === "student_message" ? payloadValue(event.payload, "text") : "")
    }))
  );

export const exportResearchArtifactMeasureRows = (state: PilotState): readonly ResearchArtifactMeasureCsvRow[] =>
  state.sessions.flatMap((session) => [
    ...session.artifacts.map((artifact): ResearchArtifactMeasureCsvRow => ({
      assignmentId: session.assignment.id,
      payloadJson: payloadJson(artifact.payload),
      recordGroup: "artifact",
      recordId: artifact.id,
      recordKind: artifact.kind,
      researchCondition: session.researchCondition,
      researchMode: session.researchMode,
      sessionId: session.sessionId,
      stage: artifact.stage,
      studentAnonymousId: session.student.anonymousId,
      timestamp: artifact.createdAt
    })),
    ...session.measures.map((measure): ResearchArtifactMeasureCsvRow => ({
      assignmentId: session.assignment.id,
      payloadJson: payloadJson(measure.payload),
      recordGroup: "measure",
      recordId: measure.id,
      recordKind: measure.kind,
      researchCondition: session.researchCondition,
      researchMode: session.researchMode,
      sessionId: session.sessionId,
      stage: measure.stage,
      studentAnonymousId: session.student.anonymousId,
      timestamp: measure.collectedAt
    }))
  ]);

const stringifyCsv = <Row extends Record<string, string>>(columns: readonly (keyof Row)[], rows: readonly Row[]): string =>
  [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column] ?? "")).join(","))
  ].join("\n");

export const stringifyResearchEventsCsv = (state: PilotState): string => stringifyCsv(eventColumns, exportResearchEventRows(state));

export const stringifyResearchArtifactMeasuresCsv = (state: PilotState): string => stringifyCsv(artifactMeasureColumns, exportResearchArtifactMeasureRows(state));
