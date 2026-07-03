import type { ChatTurn, PilotEvent, PilotEventType, PilotSession, Stage } from "../shared/types";
import type { ResearchArtifact, ResearchMeasure, ResearchSessionStatus, UnderstandingCalibrationStageRecord } from "../shared/research";
import { UNDERSTANDING_CALIBRATION_PROMPT_VERSION } from "./understanding-calibration-data";

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
  readonly finalReflection: string;
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

const createEvent = (stage: Stage, input: NewEvent, timestamp: string): PilotEvent => ({
  id: makeId("event"),
  payload: input.payload ?? {},
  stage: input.stage ?? stage,
  timestamp,
  type: input.type
});

const createArtifact = (stage: Stage, input: NewArtifact, timestamp: string): CalibrationArtifact => ({
  createdAt: timestamp,
  id: makeId("artifact"),
  kind: input.kind,
  payload: input.payload,
  stage: input.stage ?? stage
});

const createMeasure = (stage: Stage, input: NewMeasure, timestamp: string): CalibrationMeasure => ({
  collectedAt: timestamp,
  id: makeId("measure"),
  kind: input.kind,
  payload: input.payload,
  stage: input.stage ?? stage
});

const uniqueStages = (stages: readonly Stage[]): readonly Stage[] => {
  const unique: Stage[] = [];
  for (const stage of stages) {
    if (!unique.includes(stage)) unique.push(stage);
  }
  return unique;
};

export const appendCalibrationRecords = (session: PilotSession, input: CalibrationSessionUpdate): PilotSession => {
  const timestamp = nowIso();
  const events = input.events?.map((item) => createEvent(input.stage, item, timestamp)) ?? [];
  const artifacts = input.artifacts?.map((item) => createArtifact(input.stage, item, timestamp)) ?? [];
  const measures = input.measures?.map((item) => createMeasure(input.stage, item, timestamp)) ?? [];
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

export const makeFinalReflectionCompletionUpdate = (input: FinalReflectionCompletionInput): CalibrationSessionUpdate => ({
  artifacts: [{ kind: "final_reflection", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, text: input.finalReflection, topic: input.topic } }],
  completedAt: input.completedAt,
  events: [
    { type: "reflection_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, questionNumber: 0, reflectionKind: "final", textLength: input.finalReflection.length, topic: input.topic } },
    { type: "calibration_study_completed", payload: { completedAt: input.completedAt, topic: input.topic }, stage: "completed" }
  ],
  nextStage: "completed",
  stage: "final_reflection",
  status: "submitted"
});
