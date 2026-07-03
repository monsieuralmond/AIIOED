import type { PilotSession } from "./types";

export type CalibrationProblemKey = "problem1" | "problem2" | "problem3" | "problem4";
export type CalibrationQuestionNumber = 1 | 2 | 3 | 4;
export type CalibrationCriterionScoreKey = "conceptAccuracy" | "mechanismUnderstanding" | "misconceptionCorrection" | "applicationJudgment";
export type CalibrationRubricScore = 0 | 1 | 2;

export type CalibrationAnalysisProblemArtifact = {
  readonly answer: string;
  readonly answerLength: number;
  readonly problemDurationMs: number | null;
  readonly promptText: string;
  readonly promptVersion: string;
  readonly questionNumber: CalibrationQuestionNumber;
  readonly rubricVersion: string;
  readonly submittedAt: string;
  readonly title: string;
  readonly topic: string;
};

export type CalibrationAnalysisArtifacts = Readonly<Record<CalibrationProblemKey, CalibrationAnalysisProblemArtifact>>;

export type CalibrationDerivedFeatures = {
  readonly absGapOverall: number | null;
  readonly analogyRequestCount: number;
  readonly assignmentVersion: string;
  readonly assistantChars: number;
  readonly calibrationGapOverall: number | null;
  readonly confidenceMean: number | null;
  readonly containsWhyQuestion: boolean;
  readonly exampleRequestCount: number;
  readonly hasAllFourAnswers: boolean;
  readonly hasAllFourConfidence: boolean;
  readonly hasChat: boolean;
  readonly hasManualScores: boolean;
  readonly isCompleteForAnalysis: boolean;
  readonly overconfidenceIndex: number | null;
  readonly offTopicCount: number;
  readonly performanceTotal: number | null;
  readonly predictionMean: number | null;
  readonly preSelfMean: number | null;
  readonly problem1DurationMs: number | null;
  readonly problem2DurationMs: number | null;
  readonly problem3DurationMs: number | null;
  readonly problem4DurationMs: number | null;
  readonly promptVersion: string;
  readonly promptSetVersion: string;
  readonly questionCount: number;
  readonly readingDurationMs: number | null;
  readonly requestTagCounts: Readonly<Record<string, number>>;
  readonly rubricVersion: string;
  readonly totalChatAssistantChars: number;
  readonly totalChatDurationMs: number | null;
  readonly totalChatTurns: number;
  readonly totalChatUserChars: number;
  readonly totalDurationMs: number | null;
  readonly underconfidenceIndex: number | null;
  readonly userQuestionChars: number;
  readonly verificationRequestCount: number;
  readonly chatTurnCount: number;
  readonly itemGaps: Readonly<Record<CalibrationProblemKey, number | null>>;
};

export type CalibrationManualEvaluationProblem = {
  readonly adjudicatedScore: number | null;
  readonly codes: Readonly<Record<string, CalibrationRubricScore | null>>;
  readonly criterionScores: Readonly<Record<CalibrationCriterionScoreKey, CalibrationRubricScore | null>>;
  readonly masteryFlag: boolean | null;
  readonly notes: string;
  readonly raterId: string;
  readonly rubricVersion: string;
  readonly scoredAt: string;
  readonly secondRaterId: string;
  readonly totalScore: number | null;
};

export type CalibrationManualEvaluation = {
  readonly notes: string;
  readonly problem1: CalibrationManualEvaluationProblem;
  readonly problem2: CalibrationManualEvaluationProblem;
  readonly problem3: CalibrationManualEvaluationProblem;
  readonly problem4: CalibrationManualEvaluationProblem;
  readonly raterIds: readonly string[];
  readonly rubricVersion: string;
  readonly totalScore: number | null;
};

export type ExportPilotSession = PilotSession & {
  readonly analysisArtifacts: CalibrationAnalysisArtifacts;
  readonly derivedFeatures: CalibrationDerivedFeatures;
  readonly manualEvaluation: CalibrationManualEvaluation;
};
