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
  readonly confidenceMean: string;
  readonly containsWhyQuestion: string;
  readonly completedAt: string;
  readonly createdAt: string;
  readonly currentStage: string;
  readonly exampleRequestCount: string;
  readonly hasAllFourAnswers: string;
  readonly hasAllFourConfidence: string;
  readonly hasChat: string;
  readonly hasManualScores: string;
  readonly isCompleteForAnalysis: string;
  readonly offTopicCount: string;
  readonly participantId: string;
  readonly performanceTotal: string;
  readonly predictionMean: string;
  readonly preSelfMean: string;
  readonly problem1DurationMs: string;
  readonly problem2DurationMs: string;
  readonly problem3DurationMs: string;
  readonly problem4DurationMs: string;
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
  readonly confidence: string;
  readonly criterionScoresJson: string;
  readonly itemGap: string;
  readonly itemScore: string;
  readonly masteryFlag: string;
  readonly participantId: string;
  readonly problemDurationMs: string;
  readonly problemNumber: string;
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
  "sessionId", "studentAnonymousId", "participantId", "assignmentId", "researchMode", "researchCondition", "status", "currentStage", "createdAt", "updatedAt", "completedAt", "assignmentVersion", "promptSetVersion", "promptVersion", "rubricVersion", "isCompleteForAnalysis", "hasAllFourAnswers", "hasAllFourConfidence", "hasChat", "hasManualScores", "preSelfMean", "predictionMean", "confidenceMean", "performanceTotal", "calibrationGapOverall", "absGapOverall", "chatTurnCount", "totalChatTurns", "userQuestionChars", "assistantChars", "totalChatUserChars", "totalChatAssistantChars", "totalChatDurationMs", "questionCount", "containsWhyQuestion", "exampleRequestCount", "analogyRequestCount", "verificationRequestCount", "offTopicCount", "requestTagCountsJson", "readingDurationMs", "totalDurationMs", "problem1DurationMs", "problem2DurationMs", "problem3DurationMs", "problem4DurationMs"
];

export const itemColumns: readonly (keyof CalibrationItemCsvRow)[] = [
  "sessionId", "studentAnonymousId", "participantId", "assignmentId", "researchMode", "researchCondition", "problemNumber", "title", "prompt", "promptVersion", "rubricVersion", "answer", "answerLength", "submittedAt", "problemDurationMs", "confidence", "itemScore", "masteryFlag", "criterionScoresJson", "raterId", "secondRaterId", "adjudicatedScore", "scoredAt", "itemGap"
];

export const chatTurnColumns: readonly (keyof CalibrationChatTurnCsvRow)[] = ["sessionId", "participantId", "assignmentId", "researchMode", "researchCondition", "turnIndex", "turnId", "timestamp", "role", "responseType", "requestTags", "text"];
export const rubricCodeColumns: readonly (keyof CalibrationRubricCodeCsvRow)[] = ["rubricVersion", "problemNumber", "code", "label", "score0", "score1", "score2"];
export const manualEvaluationColumns: readonly (keyof CalibrationManualEvaluationCsvRow)[] = ["sessionId", "studentAnonymousId", "assignmentId", "researchMode", "researchCondition", "problemNumber", "rubricVersion", "totalScore", "masteryFlag", "criterionScoresJson", "raterId", "secondRaterId", "adjudicatedScore", "scoredAt", "notes"];
export const attritionColumns: readonly (keyof CalibrationAttritionCsvRow)[] = ["sessionId", "studentAnonymousId", "assignmentId", "researchMode", "researchCondition", "status", "currentStage", "createdAt", "updatedAt", "completedAt", "hasAllFourAnswers", "hasAllFourConfidence", "hasChat", "lastEventType", "lastEventTimestamp"];
