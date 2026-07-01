import type { IncomingMessage, ServerResponse } from "node:http";
import ky from "ky";
import { z } from "zod";
import type { CoachRequest, CoachResponse, CoachResponseType, LlmMode, ReviewSuggestion, ReviewSuggestionCheckResponse, ReviewSuggestionsResponse } from "../shared/types";
import { createCoachResponse } from "../coach/coach";
import { createReviewSuggestions, reviewSuggestionIsResolved } from "../review/review";

type AiServerConfig = {
  readonly apiKey: string | undefined;
  readonly mode: LlmMode;
  readonly model: string;
};

type RequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

class AiRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRouteError";
  }
}

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

const geminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string()
          })
        )
      })
    })
  )
});

const geminiErrorSchema = z.object({
  error: z.object({
    message: z.string()
  })
});

const readJson = async (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const sendJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isBuiltInSuggestionId = (id: string): id is BuiltInSuggestionId => builtInSuggestionIds.some((item) => item === id);

const parseJsonObject = (text: string): Record<string, unknown> => {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
  const parsed: unknown = JSON.parse(trimmed);
  if (!isRecord(parsed)) throw new AiRouteError("Gemini response was not a JSON object.");
  return parsed;
};

const geminiOutputText = (payload: unknown): string => {
  const result = geminiResponseSchema.safeParse(payload);
  if (!result.success) throw new AiRouteError("Gemini response did not include text content.");
  const [candidate] = result.data.candidates;
  if (candidate === undefined) throw new AiRouteError("Gemini response did not include a candidate.");
  const part = candidate.content.parts.find((item) => item.text.trim().length > 0);
  if (part === undefined) throw new AiRouteError("Gemini response did not include text content.");
  return part.text;
};

const geminiErrorMessage = (payload: unknown): string => {
  const result = geminiErrorSchema.safeParse(payload);
  return result.success ? result.data.error.message : "Gemini API request failed.";
};

const normalizeGeminiModel = (model: string): string => (model.startsWith("models/") ? model.slice("models/".length) : model);

const callGeminiJson = async (config: AiServerConfig, prompt: string): Promise<Record<string, unknown>> => {
  if (config.apiKey === undefined || config.apiKey.trim().length === 0) {
    throw new AiRouteError("GEMINI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env.local에 GEMINI_API_KEY를 넣고 dev server를 다시 시작하세요.");
  }
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeGeminiModel(config.model))}:generateContent`);
  url.searchParams.set("key", config.apiKey.trim());
  const response = await ky.post(url, {
    json: {
      contents: [
        {
          parts: [{ text: prompt }],
          role: "user"
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    },
    retry: 0,
    throwHttpErrors: false,
    timeout: 60000
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new AiRouteError(geminiErrorMessage(payload));
  }
  return parseJsonObject(geminiOutputText(payload));
};

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

const coachPrompt = (request: CoachRequest): string => `너는 초등 고학년 학생을 돕는 한국어 글쓰기 코치다.
역할:
- 학생 대신 답안, 문단, 문장, 결론을 써주지 않는다.
- 학생의 주장, 근거, 반론을 스스로 고르게 질문한다.
- 과제와 지문 밖의 일반 대화는 과제로 되돌린다.
- 아첨하지 말고 학생 말에 무조건 동의하지 않는다.
- 응답은 짧고 구체적이어야 한다.

아래 JSON을 읽고 JSON 객체만 반환하라.
반환 형식: {"text":"학생에게 보여줄 한두 문장","type":"clarify|question|evidence_check|redirect|revision_guidance|refusal"}

입력:
${JSON.stringify(request)}`;

const reviewPrompt = (request: { readonly draft: string; readonly outline: CoachRequest["outline"] }): string => `너는 한국어 글쓰기 코치다.
초안을 대신 고쳐 쓰지 말고, 학생이 직접 고칠 위치와 이유만 제안한다.
최대 4개의 제안을 만든다. 과제와 무관한 일반 조언은 만들지 않는다.
category는 "주장과 초점", "근거와 설명", "구조와 흐름", "문장 표현", "좋은 점검" 중 하나만 사용한다.

JSON 객체만 반환하라.
반환 형식: {"suggestions":[{"id":"짧은 영문 식별자","category":"...","text":"학생에게 보여줄 점검 질문 또는 지시","focusLabel":"왼쪽 글에서 볼 위치 이름","resolved":false}]}
문제가 거의 없으면 category "좋은 점검" 제안 1개를 반환한다.

입력:
${JSON.stringify(request)}`;

const checkPrompt = (request: { readonly draft: string; readonly outline: CoachRequest["outline"]; readonly suggestion: ReviewSuggestion }): string => `너는 한국어 글쓰기 코치다.
학생 초안이 선택한 제안을 해결했는지 판단한다.
학생 대신 문장을 새로 써주지 않는다. 해결 여부와 짧은 이유만 말한다.

JSON 객체만 반환하라.
반환 형식: {"resolved":true 또는 false,"message":"학생에게 보여줄 한 문장"}

입력:
${JSON.stringify(request)}`;

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

const unresolvedSuggestionMessage = (suggestion: ReviewSuggestion): string => {
  if (suggestion.id === "claim") return "주장이 아직 초안에 분명히 들어가지 않았어요.";
  if (suggestion.id === "evidence") return "개요에 쓴 근거 두 가지가 초안에 아직 모두 들어가지 않았어요.";
  if (suggestion.id === "source") return "근거가 어디에서 온 것인지 초안에 아직 표시되지 않았어요.";
  if (suggestion.id === "counterargument") return "반론을 인정한 뒤 내 주장으로 돌아오는 연결 문장이 아직 필요해요.";
  if (suggestion.id === "length") return "설명이 아직 짧아요. 근거가 왜 중요한지 한두 문장 더 보태보세요.";
  return "이 제안은 아직 해결되지 않았어요.";
};

const handle = (handler: (payload: unknown) => Promise<unknown>): RequestHandler => {
  return (request, response): void => {
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "method not allowed" });
      return;
    }
    readJson(request)
      .then(handler)
      .then((body) => sendJson(response, 200, body))
      .catch((error: unknown) => sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "AI request failed" }));
  };
};

export const createAiHandlers = (config: AiServerConfig): {
  readonly coach: RequestHandler;
  readonly reviewCheck: RequestHandler;
  readonly reviewSuggestions: RequestHandler;
} => ({
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
      const resolved = reviewSuggestionIsResolved(request);
      return {
        llmMode: config.mode,
        message: resolved ? "수정이 확인됐어요. 이 제안을 해결로 표시했어요." : unresolvedSuggestionMessage(request.suggestion),
        model: config.mode === "mock" ? "mock-writing-coach-v0" : config.model,
        resolved,
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
