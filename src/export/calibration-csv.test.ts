import { describe, expect, it } from "vitest";
import { createInitialPilotState, createSession } from "../session/session";
import { sampleAssignment, sampleStudents } from "../shared/fixtures";
import { ResearchModes, UnderstandingCalibrationStages } from "../shared/research";
import type { Assignment, PilotSession } from "../shared/types";
import { independentProblems, predictionSurveyItems } from "../app/understanding-calibration-data";
import {
  exportCalibrationAttritionRows,
  exportCalibrationChatTurnRows,
  exportCalibrationItemRows,
  exportCalibrationManualEvaluationRows,
  exportCalibrationRubricCodeRows,
  exportCalibrationSessionRows,
  exportDataset,
  stringifyCalibrationAttritionCsv,
  stringifyCalibrationChatTurnsCsv,
  stringifyCalibrationItemsCsv,
  stringifyCalibrationManualEvaluationCsv,
  stringifyCalibrationRubricCodesCsv,
  stringifyCalibrationSessionsCsv
} from "./export";

const makeCalibrationState = () => {
  const student = sampleStudents[0];
  if (student === undefined) throw new Error("Expected a sample student.");
  const assignment = {
    ...sampleAssignment,
    calibrationConfig: {
      independentProblems: independentProblems.map((problem) => ({
        number: problem.number,
        prompt: problem.number === 1 ? "맞춤 문제 1 지시문" : problem.prompt,
        title: problem.number === 1 ? "맞춤 자유 설명" : problem.title
      })),
      predictionSurveyItems: predictionSurveyItems.map((item) => ({
        ...item,
        label: item.id === "pred_can_explain_concept" ? "나는 맞춤 주제를 설명할 수 있다." : item.label
      })),
      topic: "양자컴퓨터"
    },
    researchMode: ResearchModes.understandingCalibration
  } satisfies Assignment;
  const baseSession = createSession(assignment, student);
  const completeSession: PilotSession = {
    ...baseSession,
    artifacts: [
      {
        createdAt: "2026-07-02T00:03:00.000Z",
        id: "artifact-problem1",
        kind: "problem1",
        payload: { answer: "양자컴퓨터는 양자의 성질을 이용해 정보를 처리하는 컴퓨터입니다.", durationMs: 60000, promptVersion: "2026-07-UC-R1", questionNumber: 1, rubricVersion: "2026-07-UC-R1" },
        stage: UnderstandingCalibrationStages.problem1
      },
      {
        createdAt: "2026-07-02T00:05:00.000Z",
        id: "artifact-problem2",
        kind: "problem2",
        payload: { answer: "일반 컴퓨터는 정보를 하나씩 처리하지만 양자컴퓨터는 양자의 상태를 이용해 일부 계산을 다르게 처리합니다.", durationMs: 70000, promptVersion: "2026-07-UC-R1", questionNumber: 2, rubricVersion: "2026-07-UC-R1" },
        stage: UnderstandingCalibrationStages.problem2
      },
      {
        createdAt: "2026-07-02T00:07:00.000Z",
        id: "artifact-problem3",
        kind: "problem3",
        payload: { answer: "모든 문제를 빨리 푸는 것은 아니며 특정한 종류의 문제에서만 장점이 있습니다.", durationMs: 80000, promptVersion: "2026-07-UC-R1", questionNumber: 3, rubricVersion: "2026-07-UC-R1" },
        stage: UnderstandingCalibrationStages.problem3
      },
      {
        createdAt: "2026-07-02T00:09:00.000Z",
        id: "artifact-problem4",
        kind: "problem4",
        payload: { answer: "복잡한 문제라도 양자컴퓨터가 유리한 문제와 그렇지 않은 문제가 나뉩니다.", durationMs: 90000, promptVersion: "2026-07-UC-R1", questionNumber: 4, rubricVersion: "2026-07-UC-R1" },
        stage: UnderstandingCalibrationStages.problem4
      }
    ],
    chatTurns: [
      {
        id: "chat-student",
        role: "student",
        text: "양자컴퓨터를 쉽게 설명해줘",
        timestamp: "2026-07-02T00:01:00.000Z"
      },
      {
        id: "chat-assistant",
        role: "assistant",
        text: "아주 작은 세계의 특별한 성질을 이용하는 컴퓨터라고 볼 수 있어요.",
        timestamp: "2026-07-02T00:01:05.000Z",
        responseType: "clarify"
      }
    ],
    events: [
      {
        id: "event-chat-started",
        payload: { topic: "양자컴퓨터" },
        stage: UnderstandingCalibrationStages.chat,
        timestamp: "2026-07-02T00:00:30.000Z",
        type: "calibration_chat_started"
      },
      {
        id: "event-chat-turn",
        payload: {
          assistantTurnId: "chat-assistant",
          requestTags: ["summary_request", "why_how_request", "example_request"],
          studentTurnId: "chat-student"
        },
        stage: UnderstandingCalibrationStages.chat,
        timestamp: "2026-07-02T00:01:05.000Z",
        type: "calibration_chat_turn_created"
      },
      {
        id: "event-chat-completed",
        payload: { durationMs: 35000 },
        stage: UnderstandingCalibrationStages.chat,
        timestamp: "2026-07-02T00:01:05.000Z",
        type: "calibration_chat_completed"
      }
    ],
    measures: [
      {
        collectedAt: "2026-07-02T00:02:00.000Z",
        id: "measure-pre",
        kind: "pre_self_report",
        payload: {
          ratings: {
            pre_can_describe: 3,
            pre_can_explain_boundary: 2,
            pre_can_explain_mechanism: 2,
            pre_heard: 4
          }
        },
        stage: UnderstandingCalibrationStages.preSurvey
      },
      {
        collectedAt: "2026-07-02T00:02:30.000Z",
        id: "measure-prediction",
        kind: "prediction_self_report",
        payload: {
          ratings: {
            pred_can_apply_new_case: 3,
            pred_can_correct_misconception: 3,
            pred_can_explain_concept: 4,
            pred_can_explain_mechanism: 4
          }
        },
        stage: UnderstandingCalibrationStages.predictionSurvey
      },
      {
        collectedAt: "2026-07-02T00:04:00.000Z",
        id: "measure-confidence1",
        kind: "problem1_confidence",
        payload: { confidence: 4, questionNumber: 1 },
        stage: UnderstandingCalibrationStages.problem1Confidence
      },
      {
        collectedAt: "2026-07-02T00:06:00.000Z",
        id: "measure-confidence2",
        kind: "problem2_confidence",
        payload: { confidence: 3, questionNumber: 2 },
        stage: UnderstandingCalibrationStages.problem2Confidence
      },
      {
        collectedAt: "2026-07-02T00:08:00.000Z",
        id: "measure-confidence3",
        kind: "problem3_confidence",
        payload: { confidence: 2, questionNumber: 3 },
        stage: UnderstandingCalibrationStages.problem3Confidence
      },
      {
        collectedAt: "2026-07-02T00:10:00.000Z",
        id: "measure-confidence4",
        kind: "problem4_confidence",
        payload: { confidence: 5, questionNumber: 4 },
        stage: UnderstandingCalibrationStages.problem4Confidence
      }
    ],
    completedAt: "2026-07-02T00:11:00.000Z",
    currentStage: UnderstandingCalibrationStages.completed,
    researchMode: ResearchModes.understandingCalibration,
    status: "submitted",
    updatedAt: "2026-07-02T00:11:00.000Z"
  };
  const incompleteSession: PilotSession = {
    ...baseSession,
    sessionId: "session-incomplete",
    status: "in_progress"
  };
  return { ...createInitialPilotState(), sessions: [completeSession, incompleteSession] };
};

