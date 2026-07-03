import { independentProblemsForModule } from "../app/understanding-calibration-data";
import type { PilotState } from "../shared/types";
import { exportableSessions, manualProblemForKey, nullableBoolean, nullableNumber, optionalNumber, optionalString, optionsIncludeDerivedFeatures, optionsIncludeManualEvaluation, payloadNumber, problemDurationForKey, stringifyCsv } from "./calibration-csv-shared";
import type { CalibrationAttritionCsvRow, CalibrationExportOptions, CalibrationItemCsvRow, CalibrationManualEvaluationCsvRow } from "./calibration-csv-types";
import { attritionColumns, itemColumns, manualEvaluationColumns } from "./calibration-csv-types";

export const exportCalibrationItemRows = (state: PilotState, options?: CalibrationExportOptions): readonly CalibrationItemCsvRow[] =>
  exportableSessions(state, options).flatMap((session) =>
    independentProblemsForModule(session.modules.understandingCalibration).map((problem): CalibrationItemCsvRow => {
      const includeDerived = optionsIncludeDerivedFeatures(options);
      const includeManual = optionsIncludeManualEvaluation(options);
      const measure = session.measures.find((item) => item.kind === problem.confidenceMeasureKind);
      const artifact = session.analysisArtifacts[problem.answerArtifactKind];
      const manualProblem = manualProblemForKey(session, problem.answerArtifactKind);
      return {
        adjudicatedScore: optionalNumber(includeManual, manualProblem.adjudicatedScore),
        answer: artifact.answer,
        answerLength: artifact.answer.length === 0 ? "" : String(artifact.answer.length),
        assignmentId: session.assignment.id,
        confidence: payloadNumber(measure?.payload, "confidence"),
        criterionScoresJson: optionalString(includeManual, JSON.stringify(manualProblem.criterionScores)),
        itemGap: optionalNumber(includeDerived, session.derivedFeatures.itemGaps[problem.answerArtifactKind]),
        itemScore: optionalNumber(includeManual, manualProblem.totalScore),
        masteryFlag: includeManual ? nullableBoolean(manualProblem.masteryFlag) : "",
        participantId: session.student.anonymousId,
        problemDurationMs: optionalNumber(includeDerived, problemDurationForKey(session, problem.answerArtifactKind)),
        problemNumber: String(problem.number),
        prompt: problem.prompt,
        promptVersion: artifact.promptVersion,
        raterId: optionalString(includeManual, manualProblem.raterId),
        researchCondition: session.researchCondition,
        researchMode: session.researchMode,
        rubricVersion: artifact.rubricVersion,
        scoredAt: optionalString(includeManual, manualProblem.scoredAt),
        secondRaterId: optionalString(includeManual, manualProblem.secondRaterId),
        sessionId: session.sessionId,
        studentAnonymousId: session.student.anonymousId,
        submittedAt: artifact.submittedAt,
        title: problem.title
      };
    })
  );

export const exportCalibrationManualEvaluationRows = (state: PilotState, options?: CalibrationExportOptions): readonly CalibrationManualEvaluationCsvRow[] =>
  optionsIncludeManualEvaluation(options)
    ? exportableSessions(state, options).flatMap((session) =>
      independentProblemsForModule(session.modules.understandingCalibration).map((problem): CalibrationManualEvaluationCsvRow => {
        const manualProblem = manualProblemForKey(session, problem.answerArtifactKind);
        return {
          adjudicatedScore: nullableNumber(manualProblem.adjudicatedScore),
          assignmentId: session.assignment.id,
          criterionScoresJson: JSON.stringify(manualProblem.criterionScores),
          masteryFlag: nullableBoolean(manualProblem.masteryFlag),
          notes: manualProblem.notes,
          problemNumber: String(problem.number),
          raterId: manualProblem.raterId,
          researchCondition: session.researchCondition,
          researchMode: session.researchMode,
          rubricVersion: manualProblem.rubricVersion,
          scoredAt: manualProblem.scoredAt,
          secondRaterId: manualProblem.secondRaterId,
          sessionId: session.sessionId,
          studentAnonymousId: session.student.anonymousId,
          totalScore: nullableNumber(manualProblem.totalScore)
        };
      })
    )
    : [];

export const exportCalibrationAttritionRows = (state: PilotState, options?: CalibrationExportOptions): readonly CalibrationAttritionCsvRow[] =>
  exportableSessions(state, { ...options, completedOnly: false })
    .filter((session) => !session.derivedFeatures.isCompleteForAnalysis)
    .map((session): CalibrationAttritionCsvRow => {
      const lastEvent = session.events.at(-1);
      return {
        assignmentId: session.assignment.id,
        completedAt: session.completedAt ?? "",
        createdAt: session.createdAt,
        currentStage: session.currentStage,
        hasAllFourAnswers: String(session.derivedFeatures.hasAllFourAnswers),
        hasAllFourConfidence: String(session.derivedFeatures.hasAllFourConfidence),
        hasChat: String(session.derivedFeatures.hasChat),
        lastEventTimestamp: lastEvent?.timestamp ?? "",
        lastEventType: lastEvent?.type ?? "",
        researchCondition: session.researchCondition,
        researchMode: session.researchMode,
        sessionId: session.sessionId,
        status: session.status,
        studentAnonymousId: session.student.anonymousId,
        updatedAt: session.updatedAt
      };
    });

export const stringifyCalibrationItemsCsv = (state: PilotState, options?: CalibrationExportOptions): string =>
  stringifyCsv(itemColumns, exportCalibrationItemRows(state, options));

export const stringifyCalibrationManualEvaluationCsv = (state: PilotState, options?: CalibrationExportOptions): string =>
  stringifyCsv(manualEvaluationColumns, exportCalibrationManualEvaluationRows(state, options));

export const stringifyCalibrationAttritionCsv = (state: PilotState, options?: CalibrationExportOptions): string =>
  stringifyCsv(attritionColumns, exportCalibrationAttritionRows(state, options));
