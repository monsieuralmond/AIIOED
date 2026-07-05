export type CsvRow = Readonly<Record<string, string>>;

export type CalibrationExportOptions = {
  readonly completedOnly?: boolean;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly includeDerivedFeatures?: boolean;
  readonly includeManualEvaluation?: boolean;
  readonly includeRawEvents?: boolean;
  readonly researchCondition?: string;
  readonly researchMode?: string;
};

export type CalibrationSessionCsvRow = CsvRow & {
  readonly absGapOverall: string;
  readonly analogyRequestCount: string;
  readonly assistantChars: string;
  readonly assignmentId: string;
  readonly assignmentVersion: string;
  readonly calibrationGapOverall: string;
  readonly chatTurnCount: string;
  readonly classGroupId: string;
  readonly completedProblemCount: string;
  readonly confidenceDrop: string;
  readonly confidenceMean: string;
  readonly confidenceTrajectory: string;
  readonly containsWhyQuestion: string;
  readonly completedAt: string;
  readonly createdAt: string;
  readonly currentStage: string;
  readonly exampleRequestCount: string;
  readonly hasAllFourAnswers: string;
  readonly hasAllFourConfidence: string;
  readonly hasChat: string;
  readonly hasFinalReflection: string;
  readonly hasManualScores: string;
  readonly hasReflectionSurvey: string;
  readonly isCompleteForAnalysis: string;
  readonly offTopicCount: string;
  readonly participantId: string;
  readonly performanceTotal: string;
  readonly predictionMean: string;
  readonly preSelfMean: string;
  readonly problem1DurationMs: string;
  readonly problem1_answer: string;
  readonly problem1_answerLength: string;
  readonly problem1_confidence: string;
  readonly problem1_durationMs: string;
  readonly problem2DurationMs: string;
  readonly problem2_answer: string;
  readonly problem2_answerLength: string;
  readonly problem2_confidence: string;
  readonly problem2_durationMs: string;
  readonly problem3DurationMs: string;
  readonly problem3_answer: string;
  readonly problem3_answerLength: string;
  readonly problem3_confidence: string;
  readonly problem3_durationMs: string;
  readonly problem4DurationMs: string;
  readonly problem4_answer: string;
  readonly problem4_answerLength: string;
  readonly problem4_confidence: string;
  readonly problem4_durationMs: string;
  readonly promptSetVersion: string;
  readonly promptVersion: string;
  readonly questionCount: string;
  readonly readingDurationMs: string;
  readonly requestTagCountsJson: string;
  readonly researchCondition: string;
  readonly researchMode: string;
  readonly rubricVersion: string;
  readonly sessionId: string;
  readonly status: string;
  readonly studentAnonymousId: string;
  readonly topicId: string;
  readonly totalChatAssistantChars: string;
  readonly totalChatDurationMs: string;
  readonly totalChatTurns: string;
  readonly totalChatUserChars: string;
  readonly totalDurationMs: string;
  readonly updatedAt: string;
  readonly userQuestionChars: string;
  readonly verificationRequestCount: string;
};

export type CalibrationItemCsvRow = CsvRow & {
  readonly adjudicatedScore: string;
  readonly answer: string;
  readonly answerLength: string;
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly confidence: string;
  readonly criterionScoresJson: string;
  readonly itemGap: string;
  readonly itemScore: string;
  readonly masteryFlag: string;
  readonly participantId: string;
  readonly problemKey: string;
  readonly problemDurationMs: string;
  readonly problemNumber: string;
  readonly questionNumber: string;
  readonly prompt: string;
  readonly promptVersion: string;
  readonly raterId: string;
  readonly researchCondition: string;
  readonly researchMode: string;
  readonly rubricVersion: string;
  readonly scoredAt: string;
  readonly secondRaterId: string;
  readonly sessionId: string;
  readonly studentAnonymousId: string;
  readonly submittedAt: string;
  readonly title: string;
  readonly topicId: string;
};

export type CalibrationChatTurnCsvRow = CsvRow & {
  readonly assignmentId: string;
  readonly participantId: string;
  readonly requestTags: string;
  readonly researchCondition: string;
  readonly researchMode: string;
  readonly responseType: string;
  readonly role: string;
  readonly sessionId: string;
  readonly text: string;
  readonly timestamp: string;
  readonly turnId: string;
  readonly turnIndex: string;
};

export type CalibrationRubricCodeCsvRow = CsvRow & {
  readonly code: string;
  readonly label: string;
  readonly problemNumber: string;
  readonly rubricVersion: string;
  readonly score0: string;
  readonly score1: string;
  readonly score2: string;
};

