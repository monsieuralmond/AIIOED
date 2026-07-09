import type { CalibrationChatRequest, CalibrationChatResponse } from "../shared/calibration-ai.js";
import { ResearchConditions, ResearchModes } from "../shared/research.js";
import type { ResearchArtifact, ResearchMeasure } from "../shared/research.js";
import type { Assignment, ChatTurn, ClassGroup, PilotEvent, PilotState, PilotSession, Stage, StudentAccount, TeacherAccount } from "../shared/types.js";
import { clearBrowserAdminAuth, clearBrowserActorIdentity, clearBrowserSessionIdentity, clearBrowserSessionToken, clearBrowserTeacherAuth, loadBrowserAdminAuth, loadBrowserSessionToken, loadBrowserTeacherAuth } from "./browser-session.js";
import type { BrowserSessionIdentity } from "./browser-session.js";
import { parseDatabaseRoster } from "./database-roster.js";
import type { DatabaseRoster } from "./database-roster.js";

type StartSessionResponse = BrowserSessionIdentity & {
  readonly session: PilotSession;
  readonly sessionToken?: string;
};

type StartSessionPayload = {
  readonly assignment?: Pick<Assignment, "id">;
  readonly assignmentId?: string;
  readonly classGroupId: string;
  readonly session: PilotSession;
  readonly sessionId: string;
  readonly sessionToken?: string;
  readonly studentAnonymousId: string;
};

type StartParticipantSessionInput = {
  readonly assignmentId?: string;
  readonly loginId?: string;
  readonly participantCode?: string;
  readonly password?: string;
};

const optionalTrimmedField = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? undefined : trimmed;
};

const participantSessionStartBody = (input: string | StartParticipantSessionInput): StartParticipantSessionInput => {
  if (typeof input === "string") return { participantCode: input };
  const assignmentId = optionalTrimmedField(input.assignmentId);
  const loginId = optionalTrimmedField(input.loginId);
  const participantCode = optionalTrimmedField(input.participantCode);
  const password = optionalTrimmedField(input.password);
  return {
    ...(assignmentId === undefined ? {} : { assignmentId }),
    ...(loginId === undefined ? {} : { loginId }),
    ...(participantCode === undefined ? {} : { participantCode }),
    ...(password === undefined ? {} : { password })
  };
};

export type TeacherAuthResponse = {
  readonly displayName: string;
  readonly teacherId: string;
  readonly teacherToken: string;
};

export type AdminAuthResponse = {
  readonly adminId: string;
  readonly adminToken: string;
  readonly displayName: string;
};

export type StudentAuthResponse = {
  readonly assignments: readonly Assignment[];
  readonly sessions: readonly PilotSession[];
  readonly student: StudentAccount;
};

export type SessionListResponse = {
  readonly sessions: readonly PilotSession[];
};

export type DatabaseExportBundle = {
  readonly "artifacts.csv": string;
  readonly "benchmark.jsonl": string;
  readonly "chat-turns.csv": string;
  readonly "data-quality.csv": string;
  readonly "events.csv": string;
  readonly "item-long.csv": string;
  readonly "measures.csv": string;
  readonly "raw-json.json": Record<string, unknown>;
  readonly "raw-events.csv": string;
  readonly "session-wide.csv": string;
};

export type RosterSyncResponse = {
  readonly rosterRevision?: string;
};

export type RosterAuthHeaders = Readonly<Record<string, string>>;

export type RosterSyncDeletedIds = {
  readonly deletedAssignmentIds?: readonly string[];
  readonly deletedClassIds?: readonly string[];
  readonly deletedStudentIds?: readonly string[];
  readonly deletedTeacherIds?: readonly string[];
};

export type RosterSyncDelta = RosterSyncDeletedIds & {
  readonly assignments?: readonly Assignment[];
  readonly classGroups?: readonly ClassGroup[];
  readonly students?: readonly StudentAccount[];
  readonly teachers?: readonly TeacherAccount[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export class ResearchApiClientError extends Error {
  readonly payload: unknown;
  readonly status: number;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ResearchApiClientError";
    this.payload = payload;
    this.status = status;
  }
}

const parseJsonPayload = (text: string, status: number): unknown => {
  if (text.trim().length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ResearchApiClientError("서버 응답이 JSON 형식이 아닙니다.", status, text);
  }
};

const postJson = async (path: string, body: unknown, headers: Readonly<Record<string, string>> = {}): Promise<unknown> => {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method: "POST"
  });
  const payload = parseJsonPayload(await response.text(), response.status);
  if (!response.ok) {
    if (response.status === 401) clearExpiredAuth(headers);
    const message = isRecord(payload) && typeof payload["message"] === "string" ? payload["message"] : "요청에 실패했습니다.";
    throw new ResearchApiClientError(message, response.status, payload);
  }
  return payload;
};

