import { ResearchModes, activeResearchCondition } from "../shared/research.js";
import type { ActiveResearchCondition, ResearchMode, ResearchModules } from "../shared/research.js";
import type { Assignment, PilotSession } from "../shared/types.js";
import {
  K_ALIGN_AUDIENCE_LEVEL,
  K_ALIGN_CONSTRUCT_FRAMEWORK_VERSION,
  K_ALIGN_KS_VERSION,
  K_ALIGN_PROTOCOL_VERSION,
  K_ALIGN_RUBRIC_VERSION,
  overallSelfEvaluationItem,
  questionSetVersionForAudience,
  selfKnowledgePrompt
} from "../app/understanding-calibration-data.js";

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
      audienceLevel: config?.audienceLevel ?? K_ALIGN_AUDIENCE_LEVEL,
      ...(config?.confidencePromptLabel === undefined ? {} : { confidencePromptLabel: config.confidencePromptLabel }),
      constructFrameworkVersion: config?.constructFrameworkVersion ?? K_ALIGN_CONSTRUCT_FRAMEWORK_VERSION,
      ...(config?.errorStatement === undefined ? {} : { errorStatement: config.errorStatement }),
      ...(config?.finalReflectionSurveyItems === undefined ? {} : { finalReflectionSurveyItems: config.finalReflectionSurveyItems }),
      ...(config?.independentProblems === undefined ? {} : { independentProblems: config.independentProblems }),
      ...(config?.independentTasks === undefined ? {} : { independentTasks: config.independentTasks }),
      ksVersion: config?.ksVersion ?? K_ALIGN_KS_VERSION,
      ...(config?.maxChatMinutes === undefined ? {} : { maxChatMinutes: config.maxChatMinutes }),
      overallSelfEvaluationPrompt: config?.overallSelfEvaluationPrompt ?? overallSelfEvaluationItem.label,
      ...(config?.predictionSurveyItems === undefined ? {} : { predictionSurveyItems: config.predictionSurveyItems }),
      protocolVersion: config?.protocolVersion ?? K_ALIGN_PROTOCOL_VERSION,
      questionSetVersion: config?.questionSetVersion ?? questionSetVersionForAudience(config?.audienceLevel),
      ...(config?.preSurveyItems === undefined ? {} : { preSurveyItems: config.preSurveyItems }),
      ...(config?.reflectionSurveyItems === undefined ? {} : { reflectionSurveyItems: config.reflectionSurveyItems }),
      rubricVersion: config?.rubricVersion ?? K_ALIGN_RUBRIC_VERSION,
      selfKnowledgePrompt: config?.selfKnowledgePrompt ?? selfKnowledgePrompt,
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
