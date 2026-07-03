import { createSession } from "../../session/session";
import type { ChatTurn, CoachResponseType, PilotSession } from "../../shared/types";
import { ApiError } from "./http";
import { participantCodeHash, serverId } from "./store";
import type { DeleteResult, ExportBundle, ResearchStore, SessionContext, SessionStartResult, StoredChatTurn } from "./store";
import { buildSupabaseExport } from "./supabase-export";
import { chatTurnFromRow, contextFromSession, encode, inList, rowToSession, rowsForSessionIds } from "./supabase-session-rows";
import type { AssignmentRow, ChildContext, SessionRow, StudentRow } from "./supabase-session-rows";
import { SupabaseRestClient } from "./supabase-rest";
import type { SupabaseConfig } from "./supabase-rest";

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

const single = <T>(rows: readonly T[], message: string): T => {
  const row = rows[0];
  if (row === undefined) throw new ApiError(404, message);
  return row;
};

export const createSupabaseResearchStore = (config: SupabaseConfig): ResearchStore => {
  const db = new SupabaseRestClient(config);

  const sessionContext = async (sessionId: string): Promise<SessionRow> => single(await db.get<readonly SessionRow[]>("sessions", `session_id=eq.${encode(sessionId)}&limit=1`), "Unknown session.");

  const childContext = async (sessionId: string): Promise<ChildContext> => {
    const session = await sessionContext(sessionId);
    return {
      assignment_id: session.assignment_id,
      class_group_id: session.class_group_id,
      session_id: session.session_id,
      student_anonymous_id: session.student_anonymous_id
    };
  };

  return {
    async deleteTestData(input): Promise<DeleteResult> {
      const exportBeforeDelete = await buildSupabaseExport(db, {
        anonymized: true,
        ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
        ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
        completedOnly: false,
        ...(input.teacherId === undefined ? {} : { teacherId: input.teacherId })
      });
      if (!input.confirmExported) return { deleted: {}, exportBeforeDelete, logId: "" };
      const filters = [
        ...(input.scope === "current_session" && input.sessionId !== undefined ? [`session_id=eq.${encode(input.sessionId)}`] : []),
        ...(input.scope === "student" && input.studentAnonymousId !== undefined ? [`student_anonymous_id=eq.${encode(input.studentAnonymousId)}`] : []),
        ...(input.scope === "assignment" && input.assignmentId !== undefined ? [`assignment_id=eq.${encode(input.assignmentId)}`] : []),
        ...(input.classGroupId === undefined ? [] : [`class_group_id=eq.${encode(input.classGroupId)}`])
      ];
      const query = filters.length === 0 ? "select=*" : `select=*&${filters.join("&")}`;
      const targetSessions = await db.get<readonly SessionRow[]>("sessions", query);
      if (targetSessions.some((session) => session.research_locked)) throw new ApiError(409, "research_locked data cannot be deleted from this UI.");
      const ids = targetSessions.map((session) => session.session_id);
      const childQuery = `session_id=${inList(ids)}`;
      const deleted = ids.length === 0 ? { artifacts: 0, chat_turns: 0, events: 0, measures: 0, sessions: 0 } : {
        artifacts: (await db.delete<readonly unknown[]>("artifacts", childQuery)).length,
        chat_turns: (await db.delete<readonly unknown[]>("chat_turns", childQuery)).length,
        events: (await db.delete<readonly unknown[]>("events", childQuery)).length,
        measures: (await db.delete<readonly unknown[]>("measures", childQuery)).length,
        sessions: (await db.delete<readonly unknown[]>("sessions", childQuery)).length
      };
      const log = single(await db.insert<readonly { readonly id: string }[]>("deletion_logs", {
        assignment_id: input.assignmentId ?? null,
        class_group_id: input.classGroupId ?? null,
        counts: deleted,
        deleted_by: input.teacherId ?? null,
        deletion_scope: input.scope,
        exported_before_delete: true,
        reason: input.reason ?? null,
        session_id: input.sessionId ?? null,
        student_anonymous_id: input.studentAnonymousId ?? null
      }), "Deletion log was not created.");
      return { deleted, exportBeforeDelete, logId: log.id };
    },

    async exportData(input): Promise<ExportBundle> {
      const bundle = await buildSupabaseExport(db, input);
      await db.insert("exports", {
        assignment_id: input.assignmentId ?? null,
        class_group_id: input.classGroupId ?? null,
        completed_only: input.completedOnly,
        export_kind: "research_bundle",
        generated_by_teacher_id: input.teacherId ?? null,
        anonymized: input.anonymized,
        payload: bundle["raw-json.json"]
      });
      return bundle;
    },

    async findAssistantTurnByRequestId(sessionId, requestId): Promise<StoredChatTurn | null> {
      const rows = await db.get<readonly ChatTurnRow[]>("chat_turns", `session_id=eq.${encode(sessionId)}&request_id=eq.${encode(requestId)}&role=eq.assistant&limit=1`);
      return rows[0] === undefined ? null : chatTurnFromRow(rows[0]);
    },

    async insertArtifact(input): Promise<void> {
      const context = await childContext(input.sessionId);
      await db.upsert("artifacts", {
        ...context,
        created_at: input.timestamp ?? new Date().toISOString(),
        id: input.id,
        kind: input.kind,
        payload: input.payload,
        stage: input.stage,
        updated_at: input.updatedAt ?? null
      }, "id");
    },

    async insertChatTurn(input): Promise<StoredChatTurn> {
      const context = await childContext(input.sessionId);
      const row = single(await db.upsert<readonly ChatTurnRow[]>("chat_turns", {
        ...context,
        created_at: input.timestamp,
        id: input.id,
        request_id: input.requestId ?? null,
        response_type: input.responseType ?? null,
        role: input.role,
        stage: input.stage,
        text: input.text
      }, input.requestId === undefined ? "id" : "session_id,request_id,role"), "Chat turn was not saved.");
      return chatTurnFromRow(row);
    },

    async insertEvent(input): Promise<void> {
      const context = await childContext(input.sessionId);
      await db.upsert("events", {
        ...context,
        created_at: input.timestamp ?? new Date().toISOString(),
        id: input.id,
        payload: input.payload,
        stage: input.stage,
        type: input.type
      }, "id");
    },

    async insertMeasure(input): Promise<void> {
      const context = await childContext(input.sessionId);
      await db.upsert("measures", {
        ...context,
        created_at: input.timestamp ?? new Date().toISOString(),
        id: input.id,
        kind: input.kind,
        payload: input.payload,
        stage: input.stage
      }, "id");
    },

    async listChatTurns(sessionId): Promise<readonly StoredChatTurn[]> {
      const rows = await db.get<readonly ChatTurnRow[]>("chat_turns", `session_id=eq.${encode(sessionId)}&order=created_at.asc`);
      return rows.map(chatTurnFromRow);
    },

    async resumeSession(sessionId): Promise<SessionStartResult> {
      const row = await sessionContext(sessionId);
      const session = await rowToSession(db, row);
      return { assignment: row.assignment_snapshot, context: contextFromSession(row), session };
    },

    async startSession(input): Promise<SessionStartResult> {
      const student = single(await db.get<readonly StudentRow[]>("students", `participant_code_hash=eq.${participantCodeHash(input.participantCode)}&limit=1`), "Participant code was not found.");
      const assignmentQuery = input.assignmentId === undefined
        ? `class_group_id=eq.${encode(student.class_group_id)}&order=created_at.desc&limit=1`
        : `id=eq.${encode(input.assignmentId)}&class_group_id=eq.${encode(student.class_group_id)}&limit=1`;
      const assignment = single(await db.get<readonly AssignmentRow[]>("assignments", assignmentQuery), "No assignment is assigned to this participant.");
      const baseSession = createSession(assignment.assignment);
      const session: PilotSession = {
        ...baseSession,
        assignment: assignment.assignment,
        researchCondition: assignment.research_condition,
        researchMode: assignment.research_mode,
        sessionId: serverId("session"),
        student: { anonymousId: student.student_anonymous_id }
      };
      const row = single(await db.insert<readonly SessionRow[]>("sessions", {
        assignment_id: assignment.id,
        assignment_snapshot: assignment.assignment,
        class_group_id: assignment.class_group_id,
        current_stage: session.currentStage,
        metadata: session.metadata,
        research_condition: assignment.research_condition,
        research_mode: assignment.research_mode,
        session_id: session.sessionId,
        status: session.status,
        student_anonymous_id: student.student_anonymous_id
      }), "Session was not created.");
      return { assignment: assignment.assignment, context: contextFromSession(row), session: { ...session, createdAt: row.created_at, updatedAt: row.updated_at } };
    },

    async updateStage(input): Promise<SessionContext> {
      const body = {
        ...(input.completedAt === undefined ? {} : { completed_at: input.completedAt }),
        current_stage: input.currentStage,
        ...(input.status === undefined ? {} : { status: input.status }),
        updated_at: new Date().toISOString()
      };
      const row = single(await db.patch<readonly SessionRow[]>("sessions", `session_id=eq.${encode(input.sessionId)}`, body), "Session was not updated.");
      return contextFromSession(row);
    }
  };
};