const clearExpiredAuth = (headers: Readonly<Record<string, string>>): void => {
  if (typeof headers["x-research-session-token"] === "string") {
    clearBrowserSessionIdentity();
    clearBrowserSessionToken();
    clearBrowserActorIdentity();
  }
  if (typeof headers["x-research-teacher-token"] === "string") {
    clearBrowserTeacherAuth();
    clearBrowserActorIdentity();
  }
  if (typeof headers["x-research-admin-token"] === "string") {
    clearBrowserAdminAuth();
    clearBrowserActorIdentity();
  }
};

const isPilotSession = (value: unknown): value is PilotSession =>
  isRecord(value) &&
  typeof value["sessionId"] === "string" &&
  isRecord(value["assignment"]) &&
  typeof value["assignment"]["id"] === "string" &&
  isRecord(value["student"]) &&
  typeof value["currentStage"] === "string";

const isStartSessionPayload = (value: unknown): value is StartSessionPayload => {
  if (!isRecord(value) || !isPilotSession(value["session"])) return false;
  const assignment = value["assignment"];
  const assignmentId = value["assignmentId"];
  const hasValidAssignment = assignment === undefined || (isRecord(assignment) && typeof assignment["id"] === "string");
  const hasValidAssignmentId = assignmentId === undefined || typeof assignmentId === "string";
  return hasValidAssignment &&
    hasValidAssignmentId &&
    typeof value["classGroupId"] === "string" &&
    typeof value["sessionId"] === "string" &&
    typeof value["studentAnonymousId"] === "string";
};

const parseStartSessionResponse = (value: unknown): StartSessionResponse | null => {
  if (!isStartSessionPayload(value)) return null;
  return {
    assignmentId: value.assignmentId ?? value.assignment?.id ?? value.session.assignment.id,
    classGroupId: value.classGroupId,
    session: value.session,
    sessionId: value.sessionId,
    ...(value.sessionToken === undefined ? {} : { sessionToken: value.sessionToken }),
    studentAnonymousId: value.studentAnonymousId
  };
};

const isCalibrationChatResponse = (value: unknown): value is CalibrationChatResponse => {
  if (!isRecord(value) || !Array.isArray(value["requestTags"])) return false;
  return typeof value["text"] === "string" && value["type"] === "clarify";
};

const isDatabaseExportBundle = (value: unknown): value is DatabaseExportBundle =>
  isRecord(value) &&
  typeof value["artifacts.csv"] === "string" &&
  typeof value["benchmark.jsonl"] === "string" &&
  typeof value["chat-turns.csv"] === "string" &&
  typeof value["data-quality.csv"] === "string" &&
  typeof value["events.csv"] === "string" &&
  typeof value["item-long.csv"] === "string" &&
  typeof value["measures.csv"] === "string" &&
  isRecord(value["raw-json.json"]) &&
  typeof value["raw-events.csv"] === "string" &&
  typeof value["session-wide.csv"] === "string";

const sessionHeaders = (): Readonly<Record<string, string>> => {
  const token = loadBrowserSessionToken();
  return token === null ? {} : { "x-research-session-token": token };
};

const teacherHeaders = (): Readonly<Record<string, string>> => {
  const auth = loadBrowserTeacherAuth();
  return auth === null ? {} : { "x-research-teacher-id": auth.teacherId, "x-research-teacher-token": auth.teacherToken };
};

const adminHeaders = (): Readonly<Record<string, string>> => {
  const auth = loadBrowserAdminAuth();
  return auth === null ? {} : { "x-research-admin-id": auth.adminId, "x-research-admin-token": auth.adminToken };
};

const rosterHeaders = (): Readonly<Record<string, string>> => {
  const adminAuth = adminHeaders();
  return Object.keys(adminAuth).length > 0 ? adminAuth : teacherHeaders();
};

export const currentRosterAuthHeaders = (): RosterAuthHeaders => rosterHeaders();

const isAdminRosterAuth = (headers: RosterAuthHeaders): boolean =>
  typeof headers["x-research-admin-id"] === "string" && typeof headers["x-research-admin-token"] === "string";

const isAdminAuthResponse = (value: unknown): value is AdminAuthResponse =>
  isRecord(value) &&
  typeof value["adminId"] === "string" &&
  typeof value["adminToken"] === "string" &&
  typeof value["displayName"] === "string";

