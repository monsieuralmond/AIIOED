import type { CalibrationChatResponse } from "../shared/calibration-ai";
import { ResearchConditions, ResearchModes } from "../shared/research";
import type { ResearchArtifact, ResearchMeasure } from "../shared/research";
import type { PilotEvent, PilotState, PilotSession, StudentAccount } from "../shared/types";
import type { BrowserSessionIdentity } from "./browser-session";

type StartSessionResponse = BrowserSessionIdentity & {
  readonly session: PilotSession;
};

export type DatabaseExportBundle = {
  readonly "artifacts.csv": string;
  readonly "chat-turns.csv": string;
  readonly "events.csv": string;
  readonly "item-long.csv": string;
  readonly "measures.csv": string;
  readonly "raw-json.json": Record<string, unknown>;
  readonly "session-wide.csv": string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const postJson = async (path: string, body: unknown): Promise<unknown> => {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload["message"] === "string" ? payload["message"] : "요청에 실패했습니다.";
    throw new Error(message);
  }
  return payload;
};

const isStartSessionResponse = (value: unknown): value is StartSessionResponse => {
  if (!isRecord(value) || !isRecord(value["session"])) return false;
  return typeof value["assignmentId"] === "string" && typeof value["classGroupId"] === "string" && typeof value["sessionId"] === "string" && typeof value["studentAnonymousId"] === "string";
};

const isCalibrationChatResponse = (value: unknown): value is CalibrationChatResponse => {
  if (!isRecord(value) || !Array.isArray(value["requestTags"])) return false;
  return typeof value["text"] === "string" && value["type"] === "clarify";
};

const isDatabaseExportBundle = (value: unknown): value is DatabaseExportBundle =>
  isRecord(value) &&
  typeof value["artifacts.csv"] === "string" &&
  typeof value["chat-turns.csv"] === "string" &&
  typeof value["events.csv"] === "string" &&
  typeof value["item-long.csv"] === "string" &&
  typeof value["measures.csv"] === "string" &&
  isRecord(value["raw-json.json"]) &&
  typeof value["session-wide.csv"] === "string";

export const resumeResearchSession = async (sessionId: string): Promise<StartSessionResponse> => {
  const payload = await postJson("/api/session/start", { sessionId });
  if (!isStartSessionResponse(payload)) throw new Error("세션 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const startResearchSessionWithParticipantCode = async (participantCode: string): Promise<StartSessionResponse> => {
  const payload = await postJson("/api/session/start", { participantCode });
  if (!isStartSessionResponse(payload)) throw new Error("세션 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const requestSessionCalibrationChat = async (input: { readonly message: string; readonly requestId: string; readonly sessionId: string }): Promise<CalibrationChatResponse> => {
  const payload = await postJson("/api/chat", input);
  if (!isCalibrationChatResponse(payload)) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const requestDatabaseExport = async (input: { readonly assignmentId?: string; readonly classGroupId?: string; readonly teacherId?: string } = {}): Promise<DatabaseExportBundle> => {
  const payload = await postJson("/api/export", {
    anonymized: true,
    completedOnly: true,
    ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
    ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
    ...(input.teacherId === undefined ? {} : { teacherId: input.teacherId })
  });
  if (!isDatabaseExportBundle(payload)) throw new Error("DB export 응답 형식이 올바르지 않습니다.");
  return payload;
};

const anonymousIdForStudent = (student: StudentAccount): string => `anon-${student.classGroupId}-${String(student.studentNumber).padStart(3, "0")}`;

export const syncRosterToDatabase = async (state: PilotState): Promise<void> => {
  await postJson("/api/admin/upsert-roster", {
    assignments: state.assignments.map((assignment) => ({
      classGroupId: assignment.classGroupId ?? state.classGroups[0]?.id ?? "class-default",
      createdByTeacherId: assignment.createdByTeacherId ?? state.teacher.id,
      id: assignment.id,
      payload: assignment,
      researchCondition: assignment.researchCondition ?? ResearchConditions.singleGroupBaseline,
      researchMode: assignment.researchMode ?? ResearchModes.writingCoach,
      title: assignment.title
    })),
    classes: state.classGroups.map((classGroup) => ({
      id: classGroup.id,
      name: classGroup.name,
      teacherId: classGroup.teacherId
    })),
    students: state.students.map((student) => ({
      classGroupId: student.classGroupId,
      displayLabel: student.displayName,
      id: student.id,
      participantCode: student.participantCode,
      studentAnonymousId: anonymousIdForStudent(student)
    }))
  });
};

const syncEvent = (sessionId: string, event: PilotEvent): Promise<unknown> =>
  postJson("/api/event", {
    id: event.id,
    payload: event.payload,
    sessionId,
    stage: event.stage,
    timestamp: event.timestamp,
    type: event.type
  });

const syncArtifact = (sessionId: string, artifact: ResearchArtifact): Promise<unknown> =>
  postJson("/api/artifact", {
    id: artifact.id,
    kind: artifact.kind,
    payload: artifact.payload,
    sessionId,
    stage: artifact.stage,
    timestamp: artifact.createdAt,
    ...(artifact.updatedAt === undefined ? {} : { updatedAt: artifact.updatedAt })
  });

const syncMeasure = (sessionId: string, measure: ResearchMeasure): Promise<unknown> =>
  postJson("/api/measure", {
    id: measure.id,
    kind: measure.kind,
    payload: measure.payload,
    sessionId,
    stage: measure.stage,
    timestamp: measure.collectedAt
  });

export const syncSessionDelta = async (previous: PilotSession, next: PilotSession): Promise<void> => {
  const newEvents = next.events.slice(previous.events.length);
  const newArtifacts = next.artifacts.slice(previous.artifacts.length);
  const newMeasures = next.measures.slice(previous.measures.length);
  await Promise.all([
    ...newEvents.map((event) => syncEvent(next.sessionId, event)),
    ...newArtifacts.map((artifact) => syncArtifact(next.sessionId, artifact)),
    ...newMeasures.map((measure) => syncMeasure(next.sessionId, measure))
  ]);
  if (previous.currentStage !== next.currentStage || previous.status !== next.status || previous.completedAt !== next.completedAt) {
    await postJson("/api/session/update-stage", {
      ...(next.completedAt === undefined ? {} : { completedAt: next.completedAt }),
      currentStage: next.currentStage,
      sessionId: next.sessionId,
      status: next.status
    });
  }
};