describe("understanding calibration CSV export", () => {
  it("exports derived fields, manual placeholders, and table-shaped CSV files", () => {
    const state = makeCalibrationState();
    const dataset = exportDataset(state);
    const exportedSession = dataset.sessions[0];
    const sessionRows = exportCalibrationSessionRows(state);
    const itemRows = exportCalibrationItemRows(state);
    const manualRows = exportCalibrationManualEvaluationRows(state);
    const attritionRows = exportCalibrationAttritionRows(state);
    const chatRows = exportCalibrationChatTurnRows(state);
    const rubricRows = exportCalibrationRubricCodeRows();

    if (exportedSession === undefined) throw new Error("Expected exported session.");
    expect(exportedSession.derivedFeatures).toEqual(expect.objectContaining({
      chatTurnCount: 2,
      confidenceMean: 3.5,
      containsWhyQuestion: true,
      exampleRequestCount: 1,
      isCompleteForAnalysis: true,
      performanceTotal: null,
      problem1DurationMs: 60000,
      predictionMean: 3.5,
      preSelfMean: 2.75,
      requestTagCounts: { example_request: 1, summary_request: 1, why_how_request: 1 },
      rubricVersion: "2026-07-UC-R1"
    }));
    expect(exportedSession.analysisArtifacts.problem1.answer).toContain("양자의 성질");
    expect(exportedSession.analysisArtifacts.problem1.title).toBe("맞춤 자유 설명");
    expect(exportedSession.analysisArtifacts.problem1.promptText).toBe("맞춤 문제 1 지시문");
    expect(exportedSession.manualEvaluation.totalScore).toBeNull();
    expect(sessionRows[0]).toEqual(expect.objectContaining({
      confidenceMean: "3.5",
      isCompleteForAnalysis: "true",
      problem1DurationMs: "60000",
      predictionMean: "3.5",
      questionCount: "0"
    }));
    expect(itemRows).toHaveLength(4);
    expect(itemRows[0]).toEqual(expect.objectContaining({
      answer: "양자컴퓨터는 양자의 성질을 이용해 정보를 처리하는 컴퓨터입니다.",
      confidence: "4",
      itemScore: "",
      problemNumber: "1",
      prompt: "맞춤 문제 1 지시문",
      title: "맞춤 자유 설명"
    }));
    expect(manualRows[0]).toEqual(expect.objectContaining({ rubricVersion: "2026-07-UC-R1", totalScore: "" }));
    expect(attritionRows).toHaveLength(1);
    expect(chatRows[0]).toEqual(expect.objectContaining({ requestTags: "[\"summary_request\",\"why_how_request\",\"example_request\"]", role: "student" }));
    expect(rubricRows.map((row) => row.code)).toContain("application_condition");
    expect(stringifyCalibrationSessionsCsv(state)).toContain("isCompleteForAnalysis");
    expect(stringifyCalibrationItemsCsv(state)).toContain("양자컴퓨터는 양자의 성질");
    expect(stringifyCalibrationManualEvaluationCsv(state)).toContain("criterionScoresJson");
    expect(stringifyCalibrationAttritionCsv(state)).toContain("session-incomplete");
    expect(stringifyCalibrationChatTurnsCsv(state)).toContain("summary_request");
    expect(stringifyCalibrationRubricCodesCsv()).toContain("mechanism_compare");
    expect(exportCalibrationSessionRows(state, { completedOnly: false })).toHaveLength(2);
    expect(exportCalibrationSessionRows(state, { dateFrom: "2099-01-01T00:00:00.000Z" })).toHaveLength(0);
    expect(exportCalibrationSessionRows(state, { includeDerivedFeatures: false })[0]).toEqual(expect.objectContaining({ isCompleteForAnalysis: "true", problem1DurationMs: "", totalChatTurns: "" }));
    expect(exportCalibrationItemRows(state, { includeManualEvaluation: false })[0]).toEqual(expect.objectContaining({ criterionScoresJson: "", itemScore: "", raterId: "" }));
    expect(exportCalibrationManualEvaluationRows(state, { includeManualEvaluation: false })).toHaveLength(0);
    expect(exportCalibrationChatTurnRows(state, { includeRawEvents: false })).toHaveLength(0);
  });
});
