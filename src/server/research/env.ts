import { ApiError } from "./http.js";

export type ResearchServerEnv = {
  readonly aiMode: "mock" | "real";
  readonly geminiApiKey: string | undefined;
  readonly geminiModel: string;
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
  const aiMode = readEnv("READING_COACH_AI_MODE") === "mock" ? "mock" : "real";
  return {
    aiMode,
    geminiApiKey: readEnv("GEMINI_API_KEY"),
    geminiModel: readEnv("GEMINI_MODEL") ?? "gemini-2.5-flash-lite",
    serverAuthSecret: readEnv("SERVER_AUTH_SECRET"),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: requiredEnv("SUPABASE_URL")
  };
};
