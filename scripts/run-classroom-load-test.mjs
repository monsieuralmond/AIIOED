import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

const helpText = `Run a classroom-sized smoke load test against the deployed app.

Required:
  LOAD_TEST_PARTICIPANT_CODES=S001,S002,...   Comma-separated participant codes
  or LOAD_TEST_PARTICIPANT_CODES=auto:30       Generates S001 through S030

Optional:
  APP_BASE_URL=https://your-app.vercel.app/    Defaults to http://127.0.0.1:5173/
  LOAD_TEST_ASSIGNMENT_ID=assignment-id        Starts the selected assignment when needed
  LOAD_TEST_CHAT=1                             Also sends AI chat requests. Default: 0
  LOAD_TEST_ALLOW_AI_COST=1                    Required when LOAD_TEST_CHAT=1
  LOAD_TEST_CHAT_ROUNDS=2                      Chat rounds per student when chat is enabled. Default: 1
  LOAD_TEST_CHAT_MESSAGE="..."                 Chat message used for each round
  LOAD_TEST_TIMEOUT_MS=45000                   Per-request timeout. Default: 45000

Examples:
  LOAD_TEST_PARTICIPANT_CODES=auto:30 npm run verify:classroom-load
  LOAD_TEST_PARTICIPANT_CODES=S001,S002 LOAD_TEST_CHAT=1 LOAD_TEST_ALLOW_AI_COST=1 npm run verify:classroom-load
`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(helpText);
  process.exit(0);
}

const loadEnvFile = (path) => {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }

  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/gu, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
};

loadEnvFile(resolve(".env"));
loadEnvFile(resolve(".env.local"));

