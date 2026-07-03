import { createHash } from "node:crypto";
import type { Assignment, ChatTurn, CoachResponseType, PilotSession, Stage } from "../../shared/types";
import type { ResearchCondition, ResearchMode } from "../../shared/research";

export type SessionContext = {
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly currentStage: Stage | string;
  readonly researchCondition: ResearchCondition;
  readonly researchMode: ResearchMode;
  readonly sessionId: string;
  readonly status: string;
  readonly studentAnonymousId: string;
};

export type SessionStartResult = {
  readonly assignment: Assignment;
  readonly context: SessionContext;
  readonly session: PilotSession;
};

export type StoredChatTurn = ChatTurn & {
  readonly requestId?: string;
  readonly sessionId: string;
  readonly stage: string;
};

export type ExportBundle = {
  readonly "artifacts.csv": string;
  readonly "chat-turns.csv": string;
  readonly "events.csv": string;
  readonly "item-long.csv": string;
  readonly "measures.csv": string;
  readonly "raw-json.json": Record<string, unknown>;
  readonly "session-wide.csv": string;
};

export type DeleteResult = {
  readonly deleted: Record<string, number>;
  readonly exportBeforeDelete?: ExportBundle;
  readonly logId: string;
};

export type ResearchStore = {
  readonly deleteTestData: (input: {
    readonly assignmentId?: string;
    readonly classGroupId?: string;
    readonly confirmExported: boolean;
    readonly reason?: string;
    readonly scope: "current_session" | "student" | "assignment" | "all_test_data";
    readonly sessionId?: string;
    readonly studentAnonymousId?: string;
    readonly teacherId?: string;
  }) => Promise<DeleteResult>;
  readonly exportData: (input: {
    readonly anonymized: boolean;
    readonly assignmentId?: string;
    readonly classGroupId?: string;
    readonly completedOnly: boolean;
    readonly teacherId?: string;
  }) => Promise<ExportBundle>;
  readonly findAssistantTurnByRequestId: (sessionId: string, requestId: string) => Promise<StoredChatTurn | null>;
  readonly insertArtifact: (input: {
    readonly id: string;
    readonly kind: string;
    readonly payload: Record<string, unknown>;
    readonly sessionId: string;
    readonly stage: string;
    readonly timestamp?: string;
    readonly updatedAt?: string;
  }) => Promise<void>;
  readonly insertChatTurn: (input: {
    readonly id: string;
    readonly requestId?: string;
    readonly responseType?: CoachResponseType;
    readonly role: ChatTurn["role"];
    readonly sessionId: string;
    readonly stage: string;
    readonly text: string;
    readonly timestamp: string;
  }) => Promise<StoredChatTurn>;
  readonly insertEvent: (input: {
    readonly id: string;
    readonly payload: Record<string, unknown>;
    readonly sessionId: string;
    readonly stage: string;
    readonly timestamp?: string;
    readonly type: string;
  }) => Promise<void>;
  readonly insertMeasure: (input: {
    readonly id: string;
    readonly kind: string;
    readonly payload: Record<string, unknown>;
    readonly sessionId: string;
    readonly stage: string;
    readonly timestamp?: string;
  }) => Promise<void>;
  readonly listChatTurns: (sessionId: string) => Promise<readonly StoredChatTurn[]>;
  readonly resumeSession: (sessionId: string) => Promise<SessionStartResult>;
  readonly startSession: (input: { readonly assignmentId?: string; readonly participantCode: string }) => Promise<SessionStartResult>;
  readonly updateStage: (input: {
    readonly completedAt?: string;
    readonly currentStage: string;
    readonly sessionId: string;
    readonly status?: string;
  }) => Promise<SessionContext>;
};

export const participantCodeHash = (participantCode: string): string =>
  createHash("sha256").update(participantCode.trim().toUpperCase()).digest("hex");

export const serverId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
