import {
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
  independentProblemsForModule,
  preSurveyItemsForModule,
  predictionSurveyItemsForModule,
  problemRubrics
} from "../app/understanding-calibration-data";
import { ResearchModes, UnderstandingCalibrationStages } from "../shared/research";
import type {
  CalibrationAnalysisProblemArtifact,
  CalibrationCriterionScoreKey,
  CalibrationDerivedFeatures,
  CalibrationManualEvaluation,
  CalibrationManualEvaluationProblem,
  CalibrationProblemKey,
  ExportPilotSession,
  PilotEvent,
  PilotSession
} from "../shared/types";
import { analysisArtifactsForSession, chatDurationMs, confidenceForProblem } from "./calibration-analysis-artifacts";

const nullItemGaps: Readonly<Record<CalibrationProblemKey, number | null>> = {
  problem1: null,
  problem2: null,
  problem3: null,
  problem4: null
};

const nullCriterionScores: Readonly<Record<CalibrationCriterionScoreKey, 0 | 1 | 2 | null>> = {
  applicationJudgment: null,
  conceptAccuracy: null,
  mechanismUnderstanding: null,
  misconceptionCorrection: null
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const numericRatings = (value: unknown): Readonly<Record<string, number>> => {
  if (!isRecord(value)) return {};
  const ratings: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) ratings[key] = item;
  }
  return ratings;
};

const payloadNumber = (payload: Readonly<Record<string, unknown>>, key: string): number | null => {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const payloadStringArray = (payload: Readonly<Record<string, unknown>>, key: string): readonly string[] => {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const rounded = (value: number): number => Math.round(value * 100) / 100;

const mean = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  return rounded(values.reduce((total, value) => total + value, 0) / values.length);
};

const measureRatings = (session: PilotSession, kind: string): Readonly<Record<string, number>> => {
  const measure = session.measures.find((item) => item.kind === kind);
  return numericRatings(measure?.payload["ratings"]);
};

const meanForItems = (ratings: Readonly<Record<string, number>>, itemIds: readonly string[]): number | null => {
  const values = itemIds.flatMap((id) => {
    const value = ratings[id];
    return typeof value === "number" ? [value] : [];
  });
  return mean(values);
};

const confidenceMean = (session: PilotSession): number | null => {
  const values = independentProblemsForModule(session.modules.understandingCalibration).flatMap((problem) => {
    const measure = session.measures.find((item) => item.kind === problem.confidenceMeasureKind);
    const confidence = measure === undefined ? null : payloadNumber(measure.payload, "confidence");
    return confidence === null ? [] : [confidence];
  });
  return mean(values);
};

const totalDurationMs = (session: PilotSession): number | null => {
  const start = Date.parse(session.createdAt);
  const end = Date.parse(session.completedAt ?? session.updatedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
};

const readingDurationMs = (session: PilotSession): number | null => {
  const completed = session.events.find((event) => event.type === "calibration_reading_completed");
  return completed === undefined ? null : payloadNumber(completed.payload, "durationMs");
};

const requestTagCounts = (events: readonly PilotEvent[]): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== "calibration_chat_turn_created") continue;
    for (const tag of payloadStringArray(event.payload, "requestTags")) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
};

const charsByRole = (session: PilotSession, role: "student" | "assistant"): number =>
  session.chatTurns.filter((turn) => turn.role === role).reduce((total, turn) => total + turn.text.length, 0);

const questionLikeText = (text: string): boolean => /[?？]|왜|어떻게|무엇|뭐|어떤|맞아|맞나요|알려/u.test(text);

const questionCount = (session: PilotSession): number => session.chatTurns.filter((turn) => turn.role === "student" && questionLikeText(turn.text)).length;

const countTag = (counts: Readonly<Record<string, number>>, tag: string): number => counts[tag] ?? 0;

const manualProblemValues = (manualEvaluation: CalibrationManualEvaluation): readonly CalibrationManualEvaluationProblem[] => [
  manualEvaluation.problem1,
  manualEvaluation.problem2,
  manualEvaluation.problem3,
  manualEvaluation.problem4
];

const hasManualScores = (manualEvaluation: CalibrationManualEvaluation): boolean =>
  manualEvaluation.totalScore !== null || manualProblemValues(manualEvaluation).some((problem) => problem.totalScore !== null);

const problemNumberByKey: Readonly<Record<CalibrationProblemKey, 1 | 2 | 3 | 4>> = {
  problem1: 1,
  problem2: 2,
  problem3: 3,
  problem4: 4
};

const emptyManualProblem = (problemKey: CalibrationProblemKey): CalibrationManualEvaluationProblem => {
  const problemNumber = problemNumberByKey[problemKey];
  const rubric = problemRubrics.find((item) => item.problemNumber === problemNumber);
  const codes: Record<string, 0 | 1 | 2 | null> = {};
  for (const code of [...(rubric?.commonCodes ?? []), ...(rubric?.problemCodes ?? [])]) {
    codes[code.code] = null;
  }
  return {
    adjudicatedScore: null,
    codes,
    criterionScores: nullCriterionScores,
    masteryFlag: null,
    notes: "",
    raterId: "",
    rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
    scoredAt: "",
    secondRaterId: "",
    totalScore: null
  };
};

