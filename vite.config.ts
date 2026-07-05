import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { createUnifiedAiJsonHandler } from "./src/server/ai-unified-route";
import { createResearchApiHandlers } from "./src/server/research/handlers";
import { connectJsonRoute } from "./src/server/research/http";
import { authenticateAdmin } from "./src/server/research/admin-auth";
import { authenticateStudent } from "./src/server/research/student-auth";
import { authenticateTeacher } from "./src/server/research/teacher-auth";
import type { LlmMode } from "./src/shared/types";

const aiMode = (value: string | undefined): LlmMode => (value === "mock" ? "mock" : "real");

const serverEnvKeys = ["ADMIN_DISPLAY_NAME", "ADMIN_ID", "ADMIN_LOGIN_ID", "ADMIN_PASSWORD", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_TIMEOUT_MS", "READING_COACH_AI_MODE", "SERVER_AUTH_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "EXPORT_SESSION_LIMIT", "MAX_CHAT_TURNS", "MAX_CHAT_TURNS_PER_MINUTE"] as const;

const installServerEnv = (env: Record<string, string>): void => {
  for (const key of serverEnvKeys) {
    const value = env[key];
    if (value !== undefined && process.env[key] === undefined) process.env[key] = value;
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  installServerEnv(env);
  const aiHandler = createUnifiedAiJsonHandler({
    apiKey: env["GEMINI_API_KEY"],
    mode: aiMode(env["READING_COACH_AI_MODE"]),
    model: env["GEMINI_MODEL"] ?? "gemini-2.5-flash-lite"
  });
  const researchHandlers = createResearchApiHandlers();
  return {
    plugins: [
      react(),
      {
        name: "research-api-routes",
        configureServer(server) {
          server.middlewares.use("/api/chat", connectJsonRoute(researchHandlers.chat));
          server.middlewares.use("/api/chat-turn", connectJsonRoute(researchHandlers.chatTurn));
          server.middlewares.use("/api/auth/admin", connectJsonRoute((payload) => authenticateAdmin(payload)));
          server.middlewares.use("/api/auth/student", connectJsonRoute((payload) => authenticateStudent(payload)));
          server.middlewares.use("/api/auth/teacher", connectJsonRoute((payload) => authenticateTeacher(payload)));
          server.middlewares.use("/api/session/start", connectJsonRoute(researchHandlers.sessionStart));
          server.middlewares.use("/api/session/list", connectJsonRoute(researchHandlers.sessionList));
          server.middlewares.use("/api/session/update-stage", connectJsonRoute(researchHandlers.updateStage));
          server.middlewares.use("/api/event", connectJsonRoute(researchHandlers.event));
          server.middlewares.use("/api/artifact", connectJsonRoute(researchHandlers.artifact));
          server.middlewares.use("/api/measure", connectJsonRoute(researchHandlers.measure));
          server.middlewares.use("/api/export", connectJsonRoute(researchHandlers.exportData));
          server.middlewares.use("/api/admin/delete-test-data", connectJsonRoute(researchHandlers.deleteTestData));
          server.middlewares.use("/api/admin/health", connectJsonRoute(researchHandlers.health));
          server.middlewares.use("/api/admin/roster", connectJsonRoute(researchHandlers.rosterLoad));
          server.middlewares.use("/api/admin/upsert-roster", connectJsonRoute(researchHandlers.rosterUpsert));
          server.middlewares.use("/api/ai", connectJsonRoute(aiHandler));
        },
        configurePreviewServer(server) {
          server.middlewares.use("/api/chat", connectJsonRoute(researchHandlers.chat));
          server.middlewares.use("/api/chat-turn", connectJsonRoute(researchHandlers.chatTurn));
          server.middlewares.use("/api/auth/admin", connectJsonRoute((payload) => authenticateAdmin(payload)));
          server.middlewares.use("/api/auth/student", connectJsonRoute((payload) => authenticateStudent(payload)));
          server.middlewares.use("/api/auth/teacher", connectJsonRoute((payload) => authenticateTeacher(payload)));
          server.middlewares.use("/api/session/start", connectJsonRoute(researchHandlers.sessionStart));
          server.middlewares.use("/api/session/list", connectJsonRoute(researchHandlers.sessionList));
          server.middlewares.use("/api/session/update-stage", connectJsonRoute(researchHandlers.updateStage));
          server.middlewares.use("/api/event", connectJsonRoute(researchHandlers.event));
          server.middlewares.use("/api/artifact", connectJsonRoute(researchHandlers.artifact));
          server.middlewares.use("/api/measure", connectJsonRoute(researchHandlers.measure));
          server.middlewares.use("/api/export", connectJsonRoute(researchHandlers.exportData));
          server.middlewares.use("/api/admin/delete-test-data", connectJsonRoute(researchHandlers.deleteTestData));
          server.middlewares.use("/api/admin/health", connectJsonRoute(researchHandlers.health));
          server.middlewares.use("/api/admin/roster", connectJsonRoute(researchHandlers.rosterLoad));
          server.middlewares.use("/api/admin/upsert-roster", connectJsonRoute(researchHandlers.rosterUpsert));
          server.middlewares.use("/api/ai", connectJsonRoute(aiHandler));
        }
      }
    ],
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      setupFiles: ["./vitest.setup.ts"]
    }
  };
});
