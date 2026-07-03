import { ResearchModes, activeResearchCondition } from "../shared/research.js";
import type { ActiveResearchCondition, ResearchMode, ResearchModules } from "../shared/research.js";
import type { Assignment, PilotSession } from "../shared/types.js";

export const researchModeForAssignment = (assignment: Assignment): ResearchMode => assignment.researchMode ?? ResearchModes.writingCoach;
export const researchConditionForAssignment = (assignment: Assignment): ActiveResearchCondition => activeResearchCondition(assignment.researchCondition);

export const normalizeAssignmentResearchMode = (assignment: Assignment): Assignment => ({
  ...assignment,
  researchCondition: researchConditionForAssignment(assignment),
  researchMode: researchModeForAssignment(assignment)
});

export const defaultResearchModules = (assignment: Assignment): ResearchModules => {
  if (researchModeForAssignment(assignment) !== ResearchModes.understandingCalibration) return {};
  const config = assignment.calibrationConfig;
  return {
    understandingCalibration: {
      ...(config?.aiContext === undefined ? {} : { aiContext: config.aiContext }),
      ...(config?.errorStatement === undefined ? {} : { errorStatement: config.errorStatement }),
      ...(config?.independentProblems === undefined ? {} : { independentProblems: config.independentProblems }),
      ...(config?.independentTasks === undefined ? {} : { independentTasks: config.independentTasks }),
      ...(config?.maxChatMinutes === undefined ? {} : { maxChatMinutes: config.maxChatMinutes }),
      ...(config?.predictionSurveyItems === undefined ? {} : { predictionSurveyItems: config.predictionSurveyItems }),
      ...(config?.preSurveyItems === undefined ? {} : { preSurveyItems: config.preSurveyItems }),
      ...(config?.reflectionSurveyItems === undefined ? {} : { reflectionSurveyItems: config.reflectionSurveyItems }),
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
): Pick<PilotSession, "artifacts" | "createdAt" | "measures" | "modules" | "researchCondition" | "researchMode" | "status" | "updatedAt"> => ({
  artifacts: [],
  createdAt,
  measures: [],
  modules: defaultResearchModules(assignment),
  researchCondition: researchConditionForAssignment(assignment),
  researchMode: researchModeForAssignment(assignment),
  status: "in_progress",
  updatedAt: createdAt
});
