import ky from "ky";
import { z } from "zod";
import type { LlmMode } from "../shared/types.js";

export const AiProviders = {
  gemini: "gemini",
  openai: "openai"
} as const;

export type AiProvider = (typeof AiProviders)[keyof typeof AiProviders];

export type AiServerConfig = {
  readonly apiKey: string | undefined;
  readonly mode: LlmMode;
  readonly model: string;
  readonly provider: AiProvider;
};

export type GeminiContent = {
  readonly parts: readonly { readonly text: string }[];
  readonly role: "model" | "user";
};

type GeminiTextRequest = {
  readonly contents: readonly GeminiContent[];
  readonly maxOutputTokens?: number;
  readonly responseMimeType?: "application/json";
  readonly systemInstruction?: string;
  readonly temperature: number;
};

export class AiRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRouteError";
  }
}

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

const openAiResponseSchema = z.object({
  output: z.array(
    z.object({
      content: z.array(
        z.object({
          text: z.string().optional(),
          type: z.string().optional()
        }).passthrough()
      ).optional()
    }).passthrough()
  ).optional(),
  output_text: z.string().optional()
}).passthrough();

const openAiErrorSchema = z.object({
  error: z.object({
    message: z.string()
  })
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonObject = (text: string): Record<string, unknown> => {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
  const parsed: unknown = JSON.parse(trimmed);
  if (!isRecord(parsed)) throw new AiRouteError("AI response was not a JSON object.");
  return parsed;
};

const parseGeminiHttpPayload = (text: string): unknown => {
  if (text.trim().length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw new AiRouteError("Gemini API response was not valid JSON.");
  }
};

const parseOpenAiHttpPayload = (text: string): unknown => {
  if (text.trim().length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    throw new AiRouteError("OpenAI API response was not valid JSON.");
  }
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

const openAiOutputText = (payload: unknown): string => {
  const result = openAiResponseSchema.safeParse(payload);
  if (!result.success) throw new AiRouteError("OpenAI response did not include text content.");
  const directText = result.data.output_text;
  if (directText !== undefined && directText.trim().length > 0) return directText;
  const contentText = result.data.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .find((text) => text !== undefined && text.trim().length > 0);
  if (contentText === undefined) throw new AiRouteError("OpenAI response did not include text content.");
  return contentText;
};

const openAiErrorMessage = (payload: unknown): string => {
  const result = openAiErrorSchema.safeParse(payload);
  return result.success ? result.data.error.message : "OpenAI API request failed.";
};

const normalizeGeminiModel = (model: string): string => (model.startsWith("models/") ? model.slice("models/".length) : model);

const timeoutMs = (provider: AiProvider): number => {
  const raw = process.env[provider === AiProviders.openai ? "OPENAI_TIMEOUT_MS" : "GEMINI_TIMEOUT_MS"];
  if (raw === undefined) return 45_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45_000;
};

const transientStatusCodes = [408, 429, 500, 502, 503, 504] as const;

const isTransientStatus = (status: number): boolean => transientStatusCodes.some((item) => item === status);

const retryDelayMs = (provider: AiProvider, attempt: number): number => {
  const raw = process.env[provider === AiProviders.openai ? "OPENAI_RETRY_DELAY_MS" : "GEMINI_RETRY_DELAY_MS"];
  if (raw !== undefined) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 500 * attempt;
};

const sleep = async (ms: number): Promise<void> => {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const geminiMissingKeyMessage = "GEMINI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env.local에 GEMINI_API_KEY를 넣고 dev server를 다시 시작하세요.";
const openAiMissingKeyMessage = "OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env.local 또는 Vercel 환경 변수에 OPENAI_API_KEY를 넣고 다시 배포하세요.";

const callGeminiTextRequest = async (config: AiServerConfig, request: GeminiTextRequest): Promise<string> => {
  if (config.apiKey === undefined || config.apiKey.trim().length === 0) {
    throw new AiRouteError(geminiMissingKeyMessage);
  }
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeGeminiModel(config.model))}:generateContent`);
  url.searchParams.set("key", config.apiKey.trim());
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await ky.post(url, {
      json: {
        contents: request.contents,
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: request.responseMimeType,
          temperature: request.temperature
        },
        systemInstruction: request.systemInstruction === undefined ? undefined : { parts: [{ text: request.systemInstruction }] }
      },
      retry: { limit: 0 },
      throwHttpErrors: false,
      timeout: timeoutMs(config.provider)
    });
    const payload = parseGeminiHttpPayload(await response.text());
    if (response.ok) return geminiOutputText(payload);
    const error = new AiRouteError(geminiErrorMessage(payload));
    if (!isTransientStatus(response.status) || attempt === maxAttempts) throw error;
    await sleep(retryDelayMs(config.provider, attempt));
  }
  throw new AiRouteError("Gemini API request failed.");
};

type OpenAiInputMessage = {
  readonly content: string;
  readonly role: "assistant" | "user";
};

const openAiInputMessages = (contents: readonly GeminiContent[]): readonly OpenAiInputMessage[] =>
  contents.map((content) => ({
    content: content.parts.map((part) => part.text).join("\n"),
    role: content.role === "model" ? "assistant" : "user"
  }));

const callOpenAiTextRequest = async (config: AiServerConfig, request: GeminiTextRequest): Promise<string> => {
  if (config.apiKey === undefined || config.apiKey.trim().length === 0) throw new AiRouteError(openAiMissingKeyMessage);
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await ky.post("https://api.openai.com/v1/responses", {
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`
      },
      json: {
        input: openAiInputMessages(request.contents),
        instructions: request.systemInstruction,
        max_output_tokens: request.maxOutputTokens,
        model: config.model,
        reasoning: { effort: "minimal" },
        text: request.responseMimeType === "application/json" ? { format: { type: "json_object" } } : undefined
      },
      retry: { limit: 0 },
      throwHttpErrors: false,
      timeout: timeoutMs(config.provider)
    });
    const payload = parseOpenAiHttpPayload(await response.text());
    if (response.ok) return openAiOutputText(payload);
    const error = new AiRouteError(openAiErrorMessage(payload));
    if (!isTransientStatus(response.status) || attempt === maxAttempts) throw error;
    await sleep(retryDelayMs(config.provider, attempt));
  }
  throw new AiRouteError("OpenAI API request failed.");
};

export const callAiText = async (config: AiServerConfig, request: GeminiTextRequest): Promise<string> =>
  config.provider === AiProviders.openai ? callOpenAiTextRequest(config, request) : callGeminiTextRequest(config, request);

export const callAiJson = async (config: AiServerConfig, prompt: string): Promise<Record<string, unknown>> =>
  parseJsonObject(
    await callAiText(config, {
      contents: [{ parts: [{ text: prompt }], role: "user" }],
      responseMimeType: "application/json",
      temperature: 0.2
    })
  );

export const callGeminiText = callAiText;
export const callGeminiJson = callAiJson;
