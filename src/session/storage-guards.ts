import { UnderstandingCalibrationStages } from "../shared/research.js";
import type { Assignment, Stage, TeacherReviewStatus } from "../shared/types.js";

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const isString = (value: unknown): value is string => typeof value === "string";

export const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every(isString);

export const isStage = (value: unknown): value is Stage =>
  value === "reading" ||
  value === "thinking" ||
  value === "writing" ||
  value === "review" ||
  Object.values(UnderstandingCalibrationStages).some((stage) => value === stage);

export const isTeacherReviewStatus = (value: unknown): value is TeacherReviewStatus => value === "not_reviewed" || value === "needs_follow_up" || value === "reviewed";

export const isAssignmentMode = (value: unknown): value is Assignment["assignmentMode"] => value === undefined || value === "full_process" || value === "revision_feedback";

const isTransferChoice = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return isString(value["id"]) && isString(value["label"]) && isString(value["text"]);
};

export const isTransferChoices = (value: unknown): boolean => Array.isArray(value) && value.every(isTransferChoice);

const isSurveyItem = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return isString(value["id"]) && isString(value["label"]) && (value["helper"] === undefined || isString(value["helper"]));
};

export const isSurveyItems = (value: unknown): boolean => Array.isArray(value) && value.every(isSurveyItem);

const isProblemPrompt = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return (value["number"] === 1 || value["number"] === 2 || value["number"] === 3 || value["number"] === 4) && isString(value["title"]) && isString(value["prompt"]);
};

export const isProblemPrompts = (value: unknown): boolean => Array.isArray(value) && value.every(isProblemPrompt);
