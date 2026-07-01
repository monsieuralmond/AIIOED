import react from "@vitejs/plugin-react";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Connect } from "vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { createAiHandlers } from "./src/server/gemini-routes";
import type { LlmMode } from "./src/shared/types";

const pilotStatePath = resolve(".omo/evidence/khan-parity-auth-persistence/server-state.json");

const handlePilotStatePost: Connect.SimpleHandleFunction = (request, response): void => {
  if (request.method !== "POST") {
    response.statusCode = 405;
    response.end(JSON.stringify({ ok: false, message: "method not allowed" }));
    return;
  }
  const chunks: Buffer[] = [];
  request.on("data", (chunk: Buffer) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    mkdir(dirname(pilotStatePath), { recursive: true })
      .then(() => writeFile(pilotStatePath, body, "utf8"))
      .then(() => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ ok: true, path: pilotStatePath, syncedAt: new Date().toISOString() }));
      })
      .catch((error: unknown) => {
        response.statusCode = 500;
        response.end(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "write failed" }));
      });
  });
};

const aiMode = (value: string | undefined): LlmMode => (value === "mock" ? "mock" : "real");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const aiHandlers = createAiHandlers({
    apiKey: env["GEMINI_API_KEY"],
    mode: aiMode(env["READING_COACH_AI_MODE"]),
    model: env["GEMINI_MODEL"] ?? "gemini-3.5-flash"
  });
  return {
    plugins: [
      react(),
      {
        name: "pilot-state-file-sync",
        configureServer(server) {
          server.middlewares.use("/api/pilot-state", handlePilotStatePost);
          server.middlewares.use("/api/coach/message", aiHandlers.coach);
          server.middlewares.use("/api/review/suggestions", aiHandlers.reviewSuggestions);
          server.middlewares.use("/api/review/check", aiHandlers.reviewCheck);
        },
        configurePreviewServer(server) {
          server.middlewares.use("/api/pilot-state", handlePilotStatePost);
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
