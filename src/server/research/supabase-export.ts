import type { ResearchCondition, ResearchMode } from "../../shared/research";
import type { ExportBundle } from "./store";
import { csv } from "./csv";
import type { SupabaseRestClient } from "./supabase-rest";

type SessionExportRow = {
  readonly assignment_id: string;
  readonly class_group_id: string;
  readonly completed_at: string | null;
  readonly current_stage: string;
  readonly research_condition: ResearchCondition;
  readonly research_mode: ResearchMode;
  readonly session_id: string;
  readonly status: string;
  readonly student_anonymous_id: string;
  readonly updated_at: string;
};

type AssignmentScopeRow = {
  readonly id: string;
};

type ChildExportRow = {
  readonly assignment_id: string;
  readonly class_group_id: string;
  readonly created_at: string;
  readonly session_id: string;
  readonly stage: string;
  readonly student_anonymous_id: string;
};

type ChatTurnExportRow = ChildExportRow & {
  readonly request_id: string | null;
  readonly response_type: string | null;
  readonly role: string;
  readonly text: string;
};

type EventExportRow = ChildExportRow & {
  readonly payload: Record<string, unknown>;
  readonly type: string;
};

type ArtifactExportRow = ChildExportRow & {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
  readonly updated_at: string | null;
};

type MeasureExportRow = ChildExportRow & {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
};

const encode = (value: string): string => encodeURIComponent(value);

const inList = (values: readonly string[]): string => `in.(${values.map(encode).join(",")})`;

const rowsForSessionIds = async <T>(db: SupabaseRestClient, table: string, sessionIds: readonly string[], order = "created_at.asc"): Promise<readonly T[]> => {
  if (sessionIds.length === 0) return [];
  return db.get<readonly T[]>(table, `session_id=${inList(sessionIds)}&order=${order}`);
};

const scopedAssignmentIds = async (db: SupabaseRestClient, teacherId: string | undefined): Promise<readonly string[] | null> => {
  if (teacherId === undefined) return null;
  const rows = await db.get<readonly AssignmentScopeRow[]>("assignments", `created_by_teacher_id=eq.${encode(teacherId)}&select=id`);
  return rows.map((row) => row.id);
};

export const buildSupabaseExport = async (
  db: SupabaseRestClient,
  input: { readonly anonymized: boolean; readonly assignmentId?: string; readonly classGroupId?: string; readonly completedOnly: boolean; readonly teacherId?: string }
): Promise<ExportBundle> => {
  const teacherAssignmentIds = await scopedAssignmentIds(db, input.teacherId);
  if (teacherAssignmentIds !== null && input.assignmentId !== undefined && !teacherAssignmentIds.includes(input.assignmentId)) return emptyExport(input);
  if (teacherAssignmentIds !== null && input.assignmentId === undefined && teacherAssignmentIds.length === 0) return emptyExport(input);
  const filters = [
    "select=*",
    ...(input.classGroupId === undefined ? [] : [`class_group_id=eq.${encode(input.classGroupId)}`]),
    ...(input.assignmentId === undefined ? [] : [`assignment_id=eq.${encode(input.assignmentId)}`]),
    ...(input.assignmentId === undefined && teacherAssignmentIds !== null ? [`assignment_id=${inList(teacherAssignmentIds)}`] : []),
    ...(input.completedOnly ? ["status=in.(submitted,completed)"] : []),
    "order=updated_at.desc"
  ];
  const sessions = await db.get<readonly SessionExportRow[]>("sessions", filters.join("&"));
  const sessionIds = sessions.map((session) => session.session_id);
  const [chatTurns, events, artifacts, measures] = await Promise.all([
    rowsForSessionIds<ChatTurnExportRow>(db, "chat_turns", sessionIds),
    rowsForSessionIds<EventExportRow>(db, "events", sessionIds),
    rowsForSessionIds<ArtifactExportRow>(db, "artifacts", sessionIds),
    rowsForSessionIds<MeasureExportRow>(db, "measures", sessionIds)
  ]);
  return exportBundle(input, sessions, chatTurns, events, artifacts, measures);
};

const emptyExport = (input: { readonly anonymized: boolean; readonly completedOnly: boolean }): ExportBundle =>
  exportBundle(input, [], [], [], [], []);

const exportBundle = (
  input: { readonly anonymized: boolean; readonly completedOnly: boolean },
  sessions: readonly SessionExportRow[],
  chatTurns: readonly ChatTurnExportRow[],
  events: readonly EventExportRow[],
  artifacts: readonly ArtifactExportRow[],
  measures: readonly MeasureExportRow[]
): ExportBundle => {
  const sessionWideRows = sessions.map((session) => ({
    assignmentId: session.assignment_id,
    classGroupId: session.class_group_id,
    completedAt: session.completed_at,
    currentStage: session.current_stage,
    researchCondition: session.research_condition,
    researchMode: session.research_mode,
    sessionId: session.session_id,
    status: session.status,
    studentAnonymousId: session.student_anonymous_id,
    updatedAt: session.updated_at
  }));
  const itemLongRows = [
    ...artifacts.map((artifact) => ({ itemKind: "artifact", itemType: artifact.kind, payload: artifact.payload, sessionId: artifact.session_id, stage: artifact.stage, studentAnonymousId: artifact.student_anonymous_id, timestamp: artifact.created_at })),
    ...measures.map((measure) => ({ itemKind: "measure", itemType: measure.kind, payload: measure.payload, sessionId: measure.session_id, stage: measure.stage, studentAnonymousId: measure.student_anonymous_id, timestamp: measure.created_at }))
  ];
  const rawJson = {
    anonymized: input.anonymized,
    artifacts,
    chatTurns,
    completedOnly: input.completedOnly,
    events,
    exportedAt: new Date().toISOString(),
    measures,
    sessions: sessionWideRows
  };
  return {
    "artifacts.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "kind", "created_at", "payload"], artifacts.map((row) => ({ ...row, payload: row.payload }))),
    "chat-turns.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "role", "created_at", "request_id", "response_type", "text"], chatTurns),
    "events.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "type", "created_at", "payload"], events.map((row) => ({ ...row, payload: row.payload }))),
    "item-long.csv": csv(["sessionId", "studentAnonymousId", "stage", "itemKind", "itemType", "timestamp", "payload"], itemLongRows),
    "measures.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "kind", "created_at", "payload"], measures.map((row) => ({ ...row, payload: row.payload }))),
    "raw-json.json": rawJson,
    "session-wide.csv": csv(["sessionId", "studentAnonymousId", "assignmentId", "classGroupId", "researchMode", "researchCondition", "currentStage", "status", "updatedAt", "completedAt"], sessionWideRows)
  };
};
