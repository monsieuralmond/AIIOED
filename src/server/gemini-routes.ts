import { z } from "zod";
import type { CoachRequest, CoachResponse, CoachResponseType, ReviewSuggestion, ReviewSuggestionCheckResponse, ReviewSuggestionsResponse } from "../shared/types";
import type { CalibrationChatHistoryTurn, CalibrationChatRequest, CalibrationChatResponse } from "../shared/calibration-ai";
import { assistantReplyForCalibration, requestTagsForMessage, understandingCalibrationSystemPrompt } from "../shared/calibration-ai";
import { createCoachResponse } from "../coach/coach";
import { createReviewSuggestionCheckResult, createReviewSuggestions } from "../review/review";
import { callGeminiJson, callGeminiText } from "./gemini-client";
import type { AiServerConfig, GeminiContent } from "./gemini-client";
import { handle } from "./ai-route-utils";
import type { RequestHandler } from "./ai-route-utils";
import { checkPrompt, coachPrompt, reviewPrompt } from "./writing-coach-prompts";

const coachTypes = ["clarify", "question", "evidence_check", "redirect", "revision_guidance", "refusal"] as const satisfies readonly CoachResponseType[];
const suggestionCategories = ["주장과 초점", "근거와 설명", "구조와 흐름", "문장 표현", "좋은 점검"] as const satisfies readonly ReviewSuggestion["category"][];
const builtInSuggestionIds = ["claim", "evidence", "source", "counterargument", "length", "positive"] as const;
type BuiltInSuggestionId = (typeof builtInSuggestionIds)[number];

const assignmentSchema = z.object({
  assignmentMode: z.enum(["full_process", "revision_feedback"]).optional(),
  classGroupId: z.string().optional(),
  createdByTeacherId: z.string().optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  essayType: z.string().optional(),
  gradeLevel: z.string(),
  id: z.string(),
  minimumWordCount: z.string().optional(),
  passage: z.string(),
  question: z.string(),
  requirements: z.array(z.string()).optional(),
  sourceGuidance: z.string().optional(),
  startDate: z.string().optional(),
  startTime: z.string().optional(),
  targetLength: z.string(),
  title: z.string()
});

const outlineSchema = z.object({
  claim: z.string(),
  counterargument: z.string(),
  evidence: z.array(z.string()),
  question: z.string(),
  reasoning: z.string()
});

const coachRequestSchema = z.object({
  assignment: assignmentSchema,
  draft: z.string(),
  message: z.string(),
  outline: outlineSchema
});

const reviewRequestSchema = z.object({
  draft: z.string(),
  outline: outlineSchema
});

const calibrationHistorySchema = z.object({
  role: z.enum(["student", "assistant"]),
  text: z.string()
});

const calibrationChatRequestSchema = z.object({
  aiContext: z.string().optional(),
  history: z.array(calibrationHistorySchema),
  message: z.string(),
  passage: z.string(),
  topic: z.string()
});

const reviewSuggestionSchema = z.object({
  category: z.enum(suggestionCategories),
  focusLabel: z.string(),
  id: z.string(),
  resolved: z.boolean(),
  text: z.string()
});

const checkRequestSchema = z.object({
  draft: z.string(),
  outline: outlineSchema,
  suggestion: reviewSuggestionSchema
});

const coachResponseSchema = z.object({
  text: z.string(),
  type: z.enum(coachTypes)
});

const generatedSuggestionSchema = z.object({
  category: z.enum(suggestionCategories),
  focusLabel: z.string(),
  id: z.string(),
  text: z.string()
});

const suggestionsResponseSchema = z.object({
  suggestions: z.array(generatedSuggestionSchema)
});

const checkResponseSchema = z.object({
  message: z.string(),
  resolved: z.boolean()
});

const isBuiltInSuggestionId = (id: string): id is BuiltInSuggestionId => builtInSuggestionIds.some((item) => item === id);

const toAssignment = (assignment: z.infer<typeof assignmentSchema>): CoachRequest["assignment"] => ({
  ...(assignment.assignmentMode === undefined ? {} : { assignmentMode: assignment.assignmentMode }),
  ...(assignment.classGroupId === undefined ? {} : { classGroupId: assignment.classGroupId }),
  ...(assignment.createdByTeacherId === undefined ? {} : { createdByTeacherId: assignment.createdByTeacherId }),
  ...(assignment.dueDate === undefined ? {} : { dueDate: assignment.dueDate }),
  ...(assignment.dueTime === undefined ? {} : { dueTime: assignment.dueTime }),
  ...(assignment.essayType === undefined ? {} : { essayType: assignment.essayType }),
  ...(assignment.startDate === undefined ? {} : { startDate: assignment.startDate }),
  ...(assignment.startTime === undefined ? {} : { startTime: assignment.startTime }),
  gradeLevel: assignment.gradeLevel,
  id: assignment.id,
  ...(assignment.minimumWordCount === undefined ? {} : { minimumWordCount: assignment.minimumWordCount }),
  passage: assignment.passage,
  question: assignment.question,
  ...(assignment.requirements === undefined ? {} : { requirements: assignment.requirements }),
  ...(assignment.sourceGuidance === undefined ? {} : { sourceGuidance: assignment.sourceGuidance }),
  targetLength: assignment.targetLength,
  title: assignment.title
});

const assertCoachRequest = (payload: unknown): CoachRequest => {
  const request = coachRequestSchema.parse(payload);
  return { assignment: toAssignment(request.assignment), draft: request.draft, message: request.message, outline: request.outline };
};