export type CalibrationManualEvaluationCsvRow = CsvRow & {
  readonly adjudicatedScore: string;
  readonly assignmentId: string;
  readonly criterionScoresJson: string;
  readonly masteryFlag: string;
  readonly notes: string;
  readonly problemNumber: string;
  readonly raterId: string;
  readonly researchCondition: string;
  readonly researchMode: string;
  readonly rubricVersion: string;
  readonly scoredAt: string;
  readonly secondRaterId: string;
  readonly sessionId: string;
  readonly studentAnonymousId: string;
  readonly totalScore: string;
};

export type CalibrationAttritionCsvRow = CsvRow & {
  readonly assignmentId: string;
  readonly completedAt: string;
  readonly createdAt: string;
  readonly currentStage: string;
  readonly hasAllFourAnswers: string;
  readonly hasAllFourConfidence: string;
  readonly hasChat: string;
  readonly lastEventTimestamp: string;
  readonly lastEventType: string;
  readonly researchCondition: string;
  readonly researchMode: string;
  readonly sessionId: string;
  readonly status: string;
  readonly studentAnonymousId: string;
  readonly updatedAt: string;
};

export const sessionColumns: readonly (keyof CalibrationSessionCsvRow)[] = [
  "sessionId", "studentAnonymousId", "participantId", "assignmentId", "classGroupId", "topicId", "researchMode", "researchCondition", "status", "currentStage", "createdAt", "updatedAt", "completedAt", "assignmentVersion", "promptSetVersion", "promptVersion", "rubricVersion", "isCompleteForAnalysis", "hasAllFourAnswers", "hasAllFourConfidence", "hasChat", "hasReflectionSurvey", "hasFinalReflection", "hasManualScores", "completedProblemCount", "preSelfMean", "predictionMean", "confidenceMean", "confidenceTrajectory", "confidenceDrop", "performanceTotal", "calibrationGapOverall", "absGapOverall", "problem1_answer", "problem1_answerLength", "problem1_durationMs", "problem1_confidence", "problem2_answer", "problem2_answerLength", "problem2_durationMs", "problem2_confidence", "problem3_answer", "problem3_answerLength", "problem3_durationMs", "problem3_confidence", "problem4_answer", "problem4_answerLength", "problem4_durationMs", "problem4_confidence", "chatTurnCount", "totalChatTurns", "userQuestionChars", "assistantChars", "totalChatUserChars", "totalChatAssistantChars", "totalChatDurationMs", "questionCount", "containsWhyQuestion", "exampleRequestCount", "analogyRequestCount", "verificationRequestCount", "offTopicCount", "requestTagCountsJson", "readingDurationMs", "totalDurationMs", "problem1DurationMs", "problem2DurationMs", "problem3DurationMs", "problem4DurationMs"
];

export const itemColumns: readonly (keyof CalibrationItemCsvRow)[] = [
  "sessionId", "studentAnonymousId", "participantId", "assignmentId", "classGroupId", "topicId", "researchMode", "researchCondition", "problemKey", "problemNumber", "questionNumber", "title", "prompt", "promptVersion", "rubricVersion", "answer", "answerLength", "submittedAt", "problemDurationMs", "confidence", "itemScore", "masteryFlag", "criterionScoresJson", "raterId", "secondRaterId", "adjudicatedScore", "scoredAt", "itemGap"
];

export const chatTurnColumns: readonly (keyof CalibrationChatTurnCsvRow)[] = ["sessionId", "participantId", "assignmentId", "researchMode", "researchCondition", "turnIndex", "turnId", "timestamp", "role", "responseType", "requestTags", "text"];
export const rubricCodeColumns: readonly (keyof CalibrationRubricCodeCsvRow)[] = ["rubricVersion", "problemNumber", "code", "label", "score0", "score1", "score2"];
export const manualEvaluationColumns: readonly (keyof CalibrationManualEvaluationCsvRow)[] = ["sessionId", "studentAnonymousId", "assignmentId", "researchMode", "researchCondition", "problemNumber", "rubricVersion", "totalScore", "masteryFlag", "criterionScoresJson", "raterId", "secondRaterId", "adjudicatedScore", "scoredAt", "notes"];
export const attritionColumns: readonly (keyof CalibrationAttritionCsvRow)[] = ["sessionId", "studentAnonymousId", "assignmentId", "researchMode", "researchCondition", "status", "currentStage", "createdAt", "updatedAt", "completedAt", "hasAllFourAnswers", "hasAllFourConfidence", "hasChat", "lastEventType", "lastEventTimestamp"];
