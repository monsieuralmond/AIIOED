import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "../../session/session";
import { sampleAssignment } from "../../shared/fixtures";
import { ResearchConditions } from "../../shared/research";
import type { PilotSession } from "../../shared/types";
import { createResearchApiHandlers } from "./handlers";
import { serverId } from "./store";
import type { DeleteResult, ExportBundle, ResearchStore, SessionContext, SessionStartResult, StoredChatTurn } from "./store";

const emptyExport = (): ExportBundle => ({
  "artifacts.csv": "",
  "chat-turns.csv": "",
  "events.csv": "",
  "item-long.csv": "",
  "measures.csv": "",
  "raw-json.json": {},
  "session-wide.csv": ""
});

class MemoryResearchStore implements ResearchStore {
  readonly assistantTurnsByRequest = new Map<string, StoredChatTurn>();
  readonly sessions = new Map<string, PilotSession>();
  chatInsertCount = 0;

  async deleteTestData(): Promise<DeleteResult> {
    return { deleted: {}, logId: "log-memory" };
  }

  async exportData(): Promise<ExportBundle> {
    return emptyExport();
  }

  async findAssistantTurnByRequestId(sessionId: string, requestId: string): Promise<StoredChatTurn | null> {
    return this.assistantTurnsByRequest.get(`${sessionId}:${requestId}`) ?? null;
  }

  async insertArtifact(): Promise<void> {}

  async insertChatTurn(input: {
    readonly id: string;
    readonly requestId?: string;
    readonly responseType?: StoredChatTurn["responseType"];
    readonly role: StoredChatTurn["role"];
    readonly sessionId: string;
    readonly stage: string;
    readonly text: string;
    readonly timestamp: string;
  }): Promise<StoredChatTurn> {
    this.chatInsertCount += 1;
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
    if (input.role === "assistant" && input.requestId !== undefined) this.assistantTurnsByRequest.set(`${input.sessionId}:${input.requestId}`, turn);
    return turn;
  }

  async insertEvent(): Promise<void> {}

  async insertMeasure(): Promise<void> {}

  async listChatTurns(): Promise<readonly StoredChatTurn[]> {
    return [];
  }

  async resumeSession(sessionId: string): Promise<SessionStartResult> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) throw new Error("missing test session");
    return { assignment: session.assignment, context: this.context(session), session };
  }

  async startSession(input: { readonly participantCode: string }): Promise<SessionStartResult> {
    const session = {
      ...createSession(sampleAssignment),
      researchCondition: ResearchConditions.singleGroupBaseline,
      sessionId: serverId("session"),
      student: { anonymousId: `anon-${input.participantCode}` }
    };
    this.sessions.set(session.sessionId, session);
    return { assignment: session.assignment, context: this.context(session), session };
  }

  async updateStage(input: { readonly currentStage: string; readonly sessionId: string; readonly status?: string }): Promise<SessionContext> {
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

describe("research API handlers", () => {
  beforeEach(() => {
    process.env["READING_COACH_AI_MODE"] = "mock";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test";
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
  });

  it("creates isolated sessions for 30 participant codes", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const results = await Promise.all(Array.from({ length: 30 }, (_, index) => handlers.sessionStart({ participantCode: `S${String(index + 1).padStart(3, "0")}` }, {} as never)));
    const sessionIds = results.map((result) => (result as { readonly sessionId: string }).sessionId);
    const studentIds = results.map((result) => (result as { readonly studentAnonymousId: string }).studentAnonymousId);

    expect(new Set(sessionIds).size).toBe(30);
    expect(new Set(studentIds).size).toBe(30);
  });

  it("returns the stored assistant turn for duplicate chat requestIds", async () => {
    const store = new MemoryResearchStore();
    const handlers = createResearchApiHandlers(() => store);
    const started = await handlers.sessionStart({ participantCode: "S001" }, {} as never) as { readonly sessionId: string };

    const first = await handlers.chat({ message: "양자컴퓨터가 뭐야?", requestId: "request-1", sessionId: started.sessionId }, {} as never);
    const second = await handlers.chat({ message: "양자컴퓨터가 뭐야?", requestId: "request-1", sessionId: started.sessionId }, {} as never);

    expect((first as { readonly text: string }).text).toBe((second as { readonly text: string }).text);
    expect(store.chatInsertCount).toBe(2);
  });
});
