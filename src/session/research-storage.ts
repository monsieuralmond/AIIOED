import type { ResearchArtifact, ResearchMeasure, ResearchModules, ResearchSessionStatus } from "../shared/research";
import type { Assignment, FinalSubmission, PilotSession } from "../shared/types";
import { defaultResearchModules, normalizeAssignmentResearchMode, researchModeForAssignment } from "./research-session";

type ResearchSessionFields = Pick<PilotSession, "artifacts" | "assignment" | "completedAt" | "createdAt" | "measures" | "modules" | "researchMode" | "status" | "updatedAt">;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isResearchArtifact = (value: unknown): value is ResearchArtifact => {
  if (!isRecord(value)) return false;
  return isString(value["createdAt"]) && isString(value["id"]) && isString(value["kind"]) && isRecord(value["payload"]) && isString(value["stage"]) && (value["updatedAt"] === undefined || isString(value["updatedAt"]));
};

const isResearchMeasure = (value: unknown): value is ResearchMeasure => {
  if (!isRecord(value)) return false;
  return isString(value["collectedAt"]) && isString(value["id"]) && isString(value["kind"]) && isRecord(value["payload"]) && isString(value["stage"]);
};

const parseArtifacts = (value: unknown): readonly ResearchArtifact[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isResearchArtifact)) return null;
  return value;
};

const parseMeasures = (value: unknown): readonly ResearchMeasure[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isResearchMeasure)) return null;
  return value;
};

const parseModules = (value: unknown, assignment: Assignment): ResearchModules | null => {
  if (value === undefined) return defaultResearchModules(assignment);
  if (!isRecord(value)) return null;
  return value;
};

const parseStatus = (value: unknown, finalSubmission: FinalSubmission | null): ResearchSessionStatus | null => {
  if (value === undefined) return finalSubmission === null ? "in_progress" : "submitted";
  if (!isString(value)) return null;
  return value;
};

export const parseResearchSessionFields = (
  value: Record<string, unknown>,
  assignment: Assignment,
  fallbackCreatedAt: string,
  finalSubmission: FinalSubmission | null
): ResearchSessionFields | null => {
  if (value["researchMode"] !== undefined && !isString(value["researchMode"])) return null;
  if (value["createdAt"] !== undefined && !isString(value["createdAt"])) return null;
  if (value["updatedAt"] !== undefined && !isString(value["updatedAt"])) return null;
  if (value["completedAt"] !== undefined && !isString(value["completedAt"])) return null;
  const researchMode = value["researchMode"] ?? researchModeForAssignment(assignment);
  const normalizedAssignment = normalizeAssignmentResearchMode({ ...assignment, researchMode });
  const artifacts = parseArtifacts(value["artifacts"]);
  const measures = parseMeasures(value["measures"]);
  const modules = parseModules(value["modules"], normalizedAssignment);
  const status = parseStatus(value["status"], finalSubmission);
  if (artifacts === null || measures === null || modules === null || status === null) return null;
  const completedAt = value["completedAt"] ?? finalSubmission?.submittedAt;
  return {
    ...(completedAt === undefined ? {} : { completedAt }),
    artifacts,
    assignment: normalizedAssignment,
    createdAt: value["createdAt"] ?? fallbackCreatedAt,
    measures,
    modules,
    researchMode,
    status,
    updatedAt: value["updatedAt"] ?? completedAt ?? fallbackCreatedAt
  };
};
