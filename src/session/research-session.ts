import { ResearchModes } from "../shared/research";
import type { ResearchMode, ResearchModules } from "../shared/research";
import type { Assignment, PilotSession } from "../shared/types";

export const researchModeForAssignment = (assignment: Assignment): ResearchMode => assignment.researchMode ?? ResearchModes.writingCoach;

export const normalizeAssignmentResearchMode = (assignment: Assignment): Assignment => ({
  ...assignment,
  researchMode: researchModeForAssignment(assignment)
});

export const defaultResearchModules = (assignment: Assignment): ResearchModules => {
  if (researchModeForAssignment(assignment) !== ResearchModes.understandingCalibration) return {};
  const config = assignment.calibrationConfig;
  return {
    understandingCalibration: {
      ...(config?.aiContext === undefined ? {} : { aiContext: config.aiContext }),
      ...(config?.errorStatement === undefined ? {} : { errorStatement: config.errorStatement }),
      ...(config?.independentTasks === undefined ? {} : { independentTasks: config.independentTasks }),
      ...(config?.maxChatMinutes === undefined ? {} : { maxChatMinutes: config.maxChatMinutes }),
      ...(config?.sourceText === undefined ? {} : { sourceText: config.sourceText }),
      ...(config?.topic === undefined ? {} : { topic: config.topic }),
      ...(config?.transferChoices === undefined ? {} : { transferChoices: config.transferChoices }),
      version: "1.0"
    }
  };
};

export const initialResearchSessionFields = (
  assignment: Assignment,
  createdAt: string
): Pick<PilotSession, "artifacts" | "createdAt" | "measures" | "modules" | "researchMode" | "status" | "updatedAt"> => ({
  artifacts: [],
  createdAt,
  measures: [],
  modules: defaultResearchModules(assignment),
  researchMode: researchModeForAssignment(assignment),
  status: "in_progress",
  updatedAt: createdAt
});
