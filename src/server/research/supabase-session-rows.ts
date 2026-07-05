import { createSession } from "../../session/session.js";
import type { Assignment, ChatTurn, CoachResponseType, PilotEvent, PilotSession, Stage } from "../../shared/types.js";
import type { ResearchArtifact, ResearchCondition, ResearchMeasure, ResearchMode } from "../../shared/research.js";
import type { SessionContext, StoredChatTurn } from "./store.js";
import type { SupabaseRestClient } from "./supabase-rest.js";

export type StudentRow = {
  readonly class_group_id: string;
  readonly display_label: string | null;
  readonly id: string;
  readonly login_id: string | null;
  readonly password_hash: string | null;
  readonly student_anonymous_id: string;
  readonly student_number: number | null;
};

export type AssignmentRow = {
  readonly assignment: Assignment;
  readonly class_group_id: string;
  readonly created_by_teacher_id: string;
  readonly id: string;
  readonly research_condition: ResearchCondition;
  readonly research_mode: ResearchMode;
};

export type SessionRow = {
  readonly assignment_id: string;
  readonly assignment_snapshot: Assignment;
  readonly class_group_id: string;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly current_stage: string;
  readonly metadata: PilotSession["metadata"];
  readonly research_condition: ResearchCondition;
  readonly research_locked: boolean;
  readonly research_mode: ResearchMode;
  readonly session_id: string;
  readonly status: string;
  readonly student_anonymous_id: string;
  readonly updated_at: string;
};

type ChatTurnRow = {
  readonly assignment_id: string;
  readonly class_group_id: string;
  readonly created_at: string;
  readonly id: string;
  readonly request_id: string | null;
  readonly response_type: CoachResponseType | null;
  readonly role: ChatTurn["role"];
  readonly session_id: string;
  readonly stage: string;
  readonly student_anonymous_id: string;
  readonly text: string;
};

type EventRow = {
  readonly created_at: string;
  readonly id: string;
  readonly payload: Record<string, unknown>;
  readonly stage: Stage;
  readonly type: PilotEvent["type"];
};

type ArtifactRow = {
  readonly created_at: string;
  readonly id: string;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly stage: string;
  readonly updated_at: string | null;
};

type MeasureRow = {
  readonly created_at: string;
  readonly id: string;
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly stage: string;
};

export type ChildContext = {
  readonly assignment_id: string;
  readonly class_group_id: string;
  readonly session_id: string;
  readonly student_anonymous_id: string;
};

export const encode = (value: string): string => encodeURIComponent(value);

export const inList = (values: readonly string[]): string => `in.(${values.map(encode).join(",")})`;

export const rowsForSessionIds = async <T>(db: SupabaseRestClient, table: string, sessionIds: readonly string[], order = "created_at.asc"): Promise<readonly T[]> => {
  if (sessionIds.length === 0) return [];
  return db.get<readonly T[]>(table, `session_id=${inList(sessionIds)}&order=${order}`);
};

export const contextFromSession = (row: SessionRow): SessionContext => ({
  assignmentId: row.assignment_id,
  classGroupId: row.class_group_id,
  currentStage: row.current_stage,
  researchCondition: row.research_condition,
  researchMode: row.research_mode,
  sessionId: row.session_id,
  status: row.status,
  studentAnonymousId: row.student_anonymous_id
});

export const chatTurnFromRow = (row: ChatTurnRow): StoredChatTurn => ({
  ...(row.request_id === null ? {} : { requestId: row.request_id }),
  ...(row.response_type === null ? {} : { responseType: row.response_type }),
  id: row.id,
  role: row.role,
  sessionId: row.session_id,
  stage: row.stage,
  text: row.text,
  timestamp: row.created_at
});

const eventFromRow = (row: EventRow): PilotEvent => ({
  id: row.id,
  payload: row.payload,
  stage: row.stage,
  timestamp: row.created_at,
  type: row.type
});

const artifactFromRow = (row: ArtifactRow): ResearchArtifact => ({
  createdAt: row.created_at,
  id: row.id,
  kind: row.kind,
  payload: row.payload,
  stage: row.stage,
  ...(row.updated_at === null ? {} : { updatedAt: row.updated_at })
});

const measureFromRow = (row: MeasureRow): ResearchMeasure => ({
  collectedAt: row.created_at,
  id: row.id,
  kind: row.kind,
  payload: row.payload,
  stage: row.stage
});

export const rowToSession = async (db: SupabaseRestClient, row: SessionRow): Promise<PilotSession> => {
  const [chatTurns, events, artifacts, measures] = await Promise.all([
    rowsForSessionIds<ChatTurnRow>(db, "chat_turns", [row.session_id]),
    rowsForSessionIds<EventRow>(db, "events", [row.session_id]),
    rowsForSessionIds<ArtifactRow>(db, "artifacts", [row.session_id]),
    rowsForSessionIds<MeasureRow>(db, "measures", [row.session_id])
  ]);
  const base = createSession(row.assignment_snapshot);
  return {
    ...base,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    artifacts: artifacts.map(artifactFromRow),
    chatTurns: chatTurns.map(chatTurnFromRow),
    createdAt: row.created_at,
    currentStage: row.current_stage as Stage,
    events: events.map(eventFromRow),
    measures: measures.map(measureFromRow),
    metadata: row.metadata,
    researchCondition: row.research_condition,
    researchMode: row.research_mode,
    sessionId: row.session_id,
    status: row.status,
    student: { anonymousId: row.student_anonymous_id },
    updatedAt: row.updated_at
  };
};
