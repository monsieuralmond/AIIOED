import { describe, expect, it } from "vitest";
import { ResearchConditions, ResearchModes } from "../../shared/research.js";
import { buildExportQualityRows } from "./export-quality.js";
import type { ExportQualityArtifactRow, ExportQualityMeasureRow, ExportQualitySession } from "./export-quality.js";

const session = (input: {
  readonly id: string;
  readonly mode: string;
  readonly status?: string;
}): ExportQualitySession => ({
  assignment_id: "assignment-1",
  class_group_id: "class-1",
  completed_at: input.status === "submitted" ? "2026-07-05T00:00:00.000Z" : null,
  current_stage: "completed",
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
});
