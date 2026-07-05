import type { ResearchCondition, ResearchMode } from "../../shared/research.js";
import { ResearchModes } from "../../shared/research.js";
import type { Assignment, ChatTurn, CoachResponseType, PilotEvent, PilotSession, Stage } from "../../shared/types.js";
import { createSession } from "../../session/session.js";
import { researchPlatformFilesFromSessions } from "../../export/export.js";
import type { ExportBundle } from "./store.js";
import { csv } from "./csv.js";
import { buildExportQualityRows } from "./export-quality.js";
import { ApiError } from "./http.js";
import type { SupabaseRestClient } from "./supabase-rest.js";

type SessionExportRow = {
  readonly assignment_id: string;
  readonly assignment_snapshot?: Assignment;
  readonly class_group_id: string;
  readonly completed_at: string | null;
  readonly created_at?: string;
  readonly current_stage: string;
  readonly metadata?: PilotSession["metadata"];
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

type ProblemExportFields = {
  readonly answer: string;
  readonly answerLength: string;
  readonly confidence: string;
  readonly durationMs: string;
};

const encode = (value: string): string => encodeURIComponent(value);

const inList = (values: readonly string[]): string => `in.(${values.map(encode).join(",")})`;

const exportSessionLimit = (): number => {
  const raw = process.env["EXPORT_SESSION_LIMIT"];
  if (raw === undefined) return 500;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
};

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
  const sessionLimit = exportSessionLimit();
  if (sessions.length > sessionLimit) {
    throw new ApiError(413, `Export is limited to ${sessionLimit} sessions. Filter by assignment or class group before exporting.`);
  }
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

const payloadString = (payload: Readonly<Record<string, unknown>> | undefined, key: string): string => {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
};

const payloadNumber = (payload: Readonly<Record<string, unknown>> | undefined, key: string): number | null => {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const csvNumber = (value: number | null): string => value === null ? "" : String(value);

const problemFields = (sessionId: string, problemKey: "problem1" | "problem2" | "problem3" | "problem4", artifacts: readonly ArtifactExportRow[], measures: readonly MeasureExportRow[]): ProblemExportFields => {
  const artifact = artifacts.find((row) => row.session_id === sessionId && row.kind === problemKey);
  const measure = measures.find((row) => row.session_id === sessionId && row.kind === `${problemKey}_confidence`);
  const answer = payloadString(artifact?.payload, "answer");
  return {
    answer,
    answerLength: answer.length === 0 ? "" : String(answer.length),
    confidence: csvNumber(payloadNumber(measure?.payload, "confidence")),
    durationMs: csvNumber(payloadNumber(artifact?.payload, "durationMs"))
  };
};

const confidenceTrajectory = (sessionId: string, measures: readonly MeasureExportRow[]): readonly number[] =>
  ["problem1_confidence", "problem2_confidence", "problem3_confidence", "problem4_confidence"].flatMap((kind) => {
    const confidence = payloadNumber(measures.find((row) => row.session_id === sessionId && row.kind === kind)?.payload, "confidence");
    return confidence === null ? [] : [confidence];
  });

const confidenceDrop = (trajectory: readonly number[]): string => {
  const first = trajectory[0];
  const last = trajectory.at(-1);
  return first === undefined || last === undefined ? "" : String(first - last);
};

const topicIdForSession = (sessionId: string, artifacts: readonly ArtifactExportRow[], measures: readonly MeasureExportRow[], events: readonly EventExportRow[]): string =>
  payloadString(artifacts.find((row) => row.session_id === sessionId)?.payload, "topicId") ||
  payloadString(measures.find((row) => row.session_id === sessionId)?.payload, "topicId") ||
  payloadString(events.find((row) => row.session_id === sessionId)?.payload, "topicId");

const hasKind = (sessionId: string, kind: string, rows: readonly (ArtifactExportRow | MeasureExportRow)[]): boolean =>
  rows.some((row) => row.session_id === sessionId && row.kind === kind);

const defaultAssignment = (session: SessionExportRow): Assignment => ({
  id: session.assignment_id,
  passage: "",
  question: "",
  researchCondition: session.research_condition,
  researchMode: session.research_mode,
  title: session.assignment_id,
  ...(session.class_group_id.length === 0 ? {} : { classGroupId: session.class_group_id }),
  essayType: "",
  gradeLevel: "",
  targetLength: ""
});

const isCoachResponseType = (value: string): value is CoachResponseType =>
  value === "clarify" ||
  value === "question" ||
  value === "evidence_check" ||
  value === "redirect" ||
  value === "revision_guidance" ||
  value === "refusal";

const chatTurnFromRow = (row: ChatTurnExportRow): ChatTurn => ({
  id: `${row.session_id}:${row.created_at}:${row.role}`,
  role: row.role === "assistant" ? "assistant" : "student",
  ...(row.response_type === null || !isCoachResponseType(row.response_type) ? {} : { responseType: row.response_type }),
  text: row.text,
  timestamp: row.created_at
});

const eventFromRow = (row: EventExportRow): PilotEvent => ({
  id: `${row.session_id}:${row.created_at}:${row.type}`,
  payload: row.payload,
  stage: row.stage as Stage,
  timestamp: row.created_at,
  type: row.type as PilotEvent["type"]
});

const sessionFromRows = (
  session: SessionExportRow,
  chatTurns: readonly ChatTurnExportRow[],
  events: readonly EventExportRow[],
  artifacts: readonly ArtifactExportRow[],
  measures: readonly MeasureExportRow[]
): PilotSession => {
  const assignment = session.assignment_snapshot ?? defaultAssignment(session);
  const base = createSession(assignment);
  return {
    ...base,
    ...(session.completed_at === null ? {} : { completedAt: session.completed_at }),
    artifacts: artifacts.filter((row) => row.session_id === session.session_id).map((row) => ({
      ...(row.updated_at === null ? {} : { updatedAt: row.updated_at }),
      createdAt: row.created_at,
      id: `${row.session_id}:${row.kind}:${row.created_at}`,
      kind: row.kind,
      payload: row.payload,
      stage: row.stage
    })),
    chatTurns: chatTurns.filter((row) => row.session_id === session.session_id).map(chatTurnFromRow),
    createdAt: session.created_at ?? session.updated_at,
    currentStage: session.current_stage as Stage,
    events: events.filter((row) => row.session_id === session.session_id).map(eventFromRow),
    measures: measures.filter((row) => row.session_id === session.session_id).map((row) => ({
      collectedAt: row.created_at,
      id: `${row.session_id}:${row.kind}:${row.created_at}`,
      kind: row.kind,
      payload: row.payload,
      stage: row.stage
    })),
    metadata: session.metadata ?? base.metadata,
    modules: assignment.calibrationConfig === undefined ? base.modules : { ...base.modules, understandingCalibration: { ...base.modules.understandingCalibration, ...assignment.calibrationConfig, version: "1.0" } },
    researchCondition: session.research_condition,
    researchMode: session.research_mode,
    sessionId: session.session_id,
    status: session.status,
    student: { anonymousId: session.student_anonymous_id },
    updatedAt: session.updated_at
  };
};

const exportBundle = (
  input: { readonly anonymized: boolean; readonly completedOnly: boolean },
  sessions: readonly SessionExportRow[],
  chatTurns: readonly ChatTurnExportRow[],
  events: readonly EventExportRow[],
  artifacts: readonly ArtifactExportRow[],
  measures: readonly MeasureExportRow[]
): ExportBundle => {
  const sessionWideRows = sessions.map((session) => {
    const problem1 = problemFields(session.session_id, "problem1", artifacts, measures);
    const problem2 = problemFields(session.session_id, "problem2", artifacts, measures);
    const problem3 = problemFields(session.session_id, "problem3", artifacts, measures);
    const problem4 = problemFields(session.session_id, "problem4", artifacts, measures);
    const trajectory = confidenceTrajectory(session.session_id, measures);
    const completedProblemCount = [problem1, problem2, problem3, problem4].filter((problem) => problem.answer.length > 0 && problem.confidence.length > 0).length;
    return {
      assignmentId: session.assignment_id,
      classGroupId: session.class_group_id,
      completedAt: session.completed_at,
      completedProblemCount: String(completedProblemCount),
      confidenceDrop: confidenceDrop(trajectory),
      confidenceTrajectory: JSON.stringify(trajectory),
      currentStage: session.current_stage,
      hasFinalReflection: String(hasKind(session.session_id, "final_reflection", artifacts) || hasKind(session.session_id, "final_reflection_self_report", measures)),
      hasReflectionSurvey: String(hasKind(session.session_id, "reflection_self_report", measures)),
      problem1_answer: problem1.answer,
      problem1_answerLength: problem1.answerLength,
      problem1_confidence: problem1.confidence,
      problem1_durationMs: problem1.durationMs,
      problem2_answer: problem2.answer,
      problem2_answerLength: problem2.answerLength,
      problem2_confidence: problem2.confidence,
      problem2_durationMs: problem2.durationMs,
      problem3_answer: problem3.answer,
      problem3_answerLength: problem3.answerLength,
      problem3_confidence: problem3.confidence,
      problem3_durationMs: problem3.durationMs,
      problem4_answer: problem4.answer,
      problem4_answerLength: problem4.answerLength,
      problem4_confidence: problem4.confidence,
      problem4_durationMs: problem4.durationMs,
      researchCondition: session.research_condition,
      researchMode: session.research_mode,
      sessionId: session.session_id,
      status: session.status,
      studentAnonymousId: session.student_anonymous_id,
      topicId: topicIdForSession(session.session_id, artifacts, measures, events),
      updatedAt: session.updated_at
    };
  }).filter((row) => !input.completedOnly || (
    row.status === "submitted" &&
    row.currentStage === "completed" &&
    row.completedProblemCount === "4" &&
    row.hasReflectionSurvey === "true" &&
    row.hasFinalReflection === "true"
  ));
  const includedSessionIds = new Set(sessionWideRows.map((row) => row.sessionId));
  const includedArtifacts = artifacts.filter((row) => includedSessionIds.has(row.session_id));
  const includedMeasures = measures.filter((row) => includedSessionIds.has(row.session_id));
  const includedEvents = events.filter((row) => includedSessionIds.has(row.session_id));
  const includedChatTurns = chatTurns.filter((row) => includedSessionIds.has(row.session_id));
  const platformSessions = sessions
    .filter((session) => includedSessionIds.has(session.session_id) && session.research_mode === ResearchModes.understandingCalibration)
    .map((session) => sessionFromRows(session, includedChatTurns, includedEvents, includedArtifacts, includedMeasures));
  const platformFiles = researchPlatformFilesFromSessions(platformSessions, { completedOnly: false });
  const itemLongRows = [
    ...includedArtifacts.map((artifact) => ({ assignmentId: artifact.assignment_id, classGroupId: artifact.class_group_id, itemKind: "artifact", itemType: artifact.kind, payload: artifact.payload, sessionId: artifact.session_id, stage: artifact.stage, studentAnonymousId: artifact.student_anonymous_id, timestamp: artifact.created_at })),
    ...includedMeasures.map((measure) => ({ assignmentId: measure.assignment_id, classGroupId: measure.class_group_id, itemKind: "measure", itemType: measure.kind, payload: measure.payload, sessionId: measure.session_id, stage: measure.stage, studentAnonymousId: measure.student_anonymous_id, timestamp: measure.created_at }))
  ];
  const rawJson = {
    anonymized: input.anonymized,
    artifacts: includedArtifacts,
    chatTurns: includedChatTurns,
    completedOnly: input.completedOnly,
    dataQuality: buildExportQualityRows({
      artifacts: includedArtifacts,
      chatTurns: includedChatTurns,
      events: includedEvents,
      measures: includedMeasures,
      sessions: sessionWideRows.map((row) => ({
        assignment_id: row.assignmentId,
        class_group_id: row.classGroupId,
        completed_at: row.completedAt,
        current_stage: row.currentStage,
        research_condition: row.researchCondition,
        research_mode: row.researchMode,
        session_id: row.sessionId,
        status: row.status,
        student_anonymous_id: row.studentAnonymousId,
        updated_at: row.updatedAt
      }))
    }),
    events: includedEvents,
    exportedAt: new Date().toISOString(),
    measures: includedMeasures,
    sessions: sessionWideRows
  };
  return {
    "artifacts.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "kind", "created_at", "payload"], includedArtifacts.map((row) => ({ ...row, payload: row.payload }))),
    "benchmark.jsonl": platformFiles["benchmark.jsonl"],
    "chat-turns.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "role", "created_at", "request_id", "response_type", "text"], includedChatTurns),
    "data-quality.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "research_mode", "research_condition", "status", "current_stage", "updated_at", "completed_at", "chat_turn_count", "event_count", "artifact_count", "measure_count", "problem_answer_count", "confidence_count", "has_reflection_survey", "has_final_reflection", "has_final_submission", "context_mismatch_count", "issue_count", "issues"], rawJson.dataQuality),
    "events.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "type", "created_at", "payload"], includedEvents.map((row) => ({ ...row, payload: row.payload }))),
    "item-long.csv": platformFiles["item-long.csv"],
    "measures.csv": csv(["session_id", "student_anonymous_id", "assignment_id", "class_group_id", "stage", "kind", "created_at", "payload"], includedMeasures.map((row) => ({ ...row, payload: row.payload }))),
    "raw-json.json": rawJson,
    "raw-events.csv": platformFiles["raw-events.csv"],
    "session-wide.csv": platformFiles["session-wide.csv"]
  };
};
