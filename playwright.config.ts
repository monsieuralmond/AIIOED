import { defineConfig, devices } from "@playwright/test";

const playwrightPort = process.env["PLAYWRIGHT_PORT"] ?? "5174";
const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? `http://127.0.0.1:${playwrightPort}`;
const reuseExistingServer = process.env["PLAYWRIGHT_REUSE_EXISTING_SERVER"] === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".omo/evidence/pilot-writing-coach-v0/playwright-results",
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `READING_COACH_AI_MODE=mock npm run dev -- --host 127.0.0.1 --port ${playwrightPort}`,
    url: baseURL,
    reuseExistingServer
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1728, height: 930 } }
    }
  ]
});
