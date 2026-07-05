import { ResearchModes } from "../../shared/research.js";
import type { ResearchCondition, ResearchMode } from "../../shared/research.js";

export type ExportQualitySession = {
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

export type ExportQualityChildRow = {
  readonly assignment_id: string;
  readonly class_group_id: string;
  readonly session_id: string;
  readonly student_anonymous_id: string;
};

export type ExportQualityArtifactRow = ExportQualityChildRow & {
  readonly kind: string;
};

export type ExportQualityMeasureRow = ExportQualityChildRow & {
  readonly kind: string;
};

export type ExportQualityRow = {
  readonly artifact_count: string;
  readonly assignment_id: string;
  readonly chat_turn_count: string;
  readonly class_group_id: string;
  readonly completed_at: string;
  readonly confidence_count: string;
  readonly context_mismatch_count: string;
  readonly current_stage: string;
  readonly event_count: string;
  readonly has_final_reflection: string;
  readonly has_final_submission: string;
  readonly has_reflection_survey: string;
  readonly issue_count: string;
  readonly issues: string;
  readonly measure_count: string;
  readonly problem_answer_count: string;
  readonly research_condition: string;
  readonly research_mode: string;
  readonly session_id: string;
  readonly status: string;
  readonly student_anonymous_id: string;
  readonly updated_at: string;
};

const problemKinds = ["problem1", "problem2", "problem3", "problem4"] as const;
const confidenceKinds = ["problem1_confidence", "problem2_confidence", "problem3_confidence", "problem4_confidence"] as const;

const rowsForSession = <T extends ExportQualityChildRow>(sessionId: string, rows: readonly T[]): readonly T[] =>
  rows.filter((row) => row.session_id === sessionId);

const countKinds = <T extends { readonly kind: string }>(rows: readonly T[], kinds: readonly string[]): number =>
  kinds.filter((kind) => rows.some((row) => row.kind === kind)).length;

const missingKinds = <T extends { readonly kind: string }>(rows: readonly T[], kinds: readonly string[]): readonly string[] =>
  kinds.filter((kind) => !rows.some((row) => row.kind === kind));

const hasKind = <T extends { readonly kind: string }>(rows: readonly T[], kind: string): boolean =>
  rows.some((row) => row.kind === kind);

const childContextMismatchCount = (session: ExportQualitySession, rows: readonly ExportQualityChildRow[]): number =>
  rows.filter((row) =>
    row.session_id === session.session_id &&
    (row.assignment_id !== session.assignment_id ||
      row.class_group_id !== session.class_group_id ||
      row.student_anonymous_id !== session.student_anonymous_id)
  ).length;

const completedLike = (session: ExportQualitySession): boolean =>
  session.status === "submitted" || session.status === "completed";

const qualityIssues = (
  session: ExportQualitySession,
  contextMismatchCount: number,
  artifacts: readonly ExportQualityArtifactRow[],
  measures: readonly ExportQualityMeasureRow[]
): readonly string[] => {
  const issues: string[] = [];
  if (contextMismatchCount > 0) issues.push("child_context_mismatch");
  if (completedLike(session) && session.completed_at === null) issues.push("completed_at_missing");
  if (session.research_mode === ResearchModes.understandingCalibration) {
    const missingProblems = missingKinds(artifacts, problemKinds);
    const missingConfidence = missingKinds(measures, confidenceKinds);
    if (missingProblems.length > 0) issues.push(`missing_problem_artifacts:${missingProblems.join("|")}`);
    if (missingConfidence.length > 0) issues.push(`missing_confidence_measures:${missingConfidence.join("|")}`);
    if (!hasKind(measures, "reflection_self_report")) issues.push("missing_reflection_survey");
    if (!hasKind(artifacts, "final_reflection") && !hasKind(measures, "final_reflection_self_report")) issues.push("missing_final_reflection");
  }
  if ((session.research_mode === ResearchModes.writingCoach || session.research_mode === ResearchModes.guidedWriting) && completedLike(session) && !hasKind(artifacts, "final_submission")) {
    issues.push("missing_final_submission_artifact");
  }
  return issues;
};

export const buildExportQualityRows = (input: {
  readonly artifacts: readonly ExportQualityArtifactRow[];
  readonly chatTurns: readonly ExportQualityChildRow[];
  readonly events: readonly ExportQualityChildRow[];
  readonly measures: readonly ExportQualityMeasureRow[];
  readonly sessions: readonly ExportQualitySession[];
}): readonly ExportQualityRow[] =>
  input.sessions.map((session) => {
    const sessionArtifacts = rowsForSession(session.session_id, input.artifacts);
    const sessionMeasures = rowsForSession(session.session_id, input.measures);
    const sessionEvents = rowsForSession(session.session_id, input.events);
    const sessionChatTurns = rowsForSession(session.session_id, input.chatTurns);
    const contextMismatchCount = childContextMismatchCount(session, [...sessionArtifacts, ...sessionMeasures, ...sessionEvents, ...sessionChatTurns]);
    const issues = qualityIssues(session, contextMismatchCount, sessionArtifacts, sessionMeasures);
    return {
      artifact_count: String(sessionArtifacts.length),
      assignment_id: session.assignment_id,
      chat_turn_count: String(sessionChatTurns.length),
      class_group_id: session.class_group_id,
      completed_at: session.completed_at ?? "",
      confidence_count: String(countKinds(sessionMeasures, confidenceKinds)),
      context_mismatch_count: String(contextMismatchCount),
      current_stage: session.current_stage,
      event_count: String(sessionEvents.length),
      has_final_reflection: String(hasKind(sessionArtifacts, "final_reflection") || hasKind(sessionMeasures, "final_reflection_self_report")),
      has_final_submission: String(hasKind(sessionArtifacts, "final_submission")),
      has_reflection_survey: String(hasKind(sessionMeasures, "reflection_self_report")),
      issue_count: String(issues.length),
      issues: issues.join(";"),
      measure_count: String(sessionMeasures.length),
      problem_answer_count: String(countKinds(sessionArtifacts, problemKinds)),
      research_condition: session.research_condition,
      research_mode: session.research_mode,
      session_id: session.session_id,
      status: session.status,
      student_anonymous_id: session.student_anonymous_id,
      updated_at: session.updated_at
    };
  });
