import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { createSession } from "../../session/session.js";
import { sampleAssignment } from "../../shared/fixtures.js";
import { ResearchConditions } from "../../shared/research.js";
import type { PilotSession } from "../../shared/types.js";
import { issueAdminToken, issueTeacherToken } from "./auth.js";
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
  private readonly turnsByRequestRole = new Map<string, StoredChatTurn>();
  chatInsertCount = 0;

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

  async resumeSession(sessionId: string): Promise<SessionStartResult> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) throw new Error("missing test session");
    return { assignment: session.assignment, context: this.context(session), session };
  }

  async startSession(input: Parameters<ResearchStore["startSession"]>[0]): Promise<SessionStartResult> {
    this.startedSessions.push(input);
    const assignment = input.assignmentId === undefined ? sampleAssignment : { ...sampleAssignment, id: input.assignmentId };
    const session = {
      ...createSession(assignment),
      researchCondition: ResearchConditions.singleGroupBaseline,
      sessionId: serverId("session"),
      student: { anonymousId: `anon-${input.participantCode}` }
    };
    this.sessions.set(session.sessionId, session);
    return { assignment: session.assignment, context: this.context(session), session };
  }

  async updateStage(input: Parameters<ResearchStore["updateStage"]>[0]): Promise<SessionContext> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined) throw new Error("missing test session");
    const next = { ...session, status: input.status ?? session.status };
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
