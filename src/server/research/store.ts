import { createHash } from "node:crypto";
import type { Assignment, ChatTurn, CoachResponseType, PilotSession, Stage } from "../../shared/types.js";
import { ApiError } from "./http.js";
import type { ResearchCondition, ResearchMode } from "../../shared/research.js";

export type SessionContext = {
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly currentStage: Stage | string;
  readonly researchCondition: ResearchCondition;
  readonly researchMode: ResearchMode;
  readonly researchLocked: boolean;
  readonly sessionId: string;
  readonly status: string;
  readonly studentAnonymousId: string;
};

export type SessionStartResult = {
  readonly assignment: Assignment;
  readonly context: SessionContext;
  readonly session: PilotSession;
};

export type SessionListResult = {
  readonly sessions: readonly PilotSession[];
};

export type StoredChatTurn = ChatTurn & {
  readonly requestId?: string;
  readonly sessionId: string;
  readonly stage: string;
};

export type ExportBundle = {
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

export type DeleteResult = {
  readonly deleted: Record<string, number>;
  readonly exportBeforeDelete?: ExportBundle;
  readonly logId: string;
};

export type SessionResetResult = {
  readonly sessionId: string;
};

export type SessionDelta = {
  readonly artifacts: readonly {
    readonly createdAt: string;
    readonly id: string;
    readonly kind: string;
    readonly payload: Record<string, unknown>;
    readonly stage: string;
    readonly updatedAt?: string | undefined;
  }[];
  readonly chatTurns: readonly {
    readonly id: string;
    readonly requestId?: string | undefined;
    readonly responseType?: CoachResponseType | undefined;
    readonly role: ChatTurn["role"];
    readonly text: string;
    readonly timestamp: string;
  }[];
  readonly currentStage: string;
  readonly events: readonly {
    readonly id: string;
    readonly payload: Record<string, unknown>;
    readonly stage: string;
    readonly timestamp: string;
    readonly type: string;
  }[];
  readonly measures: readonly {
    readonly collectedAt: string;
    readonly id: string;
    readonly kind: string;
    readonly payload: Record<string, unknown>;
    readonly stage: string;
  }[];
  readonly sessionId: string;
  readonly status: string;
  readonly completedAt?: string | undefined;
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
  readonly hasChatFailureForRequestId: (sessionId: string, requestId: string) => Promise<boolean>;
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
    readonly context?: SessionContext;
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
    readonly context?: SessionContext;
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
  readonly resumeSessionForChat: (sessionId: string) => Promise<SessionStartResult>;
  readonly listSessions: (input: {
    readonly assignmentId?: string;
    readonly classGroupId?: string;
    readonly teacherId?: string;
  }) => Promise<SessionListResult>;
  readonly resetStudentSession: (input: {
    readonly sessionId: string;
    readonly teacherId: string;
  }) => Promise<SessionResetResult>;
  readonly startSession: (input: {
    readonly assignmentId?: string;
    readonly loginId?: string;
    readonly participantCode?: string;
    readonly password?: string;
    readonly teacherId?: string;
  }) => Promise<SessionStartResult>;
  readonly syncSessionDelta?: (input: SessionDelta) => Promise<void>;
  readonly updateStage: (input: {
    readonly completedAt?: string;
    readonly currentStage: string;
    readonly sessionId: string;
    readonly status?: string;
  }) => Promise<SessionContext>;
};

export const participantCodeHash = (participantCode: string): string =>
  createHash("sha256").update(participantCode.trim().toUpperCase()).digest("hex");

export const assertSessionWritable = (context: {
  readonly researchLocked: boolean;
  readonly status: string;
} | {
  readonly research_locked: boolean;
  readonly status: string;
}): void => {
  const researchLocked = "researchLocked" in context ? context.researchLocked : context.research_locked;
  if (researchLocked || context.status === "submitted" || context.status === "completed") {
    throw new ApiError(409, "제출된 연구 데이터는 더 이상 수정할 수 없습니다.");
  }
};

export const serverId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
