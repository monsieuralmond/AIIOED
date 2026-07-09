import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { createSession } from "../../session/session.js";
import { sampleAssignment } from "../../shared/fixtures.js";
import { ResearchConditions } from "../../shared/research.js";
import type { PilotSession } from "../../shared/types.js";
import { issueAdminToken, issueTeacherToken } from "./auth.js";
import { ApiError } from "./http.js";
import { serverId } from "./store.js";
import type { DeleteResult, ExportBundle, ResearchStore, SessionContext, SessionStartResult, StoredChatTurn } from "./store.js";

type ArtifactWrite = Parameters<ResearchStore["insertArtifact"]>[0];
type EventWrite = Parameters<ResearchStore["insertEvent"]>[0];
type MeasureWrite = Parameters<ResearchStore["insertMeasure"]>[0];

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const sessionTokenFrom = (value: unknown): string => {
  if (!isRecord(value) || typeof value["sessionToken"] !== "string") throw new Error("session start response did not include a session token.");
  return value["sessionToken"];
};

export const sessionIdFrom = (value: unknown): string => {
  if (!isRecord(value) || typeof value["sessionId"] !== "string") throw new Error("session start response did not include a session id.");
  return value["sessionId"];
};

const requestWithHeaders = (headers: IncomingMessage["headers"]): IncomingMessage => {
  const request = new IncomingMessage(new Socket());
  request.headers = headers;
  return request;
};

export const emptyRequest = (): IncomingMessage => requestWithHeaders({});

export const requestWithSessionToken = (token: string): IncomingMessage =>
  requestWithHeaders({ "x-research-session-token": token });

export const requestWithTeacherToken = (teacherId: string): IncomingMessage =>
  requestWithHeaders({
    "x-research-teacher-id": teacherId,
    "x-research-teacher-token": issueTeacherToken(teacherId)
  });

export const requestWithAdminToken = (adminId = "admin-root"): IncomingMessage =>
  requestWithHeaders({
    "x-research-admin-id": adminId,
    "x-research-admin-token": issueAdminToken(adminId)
  });

const emptyExport = (): ExportBundle => ({
  "artifacts.csv": "",
  "benchmark.jsonl": "",
  "chat-turns.csv": "",
  "data-quality.csv": "",
  "events.csv": "",
  "item-long.csv": "",
  "measures.csv": "",
  "raw-json.json": {},
  "raw-events.csv": "",
  "session-wide.csv": ""
});

export class MemoryResearchStore implements ResearchStore {
  readonly assistantTurnsByRequest = new Map<string, StoredChatTurn>();
  readonly sessions = new Map<string, PilotSession>();
  readonly startedSessions: Parameters<ResearchStore["startSession"]>[0][] = [];
  readonly storedArtifacts: ArtifactWrite[] = [];
  readonly storedChatTurns: StoredChatTurn[] = [];
  readonly storedEvents: EventWrite[] = [];
  readonly storedMeasures: MeasureWrite[] = [];
  readonly deleteRequests: Parameters<ResearchStore["deleteTestData"]>[0][] = [];
  readonly exportRequests: Parameters<ResearchStore["exportData"]>[0][] = [];
  readonly listSessionRequests: Parameters<ResearchStore["listSessions"]>[0][] = [];
  readonly resetRequests: Parameters<ResearchStore["resetStudentSession"]>[0][] = [];
  private readonly turnsByRequestRole = new Map<string, StoredChatTurn>();
  chatInsertCount = 0;
  resumeSessionForChatCount = 0;

  async deleteTestData(input: Parameters<ResearchStore["deleteTestData"]>[0]): Promise<DeleteResult> {
    this.deleteRequests.push(input);
    return { deleted: {}, logId: "log-memory" };
  }

  async exportData(input: Parameters<ResearchStore["exportData"]>[0]): Promise<ExportBundle> {
    this.exportRequests.push(input);
    return emptyExport();
  }

  async findAssistantTurnByRequestId(sessionId: string, requestId: string): Promise<StoredChatTurn | null> {
    return this.assistantTurnsByRequest.get(`${sessionId}:${requestId}`) ?? null;
  }

  async hasChatFailureForRequestId(sessionId: string, requestId: string): Promise<boolean> {
    return this.storedEvents.some((event) =>
      event.sessionId === sessionId &&
      event.type === "calibration_chat_failed" &&
      event.payload["requestId"] === requestId
    );
  }

  async insertArtifact(input: ArtifactWrite): Promise<void> {
    this.storedArtifacts.push(input);
  }

