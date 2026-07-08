import { AiProviders } from "./gemini-client.js";
import type { AiProvider, AiServerConfig } from "./gemini-client.js";
import type { LlmMode } from "../shared/types.js";

export const defaultOpenAiModel = "gpt-5-nano";
export const defaultGeminiModel = "gemini-2.5-flash-lite";

export const aiModeFromEnv = (value: string | undefined): LlmMode => (value === "mock" ? "mock" : "real");

export const aiProviderFromEnv = (value: string | undefined): AiProvider => value === AiProviders.gemini ? AiProviders.gemini : AiProviders.openai;

export const createAiServerConfig = (env: Record<string, string | undefined>): AiServerConfig => {
  const provider = aiProviderFromEnv(env["AI_PROVIDER"]);
  return {
    apiKey: provider === AiProviders.gemini ? env["GEMINI_API_KEY"] : env["OPENAI_API_KEY"],
    mode: aiModeFromEnv(env["READING_COACH_AI_MODE"]),
    model: provider === AiProviders.gemini ? env["GEMINI_MODEL"] ?? defaultGeminiModel : env["OPENAI_MODEL"] ?? defaultOpenAiModel,
    provider
  };
};
