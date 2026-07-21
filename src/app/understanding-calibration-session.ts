import type { ChatTurn, PilotEvent, PilotEventType, PilotSession, Stage } from "../shared/types.js";
import type { ResearchArtifact, ResearchMeasure, ResearchSessionStatus, UnderstandingCalibrationStageRecord } from "../shared/research.js";
import { UNDERSTANDING_CALIBRATION_PROMPT_VERSION } from "./understanding-calibration-data.js";

type NewArtifact = {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly stage?: Stage;
};

type NewMeasure = {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly stage?: Stage;
};

type CalibrationArtifact = ResearchArtifact & {
  readonly stage: Stage;
};

type CalibrationMeasure = ResearchMeasure & {
  readonly stage: Stage;
};

type NewEvent = {
  readonly payload?: Record<string, unknown>;
  readonly stage?: Stage;
  readonly type: PilotEventType;
};

export type CalibrationSessionUpdate = {
  readonly artifacts?: readonly NewArtifact[];
  readonly chatTurns?: readonly ChatTurn[];
  readonly completedAt?: string;
  readonly events?: readonly NewEvent[];
  readonly measures?: readonly NewMeasure[];
  readonly nextStage?: Stage;
  readonly stage: Stage;
  readonly status?: ResearchSessionStatus;
};

type FinalReflectionCompletionInput = {
  readonly completedAt: string;
  readonly ratings: Readonly<Record<string, number>>;
  readonly textResponses: Readonly<Record<string, string>>;
  readonly topic: string;
};

const nowIso = (): string => new Date().toISOString();

const makeId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;

export const makeCalibrationChatTurn = (role: ChatTurn["role"], text: string, responseType?: ChatTurn["responseType"]): ChatTurn => {
  const base = {
    id: makeId("chat"),
    role,
    text,
    timestamp: nowIso()
  };
  return responseType === undefined ? base : { ...base, responseType };
};

const sessionPayload = (session: PilotSession, stage: Stage, timestamp: string): Record<string, unknown> => ({
  assignmentId: session.assignment.id,
  classGroupId: session.assignment.classGroupId ?? "",
  researchMode: session.researchMode,
  sessionId: session.sessionId,
  stage,
  studentAnonymousId: session.student.anonymousId,
  timestamp,
  topicId: session.modules.understandingCalibration?.topic ?? session.assignment.title
});

const createEvent = (session: PilotSession, stage: Stage, input: NewEvent, timestamp: string): PilotEvent => {
  const eventStage = input.stage ?? stage;
  const id = makeId("event");
  return {
    id,
    payload: {
      ...(input.payload ?? {}),
      ...sessionPayload(session, eventStage, timestamp),
      eventId: id,
      type: input.type
    },
    stage: eventStage,
    timestamp,
    type: input.type
  };
};

const createArtifact = (session: PilotSession, stage: Stage, input: NewArtifact, timestamp: string): CalibrationArtifact => {
  const artifactStage = input.stage ?? stage;
  return {
    createdAt: timestamp,
    id: makeId("artifact"),
    kind: input.kind,
    payload: {
      ...input.payload,
      ...sessionPayload(session, artifactStage, timestamp)
    },
    stage: artifactStage
  };
};

const createMeasure = (session: PilotSession, stage: Stage, input: NewMeasure, timestamp: string): CalibrationMeasure => {
  const measureStage = input.stage ?? stage;
  return {
    collectedAt: timestamp,
    id: makeId("measure"),
    kind: input.kind,
    payload: {
      ...input.payload,
      ...sessionPayload(session, measureStage, timestamp)
    },
    stage: measureStage
  };
};

const uniqueStages = (stages: readonly Stage[]): readonly Stage[] => {
  const unique: Stage[] = [];
  for (const stage of stages) {
    if (!unique.includes(stage)) unique.push(stage);
  }
  return unique;
};

export const appendCalibrationRecords = (session: PilotSession, input: CalibrationSessionUpdate): PilotSession => {
  const timestamp = nowIso();
  const events = input.events?.map((item) => createEvent(session, input.stage, item, timestamp)) ?? [];
  const artifacts = input.artifacts?.map((item) => createArtifact(session, input.stage, item, timestamp)) ?? [];
  const measures = input.measures?.map((item) => createMeasure(session, input.stage, item, timestamp)) ?? [];
  const currentModule = session.modules.understandingCalibration ?? { version: "1.0" };
  const currentRecords = currentModule.stageRecords ?? {};
  const touchedStages = uniqueStages([
    input.stage,
    ...events.map((event) => event.stage),
    ...artifacts.map((artifact) => artifact.stage),
    ...measures.map((measure) => measure.stage)
  ]);
  const nextRecords = touchedStages.reduce<Readonly<Record<string, UnderstandingCalibrationStageRecord>>>((records, stage) => {
    const currentStageRecord = records[stage] ?? { stage };
    const stageRecord = {
      ...currentStageRecord,
      ...(input.completedAt === undefined || stage !== input.nextStage ? {} : { completedAt: input.completedAt }),
      artifactIds: [...(currentStageRecord.artifactIds ?? []), ...artifacts.filter((artifact) => artifact.stage === stage).map((artifact) => artifact.id)],
      eventIds: [...(currentStageRecord.eventIds ?? []), ...events.filter((event) => event.stage === stage).map((event) => event.id)],
      measureIds: [...(currentStageRecord.measureIds ?? []), ...measures.filter((measure) => measure.stage === stage).map((measure) => measure.id)],
      stage,
      submittedAt: timestamp
    };
    return { ...records, [stage]: stageRecord };
  }, currentRecords);
  return {
    ...session,
    ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
    ...(input.status === undefined ? {} : { status: input.status }),
    artifacts: [...session.artifacts, ...artifacts],
    chatTurns: [...session.chatTurns, ...(input.chatTurns ?? [])],
    currentStage: input.nextStage ?? session.currentStage,
    events: [...session.events, ...events],
    measures: [...session.measures, ...measures],
    modules: {
      ...session.modules,
      understandingCalibration: {
        ...currentModule,
        stageRecords: nextRecords
      }
    },
    updatedAt: timestamp
  };
};

export const appendCalibrationEventsOnly = (
  session: PilotSession,
  input: { readonly events: readonly NewEvent[]; readonly stage: Stage }
): PilotSession => {
  const timestamp = nowIso();
  return {
    ...session,
    events: [...session.events, ...input.events.map((item) => createEvent(session, input.stage, item, timestamp))],
    updatedAt: timestamp
  };
};

export const makeFinalReflectionCompletionUpdate = (input: FinalReflectionCompletionInput): CalibrationSessionUpdate => ({
  artifacts: [{
    kind: "final_reflection",
    payload: {
      promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
      ratings: input.ratings,
      text: Object.values(input.textResponses).map((value) => value.trim()).filter((value) => value.length > 0).join("\n\n"),
      textResponses: input.textResponses,
      topic: input.topic
    }
  }],
  completedAt: input.completedAt,
  events: [
    {
      type: "final_reflection_submitted",
      payload: {
        promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
        questionNumber: 0,
        ratings: input.ratings,
        reflectionKind: "final",
        textResponses: input.textResponses,
        topic: input.topic
      }
    },
    { type: "calibration_study_completed", payload: { completedAt: input.completedAt, topic: input.topic }, stage: "completed" }
  ],
  measures: [{ kind: "final_reflection_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: input.ratings, textResponses: input.textResponses, topic: input.topic } }],
  nextStage: "completed",
  stage: "final_reflection",
  status: "submitted"
});