  async insertChatTurn(input: Parameters<ResearchStore["insertChatTurn"]>[0]): Promise<StoredChatTurn> {
    const requestRoleKey = input.requestId === undefined ? null : `${input.sessionId}:${input.requestId}:${input.role}`;
    if (requestRoleKey !== null) {
      const existing = this.turnsByRequestRole.get(requestRoleKey);
      if (existing !== undefined) return existing;
    }
    const turn: StoredChatTurn = {
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      ...(input.responseType === undefined ? {} : { responseType: input.responseType }),
      id: input.id,
      role: input.role,
      sessionId: input.sessionId,
      stage: input.stage,
      text: input.text,
      timestamp: input.timestamp
    };
    this.chatInsertCount += 1;
    this.storedChatTurns.push(turn);
    if (requestRoleKey !== null) this.turnsByRequestRole.set(requestRoleKey, turn);
    if (input.role === "assistant" && input.requestId !== undefined) this.assistantTurnsByRequest.set(`${input.sessionId}:${input.requestId}`, turn);
    return turn;
  }

  async insertEvent(input: EventWrite): Promise<void> {
    this.storedEvents.push(input);
  }

  async insertMeasure(input: MeasureWrite): Promise<void> {
    this.storedMeasures.push(input);
  }

  async listChatTurns(): Promise<readonly StoredChatTurn[]> {
    return [];
  }

  async listSessions(input: Parameters<ResearchStore["listSessions"]>[0]): Promise<{ readonly sessions: readonly PilotSession[] }> {
    this.listSessionRequests.push(input);
    return { sessions: [...this.sessions.values()] };
  }

  async resetStudentSession(input: Parameters<ResearchStore["resetStudentSession"]>[0]): Promise<{ readonly sessionId: string }> {
    this.resetRequests.push(input);
    if (!this.sessions.has(input.sessionId)) throw new ApiError(404, "Unknown session.");
    this.sessions.delete(input.sessionId);
    const keepTurn = (turn: StoredChatTurn): boolean => turn.sessionId !== input.sessionId;
    const keepArtifact = (artifact: ArtifactWrite): boolean => artifact.sessionId !== input.sessionId;
    const keepEvent = (event: EventWrite): boolean => event.sessionId !== input.sessionId;
    const keepMeasure = (measure: MeasureWrite): boolean => measure.sessionId !== input.sessionId;
    this.storedChatTurns.splice(0, this.storedChatTurns.length, ...this.storedChatTurns.filter(keepTurn));
    this.storedArtifacts.splice(0, this.storedArtifacts.length, ...this.storedArtifacts.filter(keepArtifact));
    this.storedEvents.splice(0, this.storedEvents.length, ...this.storedEvents.filter(keepEvent));
    this.storedMeasures.splice(0, this.storedMeasures.length, ...this.storedMeasures.filter(keepMeasure));
    return { sessionId: input.sessionId };
  }

  async resumeSession(sessionId: string): Promise<SessionStartResult> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) throw new Error("missing test session");
    const sessionWithTurns = {
      ...session,
      chatTurns: this.storedChatTurns.filter((turn) => turn.sessionId === sessionId)
    };
    return { assignment: sessionWithTurns.assignment, context: this.context(sessionWithTurns), session: sessionWithTurns };
  }

  async resumeSessionForChat(sessionId: string): Promise<SessionStartResult> {
    this.resumeSessionForChatCount += 1;
    return this.resumeSession(sessionId);
  }

  async startSession(input: Parameters<ResearchStore["startSession"]>[0]): Promise<SessionStartResult> {
    this.startedSessions.push(input);
    const assignment = input.assignmentId === undefined ? sampleAssignment : { ...sampleAssignment, id: input.assignmentId };
    const studentKey = input.participantCode ?? input.loginId ?? "student";
    const studentAnonymousId = `anon-${studentKey}`;
    const alreadySubmitted = [...this.sessions.values()].some((session) =>
      session.assignment.id === assignment.id &&
      session.student.anonymousId === studentAnonymousId &&
      (session.completedAt !== undefined || session.status === "submitted" || session.status === "completed")
    );
    if (alreadySubmitted) throw new ApiError(409, "이미 제출한 과제입니다.");
    const existingSession = [...this.sessions.values()].find((session) =>
      session.assignment.id === assignment.id &&
      session.student.anonymousId === studentAnonymousId
    );
    if (existingSession !== undefined) return { assignment: existingSession.assignment, context: this.context(existingSession), session: existingSession };
    const session = {
      ...createSession(assignment),
      researchCondition: ResearchConditions.singleGroupBaseline,
      sessionId: serverId("session"),
      student: { anonymousId: studentAnonymousId }
    };
    this.sessions.set(session.sessionId, session);
    return { assignment: session.assignment, context: this.context(session), session };
  }

  async updateStage(input: Parameters<ResearchStore["updateStage"]>[0]): Promise<SessionContext> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined) throw new Error("missing test session");
    const next = { ...session, ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }), status: input.status ?? session.status };
    this.sessions.set(input.sessionId, next);
    return this.context(next);
  }

  private context(session: PilotSession): SessionContext {
    return {
      assignmentId: session.assignment.id,
      classGroupId: session.assignment.classGroupId ?? "class-memory",
      currentStage: session.currentStage,
      researchCondition: session.researchCondition,
      researchMode: session.researchMode,
      sessionId: session.sessionId,
      status: session.status,
      studentAnonymousId: session.student.anonymousId
    };
  }
}
