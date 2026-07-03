import { problemRubrics } from "../app/understanding-calibration-data";
import type { PilotState } from "../shared/types";
import { chatEventForTurn, exportableSessions, optionsIncludeRawEvents, payloadStringArrayJson, stringifyCsv } from "./calibration-csv-shared";
import type { CalibrationChatTurnCsvRow, CalibrationExportOptions, CalibrationRubricCodeCsvRow } from "./calibration-csv-types";
import { chatTurnColumns, rubricCodeColumns } from "./calibration-csv-types";

export const exportCalibrationChatTurnRows = (state: PilotState, options?: CalibrationExportOptions): readonly CalibrationChatTurnCsvRow[] =>
  optionsIncludeRawEvents(options)
    ? exportableSessions(state, { ...options, completedOnly: options?.completedOnly ?? false }).flatMap((session) =>
      session.chatTurns.map((turn, index): CalibrationChatTurnCsvRow => {
        const event = chatEventForTurn(session.events, turn.id);
        return {
          assignmentId: session.assignment.id,
          participantId: session.student.anonymousId,
          requestTags: payloadStringArrayJson(event?.payload, "requestTags"),
          researchCondition: session.researchCondition,
          researchMode: session.researchMode,
          responseType: turn.responseType ?? "",
          role: turn.role,
          sessionId: session.sessionId,
          text: turn.text,
          timestamp: turn.timestamp,
          turnId: turn.id,
          turnIndex: String(index + 1)
        };
      })
    )
    : [];

export const exportCalibrationRubricCodeRows = (): readonly CalibrationRubricCodeCsvRow[] =>
  problemRubrics.flatMap((rubric) =>
    [...rubric.commonCodes, ...rubric.problemCodes].map((code): CalibrationRubricCodeCsvRow => ({
      code: code.code,
      label: code.label,
      problemNumber: String(rubric.problemNumber),
      rubricVersion: rubric.rubricVersion,
      score0: code.scoreGuide[0],
      score1: code.scoreGuide[1],
      score2: code.scoreGuide[2]
    }))
  );

export const stringifyCalibrationChatTurnsCsv = (state: PilotState, options?: CalibrationExportOptions): string => stringifyCsv(chatTurnColumns, exportCalibrationChatTurnRows(state, options));
export const stringifyCalibrationRubricCodesCsv = (): string => stringifyCsv(rubricCodeColumns, exportCalibrationRubricCodeRows());
