import { createSession } from "../../session/session.js";
import { isAssignmentAssignedToStudent } from "../../shared/assignment-access.js";
import type { ChatTurn, CoachResponseType, PilotSession } from "../../shared/types.js";
import { ApiError } from "./http.js";
import { credentialHash } from "./credentials.js";
import { assertSessionWritable, participantCodeHash, serverId } from "./store.js";
import type { DeleteResult, ExportBundle, ResearchStore, SessionContext, SessionDelta, SessionStartResult, StoredChatTurn } from "./store.js";
import { buildSupabaseExport } from "./supabase-export.js";
import { chatTurnFromRow, contextFromSession, encode, inList, rowToChatSession, rowToSession, rowsForSessionIds, rowsToSessions } from "./supabase-session-rows.js";
import type { AssignmentRow, ChildContext, SessionRow, StudentRow } from "./supabase-session-rows.js";
import { SupabaseRestClient } from "./supabase-rest.js";
import type { SupabaseConfig } from "./supabase-rest.js";
import { pruneOldExports } from "./export-retention.js";

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

type ChatFailureEventRow = {
  readonly payload: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isSubmittedSessionRow = (row: Pick<SessionRow, "completed_at" | "status">): boolean =>
  row.completed_at !== null || row.status === "submitted" || row.status === "completed";

const deleteResultFromRpc = (value: unknown): Pick<DeleteResult, "deleted" | "logId"> => {
  if (!isRecord(value)) throw new ApiError(500, "Delete result was not returned.");
  const deleted = value["deleted"];
  const logId = value["logId"];
  if (!isRecord(deleted) || typeof logId !== "string") throw new ApiError(500, "Delete result shape is invalid.");
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(deleted)) {
    if (typeof count === "number" && Number.isFinite(count)) counts[key] = count;
  }
  return { deleted: counts, logId };
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

  const childContextFromSessionContext = (context: SessionContext): ChildContext => ({
    assignment_id: context.assignmentId,
    class_group_id: context.classGroupId,
    session_id: context.sessionId,
    student_anonymous_id: context.studentAnonymousId
  });

  const chatTurnByRequest = async (sessionId: string, requestId: string, role: ChatTurn["role"]): Promise<ChatTurnRow | undefined> => {
    const rows = await db.get<readonly ChatTurnRow[]>("chat_turns", `session_id=eq.${encode(sessionId)}&request_id=eq.${encode(requestId)}&role=eq.${role}&limit=1`);
    return rows[0];
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
      try {
        const result = deleteResultFromRpc(await db.rpc("delete_research_test_data", {
          payload: {
            assignmentId: input.assignmentId ?? null,
            classGroupId: input.classGroupId ?? null,
            reason: input.reason ?? null,
            scope: input.scope,
            sessionId: input.sessionId ?? null,
            studentAnonymousId: input.studentAnonymousId ?? null,
            teacherId: input.teacherId ?? null
          }
        }));
        return { ...result, exportBeforeDelete };
      } catch (error) {
        if (error instanceof ApiError && error.message.includes("locked research data")) {
          throw new ApiError(409, "잠금 처리된 연구 데이터가 있어 일반 화면에서 삭제할 수 없습니다.");
        }
        throw error;
      }
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
      await pruneOldExports(db);
      return bundle;
    },

    async findAssistantTurnByRequestId(sessionId, requestId): Promise<StoredChatTurn | null> {
      const row = await chatTurnByRequest(sessionId, requestId, "assistant");
      return row === undefined ? null : chatTurnFromRow(row);
    },

    async hasChatFailureForRequestId(sessionId, requestId): Promise<boolean> {
      const rows = await db.get<readonly ChatFailureEventRow[]>(
        "events",
        `select=payload&session_id=eq.${encode(sessionId)}&type=eq.calibration_chat_failed&order=created_at.desc&limit=20`
      );
      return rows.some((row) => row.payload["requestId"] === requestId);
    },

    async insertArtifact(input): Promise<void> {
      assertSessionWritable(await sessionContext(input.sessionId));
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
      if (input.context !== undefined) assertSessionWritable(input.context);
      else assertSessionWritable(await sessionContext(input.sessionId));
      const context = input.context === undefined ? await childContext(input.sessionId) : childContextFromSessionContext(input.context);
      const payload = {
        ...context,
        created_at: input.timestamp,
        id: input.id,
        request_id: input.requestId ?? null,
        response_type: input.responseType ?? null,
        role: input.role,
        stage: input.stage,
        text: input.text
      };
      const rows = input.requestId === undefined
        ? await db.upsert<readonly ChatTurnRow[]>("chat_turns", payload, "id")
        : await db.upsertIgnoringDuplicates<readonly ChatTurnRow[]>("chat_turns", payload, "session_id,request_id,role");
      const row = rows[0] ?? (input.requestId === undefined ? undefined : await chatTurnByRequest(input.sessionId, input.requestId, input.role));
      if (row === undefined) throw new ApiError(500, "Chat turn was not saved.");
      return chatTurnFromRow(row);
    },

    async insertEvent(input): Promise<void> {
      if (input.context !== undefined) assertSessionWritable(input.context);
      else assertSessionWritable(await sessionContext(input.sessionId));
      const context = input.context === undefined ? await childContext(input.sessionId) : childContextFromSessionContext(input.context);
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
      assertSessionWritable(await sessionContext(input.sessionId));
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

    async listSessions(input) {
      const assignmentIds = input.teacherId === undefined
        ? []
        : (await db.get<readonly { readonly id: string }[]>("assignments", `select=id&created_by_teacher_id=eq.${encode(input.teacherId)}`)).map((assignment) => assignment.id);
      if (input.teacherId !== undefined && assignmentIds.length === 0) return { sessions: [] };
      const filters = [
        ...(input.assignmentId === undefined ? [] : [`assignment_id=eq.${encode(input.assignmentId)}`]),
        ...(input.classGroupId === undefined ? [] : [`class_group_id=eq.${encode(input.classGroupId)}`]),
        ...(input.teacherId === undefined ? [] : [`assignment_id=${inList(assignmentIds)}`])
      ];
      const query = `select=*&order=updated_at.desc${filters.length === 0 ? "" : `&${filters.join("&")}`}`;
      const rows = await db.get<readonly SessionRow[]>("sessions", query);
      return { sessions: await rowsToSessions(db, rows) };
    },

    async resetStudentSession(input) {
      await db.rpc("reset_research_session", {
        p_session_id: input.sessionId,
        p_teacher_id: input.teacherId
      });
      return { sessionId: input.sessionId };
    },

    async resumeSession(sessionId): Promise<SessionStartResult> {
      const row = await sessionContext(sessionId);
      const session = await rowToSession(db, row);
      return { assignment: row.assignment_snapshot, context: contextFromSession(row), session };
    },

    async resumeSessionForChat(sessionId): Promise<SessionStartResult> {
      const row = await sessionContext(sessionId);
      const session = await rowToChatSession(db, row);
      return { assignment: row.assignment_snapshot, context: contextFromSession(row), session };
    },

    async startSession(input): Promise<SessionStartResult> {
      const inputLoginId = input.loginId?.trim() ?? "";
      const inputPassword = input.password?.trim() ?? "";
      const isCredentialStart = inputLoginId.length > 0 && inputPassword.length > 0;
      const studentQuery = isCredentialStart
        ? `login_id=eq.${encode(inputLoginId)}&limit=1`
        : input.participantCode === undefined
          ? null
          : `participant_code_hash=eq.${participantCodeHash(input.participantCode)}&limit=1`;
      if (studentQuery === null) throw new ApiError(401, "Student credentials are invalid.");
      const student = single(
        await db.get<readonly StudentRow[]>("students", studentQuery),
        isCredentialStart ? "Student credentials are invalid." : "Participant code was not found."
      );
      const isPasswordCredentialStart = inputPassword.length > 0;
      if (isPasswordCredentialStart && input.loginId !== undefined && student.login_id !== null && input.loginId.trim().toLowerCase() !== student.login_id.trim().toLowerCase()) {
        throw new ApiError(401, "Student credentials are invalid.");
      }
      const assignmentQuery = input.assignmentId === undefined
        ? `class_group_id=eq.${encode(student.class_group_id)}&order=created_at.desc`
        : `id=eq.${encode(input.assignmentId)}&class_group_id=eq.${encode(student.class_group_id)}&limit=1`;
      const assignments = await db.get<readonly AssignmentRow[]>("assignments", assignmentQuery);
      const assignment = assignments.find((row) => isAssignmentAssignedToStudent({ ...row.assignment, assignedStudentIds: row.assignment.assignedStudentIds ?? [], classGroupId: row.class_group_id }, { classGroupId: student.class_group_id, id: student.id }));
      if (assignment === undefined) throw new ApiError(404, "No assignment is assigned to this participant.");
      const teacherPreviewAuthorized = input.teacherId !== undefined && assignment.created_by_teacher_id === input.teacherId;
      if (isPasswordCredentialStart && !teacherPreviewAuthorized) {
        if (student.password_hash === null || credentialHash(inputPassword) !== student.password_hash) throw new ApiError(401, "Student credentials are invalid.");
      }
      const assignedAssignment = { ...assignment.assignment, assignedStudentIds: assignment.assignment.assignedStudentIds ?? [], classGroupId: assignment.class_group_id };
      const previousSessions = await db.get<readonly SessionRow[]>(
        "sessions",
        `select=*&assignment_id=eq.${encode(assignment.id)}&student_anonymous_id=eq.${encode(student.student_anonymous_id)}&order=updated_at.desc`
      );
      if (previousSessions.some(isSubmittedSessionRow)) throw new ApiError(409, "이미 제출한 과제입니다.");
      const existingSession = previousSessions[0];
      if (existingSession !== undefined) {
        const session = await rowToSession(db, existingSession);
        return { assignment: existingSession.assignment_snapshot, context: contextFromSession(existingSession), session };
      }
      const baseSession = createSession(assignedAssignment);
      const session: PilotSession = {
        ...baseSession,
        assignment: assignedAssignment,
        researchCondition: assignment.research_condition,
        researchMode: assignment.research_mode,
        sessionId: serverId("session"),
        student: { anonymousId: student.student_anonymous_id }
      };
      const insertedRows = await db.upsertIgnoringDuplicates<readonly SessionRow[]>("sessions", {
        assignment_id: assignment.id,
        assignment_snapshot: assignedAssignment,
        class_group_id: assignment.class_group_id,
        current_stage: session.currentStage,
        metadata: session.metadata,
        research_condition: assignment.research_condition,
        research_mode: assignment.research_mode,
        session_id: session.sessionId,
        status: session.status,
        student_anonymous_id: student.student_anonymous_id
      }, "assignment_id,student_anonymous_id");
      const row = insertedRows[0] ?? single(await db.get<readonly SessionRow[]>(
        "sessions",
        `assignment_id=eq.${encode(assignment.id)}&student_anonymous_id=eq.${encode(student.student_anonymous_id)}&limit=1`
      ), "Session was not created.");
      if (isSubmittedSessionRow(row)) throw new ApiError(409, "이미 제출한 과제입니다.");
      return {
        assignment: assignedAssignment,
        context: contextFromSession(row),
        session: {
          ...session,
          createdAt: row.created_at,
          sessionId: row.session_id,
          updatedAt: row.updated_at
        }
      };
    },

    async syncSessionDelta(input: SessionDelta): Promise<void> {
      await db.rpc("sync_research_session", {
        payload: input
      });
    },

    async updateStage(input): Promise<SessionContext> {
      const current = await sessionContext(input.sessionId);
      assertSessionWritable(current);
      const locksResearch = input.status === "submitted" || input.status === "completed";
      const query = "session_id=eq." + encode(input.sessionId) + "&research_locked=eq.false";
      const body = {
        ...(input.completedAt === undefined ? {} : { completed_at: input.completedAt }),
        current_stage: input.currentStage,
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(locksResearch ? { research_locked: true } : {}),
        updated_at: new Date().toISOString()
      };
      const rows = await db.patch<readonly SessionRow[]>("sessions", query, body);
      if (rows.length === 0) throw new ApiError(409, "제출된 연구 데이터는 더 이상 수정할 수 없습니다.");
      const row = single(rows, "Session was not updated.");
      return contextFromSession(row);
    }
  };
};