export const emptyManualEvaluation = (): CalibrationManualEvaluation => ({
  notes: "",
  problem1: emptyManualProblem("problem1"),
  problem2: emptyManualProblem("problem2"),
  problem3: emptyManualProblem("problem3"),
  problem4: emptyManualProblem("problem4"),
  raterIds: [],
  rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
  totalScore: null
});

export const deriveCalibrationFeatures = (session: PilotSession, manualEvaluation: CalibrationManualEvaluation): CalibrationDerivedFeatures => {
  const preRatings = measureRatings(session, "pre_self_report");
  const predictionRatings = measureRatings(session, "prediction_self_report");
  const predictionMean = meanForItems(predictionRatings, predictionSurveyItemsForModule(session.modules.understandingCalibration).map((item) => item.id));
  const performanceTotal = manualEvaluation.totalScore;
  const calibrationGapOverall = predictionMean === null || performanceTotal === null ? null : rounded(predictionMean - performanceTotal);
  const analysisArtifacts = analysisArtifactsForSession(session);
  const requestCounts = requestTagCounts(session.events);
  const totalChatUserChars = charsByRole(session, "student");
  const totalChatAssistantChars = charsByRole(session, "assistant");
  const problemArtifacts: readonly CalibrationAnalysisProblemArtifact[] = [
    analysisArtifacts.problem1,
    analysisArtifacts.problem2,
    analysisArtifacts.problem3,
    analysisArtifacts.problem4
  ];
  const hasAllFourAnswers = problemArtifacts.every((artifact) => artifact.answer.trim().length > 0);
  const hasAllFourConfidence = independentProblemsForModule(session.modules.understandingCalibration).every((problem) => confidenceForProblem(session, problem) !== null);
  const hasChat = session.chatTurns.some((turn) => turn.role === "assistant");
  const manualScoresPresent = hasManualScores(manualEvaluation);
  const isCompleteForAnalysis =
    session.researchMode === ResearchModes.understandingCalibration &&
    session.status === "submitted" &&
    session.currentStage === UnderstandingCalibrationStages.completed &&
    hasAllFourAnswers &&
    hasAllFourConfidence &&
    hasChat;

  return {
    absGapOverall: calibrationGapOverall === null ? null : Math.abs(calibrationGapOverall),
    analogyRequestCount: countTag(requestCounts, "analogy_request"),
    assistantChars: totalChatAssistantChars,
    assignmentVersion: session.assignment.id,
    calibrationGapOverall,
    chatTurnCount: session.chatTurns.length,
    confidenceMean: confidenceMean(session),
    containsWhyQuestion: countTag(requestCounts, "why_how_request") > 0 || session.chatTurns.some((turn) => turn.role === "student" && /왜|어떻게|why|how/u.test(turn.text)),
    exampleRequestCount: countTag(requestCounts, "example_request"),
    hasAllFourAnswers,
    hasAllFourConfidence,
    hasChat,
    hasManualScores: manualScoresPresent,
    itemGaps: nullItemGaps,
    isCompleteForAnalysis,
    offTopicCount: countTag(requestCounts, "off_topic"),
    overconfidenceIndex: calibrationGapOverall === null || calibrationGapOverall <= 0 ? null : calibrationGapOverall,
    performanceTotal,
    predictionMean,
    preSelfMean: meanForItems(preRatings, preSurveyItemsForModule(session.modules.understandingCalibration).map((item) => item.id)),
    problem1DurationMs: analysisArtifacts.problem1.problemDurationMs,
    problem2DurationMs: analysisArtifacts.problem2.problemDurationMs,
    problem3DurationMs: analysisArtifacts.problem3.problemDurationMs,
    problem4DurationMs: analysisArtifacts.problem4.problemDurationMs,
    promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
    promptSetVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
    questionCount: questionCount(session),
    readingDurationMs: readingDurationMs(session),
    requestTagCounts: requestCounts,
    rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
    totalChatAssistantChars,
    totalChatDurationMs: chatDurationMs(session),
    totalChatTurns: session.chatTurns.length,
    totalChatUserChars,
    totalDurationMs: totalDurationMs(session),
    underconfidenceIndex: calibrationGapOverall === null || calibrationGapOverall >= 0 ? null : calibrationGapOverall,
    userQuestionChars: totalChatUserChars,
    verificationRequestCount: countTag(requestCounts, "verification_request")
  };
};

export const exportSessionWithResearchFields = (session: PilotSession): ExportPilotSession => {
  const manualEvaluation = emptyManualEvaluation();
  return {
    ...session,
    analysisArtifacts: analysisArtifactsForSession(session),
    derivedFeatures: deriveCalibrationFeatures(session, manualEvaluation),
    manualEvaluation
  };
};
