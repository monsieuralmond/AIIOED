import { ApiError } from "./http";

export type ResearchServerEnv = {
  readonly aiMode: "mock" | "real";
  readonly openAiApiKey: string | undefined;
  readonly openAiModel: string;
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
  const aiMode = readEnv("READING_COACH_AI_MODE") === "mock" ? "mock" : "real";
  return {
    aiMode,
    openAiApiKey: readEnv("OPENAI_API_KEY"),
    openAiModel: readEnv("OPENAI_MODEL") ?? "gpt-5.2",
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: requiredEnv("SUPABASE_URL")
  };
};
