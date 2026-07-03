import type { PilotState } from "../shared/types";
import { exportableSessions, nullableNumber, optionalBoolean, optionalNumber, optionalString, optionsIncludeDerivedFeatures, stringifyCsv } from "./calibration-csv-shared";
import type { CalibrationExportOptions, CalibrationSessionCsvRow } from "./calibration-csv-types";
import { sessionColumns } from "./calibration-csv-types";

export const exportCalibrationSessionRows = (state: PilotState, options?: CalibrationExportOptions): readonly CalibrationSessionCsvRow[] =>
  exportableSessions(state, options).map((exported) => {
    const includeDerived = optionsIncludeDerivedFeatures(options);
    return {
      absGapOverall: optionalNumber(includeDerived, exported.derivedFeatures.absGapOverall),
      analogyRequestCount: optionalString(includeDerived, String(exported.derivedFeatures.analogyRequestCount)),
      assistantChars: optionalString(includeDerived, String(exported.derivedFeatures.assistantChars)),
      assignmentId: exported.assignment.id,
      assignmentVersion: exported.derivedFeatures.assignmentVersion,
      calibrationGapOverall: optionalNumber(includeDerived, exported.derivedFeatures.calibrationGapOverall),
      chatTurnCount: optionalString(includeDerived, String(exported.derivedFeatures.chatTurnCount)),
      confidenceMean: optionalNumber(includeDerived, exported.derivedFeatures.confidenceMean),
      containsWhyQuestion: optionalBoolean(includeDerived, exported.derivedFeatures.containsWhyQuestion),
      completedAt: exported.completedAt ?? "",
      createdAt: exported.createdAt,
      currentStage: exported.currentStage,
      exampleRequestCount: optionalString(includeDerived, String(exported.derivedFeatures.exampleRequestCount)),
      hasAllFourAnswers: String(exported.derivedFeatures.hasAllFourAnswers),
      hasAllFourConfidence: String(exported.derivedFeatures.hasAllFourConfidence),
      hasChat: String(exported.derivedFeatures.hasChat),
      hasManualScores: String(exported.derivedFeatures.hasManualScores),
      isCompleteForAnalysis: String(exported.derivedFeatures.isCompleteForAnalysis),
      offTopicCount: optionalString(includeDerived, String(exported.derivedFeatures.offTopicCount)),
      participantId: exported.student.anonymousId,
      performanceTotal: optionalNumber(includeDerived, exported.derivedFeatures.performanceTotal),
      predictionMean: optionalNumber(includeDerived, exported.derivedFeatures.predictionMean),
      preSelfMean: optionalNumber(includeDerived, exported.derivedFeatures.preSelfMean),
      problem1DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem1DurationMs),
      problem2DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem2DurationMs),
      problem3DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem3DurationMs),
      problem4DurationMs: optionalNumber(includeDerived, exported.derivedFeatures.problem4DurationMs),
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
