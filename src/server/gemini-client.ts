import ky from "ky";
import { z } from "zod";
import type { LlmMode } from "../shared/types";

export type AiServerConfig = {
  readonly apiKey: string | undefined;
  readonly mode: LlmMode;
  readonly model: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

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

export const callGeminiText = async (config: AiServerConfig, request: GeminiTextRequest): Promise<string> => {
  if (config.apiKey === undefined || config.apiKey.trim().length === 0) {
    throw new AiRouteError("GEMINI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env.local에 GEMINI_API_KEY를 넣고 dev server를 다시 시작하세요.");
  }
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeGeminiModel(config.model))}:generateContent`);
  url.searchParams.set("key", config.apiKey.trim());
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
    retry: 0,
    throwHttpErrors: false,
    timeout: 60000
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw new AiRouteError(geminiErrorMessage(payload));
  return geminiOutputText(payload);
};

export const callGeminiJson = async (config: AiServerConfig, prompt: string): Promise<Record<string, unknown>> =>
  parseJsonObject(
    await callGeminiText(config, {
      contents: [{ parts: [{ text: prompt }], role: "user" }],
      responseMimeType: "application/json",
      temperature: 0.2
    })
  );
