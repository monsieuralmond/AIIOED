import type { CalibrationManualEvaluationProblem, CalibrationProblemKey, ExportPilotSession, PilotEvent, PilotSession, PilotState } from "../shared/types.js";
import { exportSessionWithResearchFields } from "./calibration-derived.js";
import type { CalibrationExportOptions, CsvRow } from "./calibration-csv-types.js";

export const csvValue = (value: string): string => `"${value.replaceAll("\"", "\"\"")}"`;

export const stringifyCsv = <Row extends CsvRow>(columns: readonly (keyof Row)[], rows: readonly Row[]): string =>
  [columns.join(","), ...rows.map((row) => columns.map((column) => csvValue(row[column] ?? "")).join(","))].join("\n");

export const nullableNumber = (value: number | null): string => (value === null ? "" : String(value));
export const nullableBoolean = (value: boolean | null): string => (value === null ? "" : String(value));
export const optionalBoolean = (include: boolean, value: boolean): string => (include ? String(value) : "");
export const optionalNumber = (include: boolean, value: number | null): string => (include ? nullableNumber(value) : "");
export const optionalString = (include: boolean, value: string): string => (include ? value : "");

export const payloadNumber = (payload: Readonly<Record<string, unknown>> | undefined, key: string): string => {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
};

export const payloadStringArrayJson = (payload: Readonly<Record<string, unknown>> | undefined, key: string): string => {
  const value = payload?.[key];
  if (!Array.isArray(value)) return "";
  return JSON.stringify(value.filter((item): item is string => typeof item === "string"));
};

export const chatEventForTurn = (events: readonly PilotEvent[], turnId: string): PilotEvent | undefined =>
  events.find((event) => event.type === "calibration_chat_turn_created" && (event.payload["studentTurnId"] === turnId || event.payload["assistantTurnId"] === turnId));

const optionsCompletedOnly = (options: CalibrationExportOptions | undefined): boolean => options?.completedOnly ?? true;

export const optionsIncludeDerivedFeatures = (options: CalibrationExportOptions | undefined): boolean => options?.includeDerivedFeatures ?? true;
export const optionsIncludeManualEvaluation = (options: CalibrationExportOptions | undefined): boolean => options?.includeManualEvaluation ?? true;
export const optionsIncludeRawEvents = (options: CalibrationExportOptions | undefined): boolean => options?.includeRawEvents ?? true;

const withinDateRange = (session: PilotSession, options: CalibrationExportOptions | undefined): boolean => {
  const createdAt = Date.parse(session.createdAt);
  const from = options?.dateFrom === undefined ? null : Date.parse(options.dateFrom);
  const to = options?.dateTo === undefined ? null : Date.parse(options.dateTo);
  if (!Number.isFinite(createdAt)) return true;
  if (from !== null && Number.isFinite(from) && createdAt < from) return false;
  if (to !== null && Number.isFinite(to) && createdAt > to) return false;
  return true;
};

const sessionMatchesOptions = (session: ExportPilotSession, options: CalibrationExportOptions | undefined): boolean => {
  if (optionsCompletedOnly(options) && !session.derivedFeatures.isCompleteForAnalysis) return false;
  if (options?.researchMode !== undefined && session.researchMode !== options.researchMode) return false;
  if (options?.researchCondition !== undefined && session.researchCondition !== options.researchCondition) return false;
  return withinDateRange(session, options);
};

export const exportableSessions = (state: PilotState, options?: CalibrationExportOptions): readonly ExportPilotSession[] =>
  state.sessions.map(exportSessionWithResearchFields).filter((session) => sessionMatchesOptions(session, options));

export const manualProblemForKey = (session: ExportPilotSession, problemKey: CalibrationProblemKey): CalibrationManualEvaluationProblem => {
  switch (problemKey) {
    case "problem1":
      return session.manualEvaluation.problem1;
    case "problem2":
      return session.manualEvaluation.problem2;
    case "problem3":
      return session.manualEvaluation.problem3;
    case "problem4":
      return session.manualEvaluation.problem4;
  }
};

export const problemDurationForKey = (session: ExportPilotSession, problemKey: CalibrationProblemKey): number | null => {
  switch (problemKey) {
    case "problem1":
      return session.derivedFeatures.problem1DurationMs;
    case "problem2":
      return session.derivedFeatures.problem2DurationMs;
    case "problem3":
      return session.derivedFeatures.problem3DurationMs;
    case "problem4":
      return session.derivedFeatures.problem4DurationMs;
  }
};