const assertReviewRequest = (payload: unknown): { readonly draft: string; readonly outline: CoachRequest["outline"] } => reviewRequestSchema.parse(payload);

const assertCheckRequest = (payload: unknown): { readonly draft: string; readonly outline: CoachRequest["outline"]; readonly suggestion: ReviewSuggestion } => checkRequestSchema.parse(payload);

const toCalibrationHistoryTurn = (turn: z.infer<typeof calibrationHistorySchema>): CalibrationChatHistoryTurn => ({ role: turn.role, text: turn.text });

const assertCalibrationChatRequest = (payload: unknown): CalibrationChatRequest => {
  const request = calibrationChatRequestSchema.parse(payload);
  return {
    ...(request.aiContext === undefined ? {} : { aiContext: request.aiContext }),
    history: request.history.map(toCalibrationHistoryTurn),
    message: request.message,
    passage: request.passage,
    topic: request.topic
  };
};

const calibrationContextPrompt = (request: CalibrationChatRequest): string =>
  [
    `주제: ${request.topic}`,
    `지문: ${request.passage}`,
    request.aiContext === undefined || request.aiContext.trim().length === 0 ? "" : `보조자료: ${request.aiContext.trim()}`,
    `학생 질문: ${request.message}`
  ]
    .filter((line) => line.length > 0)
    .join("\n\n");

const toGeminiContent = (turn: CalibrationChatHistoryTurn): GeminiContent => ({
  parts: [{ text: turn.text }],
  role: turn.role === "assistant" ? "model" : "user"
});

const calibrationContents = (request: CalibrationChatRequest): readonly GeminiContent[] => [
  ...request.history.map(toGeminiContent),
  {
    parts: [{ text: calibrationContextPrompt(request) }],
    role: "user"
  }
];

const parseCoachResponse = (payload: Record<string, unknown>, config: AiServerConfig): CoachResponse => {
  const parsed = coachResponseSchema.parse(payload);
  return { llmMode: config.mode, model: config.model, text: parsed.text, type: parsed.type };
};

const parseSuggestionsResponse = (payload: Record<string, unknown>, config: AiServerConfig): ReviewSuggestionsResponse => {
  const parsed = suggestionsResponseSchema.parse(payload);
  const suggestions = parsed.suggestions.map((item, index): ReviewSuggestion => {
    const id = item.id.trim().length > 0 ? item.id : `suggestion-${index + 1}`;
    return { category: item.category, focusLabel: item.focusLabel, id, resolved: false, text: item.text };
  });
  return { llmMode: config.mode, model: config.model, suggestions };
};

const parseCheckResponse = (payload: Record<string, unknown>, suggestionId: string, config: AiServerConfig): ReviewSuggestionCheckResponse => {
  const parsed = checkResponseSchema.parse(payload);
  return { llmMode: config.mode, message: parsed.message, model: config.model, resolved: parsed.resolved, suggestionId };
};

const calibrationChatResponse = async (request: CalibrationChatRequest, config: AiServerConfig): Promise<CalibrationChatResponse> => {
  const requestTags = requestTagsForMessage(request.message);
  if (config.mode === "mock") {
    return {
      llmMode: "mock",
      model: "mock-understanding-calibration-v0",
      requestTags,
      text: assistantReplyForCalibration(request),
      type: "clarify"
    };
  }
  const text = await callGeminiText(config, {
    contents: calibrationContents(request),
    maxOutputTokens: 512,
    systemInstruction: understandingCalibrationSystemPrompt,
    temperature: 0.35
  });
  return { llmMode: config.mode, model: config.model, requestTags, text: text.trim(), type: "clarify" };
};

export const createAiHandlers = (config: AiServerConfig): {
  readonly calibrationChat: RequestHandler;
  readonly coach: RequestHandler;
  readonly reviewCheck: RequestHandler;
  readonly reviewSuggestions: RequestHandler;
} => ({
  calibrationChat: handle(async (payload) => calibrationChatResponse(assertCalibrationChatRequest(payload), config)),
  coach: handle(async (payload) => {
    const request = assertCoachRequest(payload);
    const policyResponse = createCoachResponse(request);
    if (config.mode === "mock") return { ...policyResponse, llmMode: "mock", model: "mock-writing-coach-v0" };
    if (policyResponse.type === "redirect" || policyResponse.type === "refusal") return { ...policyResponse, llmMode: config.mode, model: config.model };
    return parseCoachResponse(await callGeminiJson(config, coachPrompt(request)), config);
  }),
  reviewCheck: handle(async (payload) => {
    const request = assertCheckRequest(payload);
    if (config.mode === "mock" || isBuiltInSuggestionId(request.suggestion.id)) {
      const result = createReviewSuggestionCheckResult(request);
      return {
        llmMode: config.mode,
        message: result.message,
        model: config.mode === "mock" ? "mock-writing-coach-v0" : config.model,
        resolved: result.resolved,
        suggestionId: request.suggestion.id
      };
    }
    return parseCheckResponse(await callGeminiJson(config, checkPrompt(request)), request.suggestion.id, config);
  }),
  reviewSuggestions: handle(async (payload) => {
    const request = assertReviewRequest(payload);
    if (config.mode === "mock") return { llmMode: "mock", model: "mock-writing-coach-v0", suggestions: createReviewSuggestions(request) };
    return parseSuggestionsResponse(await callGeminiJson(config, reviewPrompt(request)), config);
  })
});
