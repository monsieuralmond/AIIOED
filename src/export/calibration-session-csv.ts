import type { PilotState } from "../shared/types.js";
import type { ExportPilotSession } from "../shared/types.js";
import { exportableSessions, nullableNumber, optionalBoolean, optionalNumber, optionalString, optionsIncludeDerivedFeatures, stringifyCsv } from "./calibration-csv-shared.js";
import type { CalibrationExportOptions, CalibrationSessionCsvRow } from "./calibration-csv-types.js";
import { sessionColumns } from "./calibration-csv-types.js";

const confidenceForKind = (session: ExportPilotSession, kind: string): number | null => {
  const value = session.measures.find((measure) => measure.kind === kind)?.payload["confidence"];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const exportCalibrationSessionRows = (state: PilotState, options?: CalibrationExportOptions): readonly CalibrationSessionCsvRow[] =>
  exportableSessions(state, options).map((exported) => {
    const includeDerived = optionsIncludeDerivedFeatures(options);
    const problem1Confidence = confidenceForKind(exported, "problem1_confidence");
    const problem2Confidence = confidenceForKind(exported, "problem2_confidence");
    const problem3Confidence = confidenceForKind(exported, "problem3_confidence");
    const problem4Confidence = confidenceForKind(exported, "problem4_confidence");
    return {
      absGapOverall: optionalNumber(includeDerived, exported.derivedFeatures.absGapOverall),
      analogyRequestCount: optionalString(includeDerived, String(exported.derivedFeatures.analogyRequestCount)),
      assistantChars: optionalString(includeDerived, String(exported.derivedFeatures.assistantChars)),
      assignmentId: exported.assignment.id,
      assignmentVersion: exported.derivedFeatures.assignmentVersion,
      calibrationGapOverall: optionalNumber(includeDerived, exported.derivedFeatures.calibrationGapOverall),
      chatTurnCount: optionalString(includeDerived, String(exported.derivedFeatures.chatTurnCount)),
      classGroupId: exported.assignment.classGroupId ?? "",
      completedProblemCount: optionalString(includeDerived, String(exported.derivedFeatures.completedProblemCount)),
      confidenceDrop: optionalNumber(includeDerived, exported.derivedFeatures.confidenceDrop),
      confidenceMean: optionalNumber(includeDerived, exported.derivedFeatures.confidenceMean),
      confidenceTrajectory: optionalString(includeDerived, JSON.stringify(exported.derivedFeatures.confidenceTrajectory)),
      containsWhyQuestion: optionalBoolean(includeDerived, exported.derivedFeatures.containsWhyQuestion),
      completedAt: exported.completedAt ?? "",
      createdAt: exported.createdAt,
      currentStage: exported.currentStage,
      exampleRequestCount: optionalString(includeDerived, String(exported.derivedFeatures.exampleRequestCount)),
      hasAllFourAnswers: String(exported.derivedFeatures.hasAllFourAnswers),
      hasAllFourConfidence: String(exported.derivedFeatures.hasAllFourConfidence),
      hasChat: String(exported.derivedFeatures.hasChat),
      hasFinalReflection: String(exported.derivedFeatures.hasFinalReflection),
      hasManualScores: String(exported.derivedFeatures.hasManualScores),
      hasReflectionSurvey: String(exported.derivedFeatures.hasReflectionSurvey),
      isCompleteForAnalysis: String(exported.derivedFeatures.isCompleteForAnalysis),
      offTopicCount: optionalString(includeDerived, String(exported.derivedFeatures.offTopicCount)),
      participantId: exported.student.anonymousId,
      performanceTotal: optionalNumber(includeDerived, exported.derivedFeatures.performanceTotal),
      predictionMean: optionalNumber(includeDerived, exported.derivedFeatures.predictionMean),
      preSelfMean: optionalNumber(includeDerived, exported.derivedFeatures.preSelfMean),
      problem1DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem1DurationMs),
      problem1_answer: exported.analysisArtifacts.problem1.answer,
      problem1_answerLength: exported.analysisArtifacts.problem1.answer.length === 0 ? "" : String(exported.analysisArtifacts.problem1.answer.length),
      problem1_confidence: nullableNumber(problem1Confidence),
      problem1_durationMs: nullableNumber(exported.analysisArtifacts.problem1.problemDurationMs),
      problem2DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem2DurationMs),
      problem2_answer: exported.analysisArtifacts.problem2.answer,
      problem2_answerLength: exported.analysisArtifacts.problem2.answer.length === 0 ? "" : String(exported.analysisArtifacts.problem2.answer.length),
      problem2_confidence: nullableNumber(problem2Confidence),
      problem2_durationMs: nullableNumber(exported.analysisArtifacts.problem2.problemDurationMs),
      problem3DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem3DurationMs),
      problem3_answer: exported.analysisArtifacts.problem3.answer,
      problem3_answerLength: exported.analysisArtifacts.problem3.answer.length === 0 ? "" : String(exported.analysisArtifacts.problem3.answer.length),
      problem3_confidence: nullableNumber(problem3Confidence),
      problem3_durationMs: nullableNumber(exported.analysisArtifacts.problem3.problemDurationMs),
      problem4DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem4DurationMs),
      problem4_answer: exported.analysisArtifacts.problem4.answer,
      problem4_answerLength: exported.analysisArtifacts.problem4.answer.length === 0 ? "" : String(exported.analysisArtifacts.problem4.answer.length),
      problem4_confidence: nullableNumber(problem4Confidence),
      problem4_durationMs: nullableNumber(exported.analysisArtifacts.problem4.problemDurationMs),
      promptSetVersion: exported.derivedFeatures.promptSetVersion,
      promptVersion: exported.derivedFeatures.promptVersion,
      questionCount: optionalString(includeDerived, String(exported.derivedFeatures.questionCount)),
      readingDurationMs: optionalNumber(includeDerived, exported.derivedFeatures.readingDurationMs),
      requestTagCountsJson: optionalString(includeDerived, JSON.stringify(exported.derivedFeatures.requestTagCounts)),
      researchCondition: exported.researchCondition,
      researchMode: exported.researchMode,
      rubricVersion: exported.derivedFeatures.rubricVersion,
      sessionId: exported.sessionId,
      status: exported.status,
      studentAnonymousId: exported.student.anonymousId,
      topicId: exported.modules.understandingCalibration?.topic ?? exported.assignment.title,
      totalChatAssistantChars: optionalString(includeDerived, String(exported.derivedFeatures.totalChatAssistantChars)),
      totalChatDurationMs: optionalNumber(includeDerived, exported.derivedFeatures.totalChatDurationMs),
      totalChatTurns: optionalString(includeDerived, String(exported.derivedFeatures.totalChatTurns)),
      totalChatUserChars: optionalString(includeDerived, String(exported.derivedFeatures.totalChatUserChars)),
      totalDurationMs: optionalNumber(includeDerived, exported.derivedFeatures.totalDurationMs),
      updatedAt: exported.updatedAt,
      userQuestionChars: optionalString(includeDerived, String(exported.derivedFeatures.userQuestionChars)),
      verificationRequestCount: optionalString(includeDerived, String(exported.derivedFeatures.verificationRequestCount))
    };
  });

export const stringifyCalibrationSessionsCsv = (state: PilotState, options?: CalibrationExportOptions): string =>
  stringifyCsv(sessionColumns, exportCalibrationSessionRows(state, options));