const optional = (key) => {
  const value = process.env[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
};

const positiveInteger = (key, fallback) => {
  const raw = optional(key);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${key} must be a positive integer.`);
  return value;
};

const parseParticipantCodes = (value) => {
  if (value === undefined) throw new Error(`LOAD_TEST_PARTICIPANT_CODES is required.\n\n${helpText}`);
  if (value.startsWith("auto:")) {
    const count = Number.parseInt(value.slice("auto:".length), 10);
    if (!Number.isFinite(count) || count <= 0) throw new Error("LOAD_TEST_PARTICIPANT_CODES auto count must be positive.");
    return Array.from({ length: count }, (_, index) => `S${String(index + 1).padStart(3, "0")}`);
  }
  const codes = value.split(",").map((code) => code.trim()).filter((code) => code.length > 0);
  if (codes.length === 0) throw new Error("LOAD_TEST_PARTICIPANT_CODES did not include any usable participant codes.");
  return codes;
};

const requestJson = async ({ baseUrl, body, headers = {}, path, timeoutMs }) => {
  const controller = new AbortController();
  const startedAt = performance.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, baseUrl), {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
      method: "POST",
      signal: controller.signal
    });
    const text = await response.text();
    const durationMs = performance.now() - startedAt;
    let payload;
    try {
      payload = text.trim().length === 0 ? {} : JSON.parse(text);
    } catch {
      const excerpt = text.trim().slice(0, 180);
      throw new Error(`${path} returned non-JSON response: ${excerpt}`);
    }
    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : `HTTP ${response.status}`;
      throw new Error(`${path} failed: ${message}`);
    }
    return { durationMs, payload };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error(`${path} timed out after ${timeoutMs}ms.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const assertStringField = (value, field) => {
  if (typeof value?.[field] !== "string" || value[field].length === 0) throw new Error(`Response field ${field} is missing.`);
  return value[field];
};

const percentile = (values, ratio) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
};

const rounded = (value) => value === null ? null : Math.round(value);

const summarizeLatency = (values) => ({
  count: values.length,
  maxMs: rounded(values.length === 0 ? null : Math.max(...values)),
  p50Ms: rounded(percentile(values, 0.5)),
  p95Ms: rounded(percentile(values, 0.95))
});

const runParticipant = async ({ assignmentId, baseUrl, chatEnabled, chatMessage, chatRounds, code, index, timeoutMs }) => {
  let step = "session_start";
  const chatLatencies = [];
  try {
    const startBody = {
      participantCode: code,
      ...(assignmentId === undefined ? {} : { assignmentId })
    };
    const started = await requestJson({ baseUrl, body: startBody, path: "/api/session/start", timeoutMs });
    const sessionId = assertStringField(started.payload, "sessionId");
    const sessionToken = assertStringField(started.payload, "sessionToken");

    if (chatEnabled) {
      for (let round = 0; round < chatRounds; round += 1) {
        step = `chat_round_${round + 1}`;
        const chat = await requestJson({
          baseUrl,
          body: {
            message: chatMessage,
            requestId: `load-${Date.now()}-${index + 1}-${round + 1}`,
            sessionId
          },
          headers: { "x-research-session-token": sessionToken },
          path: "/api/chat",
          timeoutMs
        });
        chatLatencies.push(chat.durationMs);
      }
    }

    return {
      chatLatencyMs: chatLatencies.map((value) => Math.round(value)),
      participantIndex: index + 1,
      sessionStartMs: Math.round(started.durationMs),
      status: "ok"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown load test failure.";
    return {
      message,
      participantIndex: index + 1,
      status: "failed",
      step
    };
  }
};

const main = async () => {
  const baseUrl = new URL(optional("APP_BASE_URL") ?? "http://127.0.0.1:5173/");
  const codes = parseParticipantCodes(optional("LOAD_TEST_PARTICIPANT_CODES"));
  const assignmentId = optional("LOAD_TEST_ASSIGNMENT_ID");
  const chatEnabled = optional("LOAD_TEST_CHAT") === "1";
  if (chatEnabled && optional("LOAD_TEST_ALLOW_AI_COST") !== "1") {
    throw new Error("LOAD_TEST_CHAT=1 may call the live AI provider. Set LOAD_TEST_ALLOW_AI_COST=1 only when you intentionally want paid AI chat requests.");
  }
  const chatRounds = chatEnabled ? positiveInteger("LOAD_TEST_CHAT_ROUNDS", 1) : 0;
  const chatMessage = optional("LOAD_TEST_CHAT_MESSAGE") ?? "자료의 핵심을 한 문장으로 설명해줘.";
  const timeoutMs = positiveInteger("LOAD_TEST_TIMEOUT_MS", 45_000);
  const startedAt = performance.now();

  const participants = await Promise.all(codes.map((code, index) => runParticipant({
    assignmentId,
    baseUrl,
    chatEnabled,
    chatMessage,
    chatRounds,
    code,
    index,
    timeoutMs
  })));

  const successful = participants.filter((participant) => participant.status === "ok");
  const failed = participants.filter((participant) => participant.status === "failed");
  const sessionLatencies = successful.map((participant) => participant.sessionStartMs);
  const chatLatencies = successful.flatMap((participant) => participant.chatLatencyMs ?? []);
  const report = {
    assignmentSelected: assignmentId !== undefined,
    baseUrl: baseUrl.toString(),
    chatEnabled,
    chatRoundCountPerStudent: chatRounds,
    classroomSized: codes.length >= 20,
    durationMs: Math.round(performance.now() - startedAt),
    failedParticipantCount: failed.length,
    failures: failed,
    participantCount: codes.length,
    sessionStartLatency: summarizeLatency(sessionLatencies),
    successfulParticipantCount: successful.length,
    successfulParticipants: successful.map((participant) => ({
      chatRequestCount: participant.chatLatencyMs?.length ?? 0,
      participantIndex: participant.participantIndex,
      sessionStartMs: participant.sessionStartMs,
      status: participant.status
    })),
    ...(chatEnabled ? { chatLatency: summarizeLatency(chatLatencies) } : {}),
    verifiedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(report, null, 2));
  if (failed.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown classroom load test failure.";
  console.error(message);
  process.exitCode = 1;
});
