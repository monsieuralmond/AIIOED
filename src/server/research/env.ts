import { createAiServerConfig } from "../ai-server-config.js";
import type { AiProvider } from "../gemini-client.js";
import { ApiError } from "./http.js";

export type ResearchServerEnv = {
  readonly aiApiKey: string | undefined;
  readonly aiMode: "mock" | "real";
  readonly aiModel: string;
  readonly aiProvider: AiProvider;
  readonly serverAuthSecret: string | undefined;
  readonly supabaseServiceRoleKey: string;
  readonly supabaseUrl: string;
};

const readEnv = (key: string): string | undefined => {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) return undefined;
  return value.trim();
};

const requiredEnv = (key: string): string => {
  const value = readEnv(key);
  if (value === undefined) throw new ApiError(500, `${key} is required on the server.`);
  return value;
};

export const researchServerEnv = (): ResearchServerEnv => {
  const aiConfig = createAiServerConfig(process.env);
  return {
    aiApiKey: aiConfig.apiKey,
    aiMode: aiConfig.mode,
    aiModel: aiConfig.model,
    aiProvider: aiConfig.provider,
    serverAuthSecret: readEnv("SERVER_AUTH_SECRET"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: requiredEnv("SUPABASE_URL")
  };
};
