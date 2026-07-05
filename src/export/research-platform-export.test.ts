import { describe, expect, it } from "vitest";
import { createInitialPilotState, createSession } from "../session/session.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import { ResearchModes, UnderstandingCalibrationStages } from "../shared/research.js";
import { ResearchActivityKeys } from "../shared/research-platform.js";
import type { Assignment, PilotSession } from "../shared/types.js";
import {
  buildResearchModelBundles,
  exportResearchItemLongRowsFromBundles,
  exportResearchRawEventRowsFromBundles,
  exportResearchSessionWideRowsFromBundles,
  stringifyResearchBenchmarkJsonl
} from "./export.js";

const makeState = () => {
  const student = sampleStudents[0];
  if (student === undefined) throw new Error("Expected a sample student.");
  const assignment = {
    ...sampleAssignment,
    calibrationConfig: { topic: "양자컴퓨터" },
    researchMode: ResearchModes.understandingCalibration
  } satisfies Assignment;
  const base = createSession(assignment, student);
  const session: PilotSession = {
    ...base,
    artifacts: [{
      createdAt: "2026-07-02T00:03:00.000Z",
      id: "artifact-problem1",
      kind: "problem1",
      payload: { answer: "양자컴퓨터는 양자의 성질을 이용해 계산하는 컴퓨터입니다.", durationMs: 60000, promptVersion: "prompt-v1" },
      stage: UnderstandingCalibrationStages.problem1
    }],
    events: [{
      id: "event-confidence",
      payload: { confidence: 4, questionNumber: 1 },
      stage: UnderstandingCalibrationStages.problem1Confidence,
      timestamp: "2026-07-02T00:04:00.000Z",
      type: "confidence_submitted"
    }],
    measures: [{
      collectedAt: "2026-07-02T00:04:00.000Z",
      id: "measure-confidence1",
      kind: "problem1_confidence",
      payload: { confidence: 4, questionNumber: 1 },
      stage: UnderstandingCalibrationStages.problem1Confidence
    }],
    researchMode: ResearchModes.understandingCalibration,
    status: "submitted"
  };
  return { ...createInitialPilotState(), sessions: [session] };
};

describe("research platform export", () => {
  it("maps legacy Understanding Calibration records into generic activity, response, judgment, and benchmark rows", () => {
    const state = makeState();
    const bundles = buildResearchModelBundles(state, { completedOnly: false, exportedAt: "2026-07-04T00:00:00.000Z" });
    const rawEvents = exportResearchRawEventRowsFromBundles(bundles);
    const itemRows = exportResearchItemLongRowsFromBundles(bundles);
    const wideRows = exportResearchSessionWideRowsFromBundles(bundles);
    const benchmarkLine = stringifyResearchBenchmarkJsonl(state, { completedOnly: false, exportedAt: "2026-07-04T00:00:00.000Z" }).split("\n")[0];

    expect(rawEvents).toContainEqual(expect.objectContaining({
      activityKey: ResearchActivityKeys.coreExplanation,
      eventType: "judgment_submitted",
      sourceLegacyType: "confidence_submitted"
    }));
    expect(itemRows).toContainEqual(expect.objectContaining({
      activityKey: ResearchActivityKeys.coreExplanation,
      itemKind: "confidence",
      valueNumeric: "4"
    }));
    expect(wideRows[0]).toEqual(expect.objectContaining({
      core_explanation__judgment_confidence: "4"
    }));
    expect(benchmarkLine).toBeDefined();
    if (benchmarkLine === undefined) throw new Error("Expected benchmark JSONL line.");
    const benchmark: unknown = JSON.parse(benchmarkLine);
    expect(benchmark).toEqual(expect.objectContaining({
      manifest: expect.objectContaining({ schemaVersion: "research-platform-schema.v1" }),
      ready: expect.objectContaining({ isReady: false })
    }));
  });
});
