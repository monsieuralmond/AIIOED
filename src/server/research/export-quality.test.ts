import { describe, expect, it } from "vitest";
import { ResearchConditions, ResearchModes } from "../../shared/research.js";
import { buildExportQualityRows } from "./export-quality.js";
import type { ExportQualityArtifactRow, ExportQualityMeasureRow, ExportQualitySession } from "./export-quality.js";

const session = (input: {
  readonly id: string;
  readonly mode: string;
  readonly status?: string;
  readonly problemNumbers?: readonly (1 | 2 | 3 | 4)[];
}): ExportQualitySession => ({
  assignment_id: "assignment-1",
  class_group_id: "class-1",
  completed_at: input.status === "submitted" ? "2026-07-05T00:00:00.000Z" : null,
  current_stage: "completed",
  ...(input.problemNumbers === undefined ? {} : {
    assignment_snapshot: {
      calibrationConfig: { independentProblems: input.problemNumbers.map((number) => ({ number, prompt: `문제 ${number}`, title: `문제 ${number}` })) },
      gradeLevel: "초등 고학년",
      id: "assignment-1",
      passage: "설명 자료",
      question: "설명하세요.",
      targetLength: "",
      title: "동적 문항"
    }
  }),
  research_condition: ResearchConditions.singleGroupBaseline,
  research_mode: input.mode,
  session_id: input.id,
  status: input.status ?? "in_progress",
  student_anonymous_id: `anon-${input.id}`,
  updated_at: "2026-07-05T00:00:00.000Z"
});

const artifact = (sessionId: string, kind: string): ExportQualityArtifactRow => ({
  assignment_id: "assignment-1",
  class_group_id: "class-1",
  kind,
  session_id: sessionId,
  student_anonymous_id: `anon-${sessionId}`
});

const measure = (sessionId: string, kind: string): ExportQualityMeasureRow => ({
  assignment_id: "assignment-1",
  class_group_id: "class-1",
  kind,
  session_id: sessionId,
  student_anonymous_id: `anon-${sessionId}`
});

describe("export quality rows", () => {
  it("reports missing raw records for incomplete understanding calibration sessions", () => {
    const rows = buildExportQualityRows({
      artifacts: [
        artifact("session-1", "problem1"),
        artifact("session-1", "problem2"),
        artifact("session-1", "problem3")
      ],
      chatTurns: [],
      events: [],
      measures: [
        measure("session-1", "problem1_confidence"),
        measure("session-1", "problem2_confidence"),
        measure("session-1", "problem3_confidence"),
        measure("session-1", "reflection_self_report")
      ],
      sessions: [session({ id: "session-1", mode: ResearchModes.understandingCalibration })]
    });

    expect(rows[0]?.problem_answer_count).toBe("3");
    expect(rows[0]?.confidence_count).toBe("3");
    expect(rows[0]?.issues).toContain("missing_problem_artifacts:problem4");
    expect(rows[0]?.issues).toContain("missing_confidence_measures:problem4_confidence");
    expect(rows[0]?.issues).toContain("missing_final_reflection");
  });

  it("does not flag completed guided writing sessions when final submission is present", () => {
    const rows = buildExportQualityRows({
      artifacts: [artifact("session-2", "final_submission")],
      chatTurns: [{ assignment_id: "assignment-1", class_group_id: "class-1", session_id: "session-2", student_anonymous_id: "anon-session-2" }],
      events: [],
      measures: [],
      sessions: [session({ id: "session-2", mode: ResearchModes.guidedWriting, status: "submitted" })]
    });

    expect(rows[0]?.has_final_submission).toBe("true");
    expect(rows[0]?.issue_count).toBe("0");
  });

  it("uses non-contiguous configured problem numbers for calibration quality checks", () => {
    const rows = buildExportQualityRows({
      artifacts: [artifact("session-3", "problem1"), artifact("session-3", "problem4"), artifact("session-3", "final_reflection")],
      chatTurns: [],
      events: [],
      measures: [measure("session-3", "problem1_confidence"), measure("session-3", "problem4_confidence"), measure("session-3", "reflection_self_report")],
      sessions: [session({ id: "session-3", mode: ResearchModes.understandingCalibration, status: "submitted", problemNumbers: [1, 4] })]
    });

    expect(rows[0]?.problem_answer_count).toBe("2");
    expect(rows[0]?.confidence_count).toBe("2");
    expect(rows[0]?.issue_count).toBe("0");
  });
});
