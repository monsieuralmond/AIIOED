import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { createAiHandlers } from "./src/server/gemini-routes";
import { createResearchApiHandlers } from "./src/server/research/handlers";
import { connectJsonRoute } from "./src/server/research/http";
import type { LlmMode } from "./src/shared/types";

const aiMode = (value: string | undefined): LlmMode => (value === "mock" ? "mock" : "real");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const aiHandlers = createAiHandlers({
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
          server.middlewares.use("/api/session/start", connectJsonRoute(researchHandlers.sessionStart));
          server.middlewares.use("/api/session/update-stage", connectJsonRoute(researchHandlers.updateStage));
          server.middlewares.use("/api/event", connectJsonRoute(researchHandlers.event));
          server.middlewares.use("/api/artifact", connectJsonRoute(researchHandlers.artifact));
          server.middlewares.use("/api/measure", connectJsonRoute(researchHandlers.measure));
          server.middlewares.use("/api/export", connectJsonRoute(researchHandlers.exportData));
          server.middlewares.use("/api/admin/delete-test-data", connectJsonRoute(researchHandlers.deleteTestData));
          server.middlewares.use("/api/admin/upsert-roster", connectJsonRoute(researchHandlers.rosterUpsert));
          server.middlewares.use("/api/calibration/chat", aiHandlers.calibrationChat);
          server.middlewares.use("/api/coach/message", aiHandlers.coach);
          server.middlewares.use("/api/review/suggestions", aiHandlers.reviewSuggestions);
          server.middlewares.use("/api/review/check", aiHandlers.reviewCheck);
        },
        configurePreviewServer(server) {
          server.middlewares.use("/api/chat", connectJsonRoute(researchHandlers.chat));
          server.middlewares.use("/api/session/start", connectJsonRoute(researchHandlers.sessionStart));
          server.middlewares.use("/api/session/update-stage", connectJsonRoute(researchHandlers.updateStage));
          server.middlewares.use("/api/event", connectJsonRoute(researchHandlers.event));
          server.middlewares.use("/api/artifact", connectJsonRoute(researchHandlers.artifact));
          server.middlewares.use("/api/measure", connectJsonRoute(researchHandlers.measure));
          server.middlewares.use("/api/export", connectJsonRoute(researchHandlers.exportData));
          server.middlewares.use("/api/admin/delete-test-data", connectJsonRoute(researchHandlers.deleteTestData));
          server.middlewares.use("/api/admin/upsert-roster", connectJsonRoute(researchHandlers.rosterUpsert));
          server.middlewares.use("/api/calibration/chat", aiHandlers.calibrationChat);
          server.middlewares.use("/api/coach/message", aiHandlers.coach);
          server.middlewares.use("/api/review/suggestions", aiHandlers.reviewSuggestions);
          server.middlewares.use("/api/review/check", aiHandlers.reviewCheck);
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