const isTeacherAuthResponse = (value: unknown): value is TeacherAuthResponse =>
  isRecord(value) &&
  typeof value["displayName"] === "string" &&
  typeof value["teacherId"] === "string" &&
  typeof value["teacherToken"] === "string";

const isAssignmentResponse = (value: unknown): value is Assignment =>
  isRecord(value) &&
  typeof value["gradeLevel"] === "string" &&
  typeof value["id"] === "string" &&
  typeof value["passage"] === "string" &&
  typeof value["question"] === "string" &&
  typeof value["targetLength"] === "string" &&
  typeof value["title"] === "string";

const isStudentAuthPayload = (value: unknown): value is {
  readonly assignments: readonly Assignment[];
  readonly sessions?: readonly PilotSession[];
  readonly student: Omit<StudentAccount, "password">;
} =>
  isRecord(value) &&
  Array.isArray(value["assignments"]) &&
  value["assignments"].every(isAssignmentResponse) &&
  (value["sessions"] === undefined || (Array.isArray(value["sessions"]) && value["sessions"].every(isPilotSession))) &&
  isRecord(value["student"]) &&
  typeof value["student"]["classGroupId"] === "string" &&
  typeof value["student"]["displayName"] === "string" &&
  typeof value["student"]["id"] === "string" &&
  typeof value["student"]["loginId"] === "string" &&
  typeof value["student"]["participantCode"] === "string" &&
  typeof value["student"]["studentNumber"] === "number" &&
  (value["student"]["anonymousId"] === undefined || typeof value["student"]["anonymousId"] === "string");

const isSessionListResponse = (value: unknown): value is SessionListResponse =>
  isRecord(value) && Array.isArray(value["sessions"]) && value["sessions"].every(isPilotSession);

export const resumeResearchSession = async (sessionId: string): Promise<StartSessionResponse> => {
  const payload = await postJson("/api/session/start", { sessionId }, sessionHeaders());
  const parsed = parseStartSessionResponse(payload);
  if (parsed === null) throw new Error("세션 응답 형식이 올바르지 않습니다.");
  return parsed;
};

export const startResearchSessionWithParticipantCode = async (input: string | StartParticipantSessionInput): Promise<StartSessionResponse> => {
  const payload = await postJson("/api/session/start", participantSessionStartBody(input));
  const parsed = parseStartSessionResponse(payload);
  if (parsed === null) throw new Error("세션 응답 형식이 올바르지 않습니다.");
  return parsed;
};

export const startTeacherPreviewSession = async (input: StartParticipantSessionInput): Promise<StartSessionResponse> => {
  const payload = await postJson("/api/session/start", participantSessionStartBody(input), teacherHeaders());
  const parsed = parseStartSessionResponse(payload);
  if (parsed === null) throw new Error("세션 응답 형식이 올바르지 않습니다.");
  return parsed;
};

const requestPreviewCalibrationChat = async (request: CalibrationChatRequest): Promise<CalibrationChatResponse> => {
  const payload = await postJson("/api/ai", { kind: "calibrationChat", payload: request });
  if (!isCalibrationChatResponse(payload)) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const requestSessionCalibrationChat = async (input: {
  readonly message: string;
  readonly previewRequest?: CalibrationChatRequest;
  readonly requestId: string;
  readonly sessionId: string;
}): Promise<CalibrationChatResponse> => {
  if (input.previewRequest !== undefined) return requestPreviewCalibrationChat(input.previewRequest);
  const payload = await postJson("/api/chat", {
    message: input.message,
    requestId: input.requestId,
    sessionId: input.sessionId
  }, sessionHeaders());
  if (!isCalibrationChatResponse(payload)) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const requestDatabaseExport = async (input: { readonly assignmentId?: string; readonly classGroupId?: string } = {}): Promise<DatabaseExportBundle> => {
  const payload = await postJson("/api/export", {
    anonymized: true,
    completedOnly: true,
    ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
    ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId })
  }, adminHeaders());
  if (!isDatabaseExportBundle(payload)) throw new Error("DB export 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const loadRosterFromDatabase = async (teacherId?: string): Promise<DatabaseRoster> => {
  const payload = await postJson("/api/admin/roster", teacherId === undefined ? {} : { teacherId }, rosterHeaders());
  return parseDatabaseRoster(payload);
};

export const loadTeacherSessionsFromDatabase = async (input: { readonly assignmentId?: string; readonly classGroupId?: string; readonly teacherId: string }): Promise<SessionListResponse> => {
  const payload = await postJson("/api/session/list", {
    completedOnly: false,
    teacherId: input.teacherId,
    ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
    ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId })
  }, teacherHeaders());
  if (!isSessionListResponse(payload)) throw new Error("세션 목록 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const resetTeacherStudentSession = async (sessionId: string): Promise<void> => {
  await postJson("/api/session/reset", { sessionId }, teacherHeaders());
};

export const loadAdminSessionsFromDatabase = async (input: { readonly assignmentId?: string; readonly classGroupId?: string } = {}): Promise<SessionListResponse> => {
  const payload = await postJson("/api/session/list", {
    completedOnly: false,
    ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
    ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId })
  }, adminHeaders());
  if (!isSessionListResponse(payload)) throw new Error("세션 목록 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const authenticateTeacherWithDatabase = async (input: { readonly loginId: string; readonly password: string }): Promise<TeacherAuthResponse> => {
  const payload = await postJson("/api/auth/teacher", input);
  if (!isTeacherAuthResponse(payload)) throw new Error("교사 인증 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const authenticateAdminWithDatabase = async (input: { readonly loginId: string; readonly password: string }): Promise<AdminAuthResponse> => {
  const payload = await postJson("/api/auth/admin", input);
  if (!isAdminAuthResponse(payload)) throw new Error("관리자 인증 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const authenticateStudentWithDatabase = async (input: {
  readonly loginId: string;
  readonly participantCode: string;
  readonly password: string;
}): Promise<StudentAuthResponse> => {
  const payload = await postJson("/api/auth/student", input);
  if (!isStudentAuthPayload(payload)) throw new Error("학생 인증 응답 형식이 올바르지 않습니다.");
  return {
    assignments: payload.assignments,
    sessions: payload.sessions ?? [],
    student: { ...payload.student, password: input.password }
  };
};

const anonymousIdForStudent = (student: StudentAccount): string => student.anonymousId ?? `anon-${student.classGroupId}-${String(student.studentNumber).padStart(3, "0")}`;

const optionalPasswordField = (password: string): { readonly password: string } | Record<string, never> => {
  const trimmedPassword = password.trim();
  return trimmedPassword.length === 0 ? {} : { password: trimmedPassword };
};

const teacherIdForRosterPayload = (state: PilotState, authHeaders: RosterAuthHeaders): string | undefined => {
  const selectedActor = state.selectedActor;
  return isAdminRosterAuth(authHeaders) ? undefined : selectedActor?.role === "teacher" ? selectedActor.accountId : state.teacher.id;
};

const assignmentPayload = (assignment: Assignment, teacherId: string | undefined, fallbackTeacherId: string): Record<string, unknown> => ({
  createdByTeacherId: assignment.createdByTeacherId ?? teacherId ?? fallbackTeacherId,
  id: assignment.id,
  payload: assignment,
  researchCondition: assignment.researchCondition ?? ResearchConditions.singleGroupBaseline,
  researchMode: assignment.researchMode ?? ResearchModes.writingCoach,
  title: assignment.title,
  ...(assignment.classGroupId === undefined ? {} : { classGroupId: assignment.classGroupId })
});

const classPayload = (classGroup: ClassGroup): Record<string, unknown> => ({
  id: classGroup.id,
  name: classGroup.name,
  teacherId: classGroup.teacherId
});

const studentPayload = (student: StudentAccount): Record<string, unknown> => ({
  classGroupId: student.classGroupId,
  displayLabel: student.displayName,
  id: student.id,
  loginId: student.loginId,
  participantCode: student.participantCode,
  ...optionalPasswordField(student.password),
  studentAnonymousId: anonymousIdForStudent(student),
  studentNumber: student.studentNumber
});

const teacherPayload = (teacher: TeacherAccount): Record<string, unknown> => ({
  displayName: teacher.displayName,
  id: teacher.id,
  loginId: teacher.loginId,
  ...optionalPasswordField(teacher.password)
});

const rosterPayload = (state: PilotState, input: {
  readonly assignments: readonly Assignment[];
  readonly classGroups: readonly ClassGroup[];
  readonly deletedIds: RosterSyncDeletedIds;
  readonly expectedRosterRevision?: string | null;
  readonly students: readonly StudentAccount[];
  readonly teachers: readonly TeacherAccount[];
}, authHeaders: RosterAuthHeaders): Record<string, unknown> => {
  const teacherId = teacherIdForRosterPayload(state, authHeaders);
  return {
    assignments: input.assignments.map((assignment) => assignmentPayload(assignment, teacherId, state.teacher.id)),
    classes: input.classGroups.map(classPayload),
    students: input.students.map(studentPayload),
    teachers: input.teachers.map(teacherPayload),
    ...(input.deletedIds.deletedAssignmentIds === undefined ? {} : { deletedAssignmentIds: input.deletedIds.deletedAssignmentIds }),
    ...(input.deletedIds.deletedClassIds === undefined ? {} : { deletedClassIds: input.deletedIds.deletedClassIds }),
    ...(input.deletedIds.deletedStudentIds === undefined ? {} : { deletedStudentIds: input.deletedIds.deletedStudentIds }),
    ...(input.deletedIds.deletedTeacherIds === undefined ? {} : { deletedTeacherIds: input.deletedIds.deletedTeacherIds }),
    ...(input.expectedRosterRevision === undefined || input.expectedRosterRevision === null ? {} : { expectedRosterRevision: input.expectedRosterRevision }),
    ...(teacherId === undefined ? {} : { teacherId })
  };
};

export const syncRosterToDatabase = async (state: PilotState, deletedIds: RosterSyncDeletedIds = {}, expectedRosterRevision?: string | null, authHeaders: RosterAuthHeaders = rosterHeaders()): Promise<RosterSyncResponse> => {
  const payload = await postJson("/api/admin/upsert-roster", rosterPayload(state, {
    assignments: state.assignments,
    classGroups: state.classGroups,
    deletedIds,
    ...(expectedRosterRevision === undefined ? {} : { expectedRosterRevision }),
    students: state.students,
    teachers: state.teachers
  }, authHeaders), authHeaders);
  return isRecord(payload) && typeof payload["rosterRevision"] === "string" ? { rosterRevision: payload["rosterRevision"] } : {};
};

export const syncRosterDeltaToDatabase = async (state: PilotState, delta: RosterSyncDelta, expectedRosterRevision?: string | null, authHeaders: RosterAuthHeaders = rosterHeaders()): Promise<RosterSyncResponse> => {
  const payload = await postJson("/api/admin/upsert-roster-delta", rosterPayload(state, {
    assignments: delta.assignments ?? [],
    classGroups: delta.classGroups ?? [],
    deletedIds: delta,
    ...(expectedRosterRevision === undefined ? {} : { expectedRosterRevision }),
    students: delta.students ?? [],
    teachers: delta.teachers ?? []
  }, authHeaders), authHeaders);
  return isRecord(payload) && typeof payload["rosterRevision"] === "string" ? { rosterRevision: payload["rosterRevision"] } : {};
};

const syncEvent = (sessionId: string, event: PilotEvent): Promise<unknown> =>
  postJson("/api/event", {
    id: event.id,
    payload: event.payload,
    sessionId,
    stage: event.stage,
    timestamp: event.timestamp,
    type: event.type
  }, sessionHeaders());

const syncArtifact = (sessionId: string, artifact: ResearchArtifact): Promise<unknown> =>
  postJson("/api/artifact", {
    id: artifact.id,
    kind: artifact.kind,
    payload: artifact.payload,
    sessionId,
    stage: artifact.stage,
    timestamp: artifact.createdAt,
    ...(artifact.updatedAt === undefined ? {} : { updatedAt: artifact.updatedAt })
  }, sessionHeaders());

const syncMeasure = (sessionId: string, measure: ResearchMeasure): Promise<unknown> =>
  postJson("/api/measure", {
    id: measure.id,
    kind: measure.kind,
    payload: measure.payload,
    sessionId,
    stage: measure.stage,
    timestamp: measure.collectedAt
  }, sessionHeaders());

const syncChatTurn = (sessionId: string, stage: Stage, turn: ChatTurn): Promise<unknown> =>
  postJson("/api/chat-turn", {
    id: turn.id,
    role: turn.role,
    sessionId,
    stage,
    text: turn.text,
    timestamp: turn.timestamp,
    ...(turn.responseType === undefined ? {} : { responseType: turn.responseType })
  }, sessionHeaders());

const itemsAddedById = <T extends { readonly id: string }>(previous: readonly T[], next: readonly T[]): readonly T[] => {
  const previousIds = new Set(previous.map((item) => item.id));
  return next.filter((item) => !previousIds.has(item.id));
};

export const syncSessionDelta = async (previous: PilotSession, next: PilotSession): Promise<void> => {
  const newEvents = itemsAddedById(previous.events, next.events);
  const newArtifacts = itemsAddedById(previous.artifacts, next.artifacts);
  const newMeasures = itemsAddedById(previous.measures, next.measures);
  const newChatTurns = next.researchMode === ResearchModes.understandingCalibration ? [] : itemsAddedById(previous.chatTurns, next.chatTurns);
  await Promise.all([
    ...newChatTurns.map((turn) => syncChatTurn(next.sessionId, next.currentStage, turn)),
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
    }, sessionHeaders());
  }
};
