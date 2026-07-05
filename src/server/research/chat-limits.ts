import type { PilotSession } from "../../shared/types.js";

const minuteMs = 60_000;

const positiveIntegerFromEnv = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const maxChatTurns = (): number => positiveIntegerFromEnv("MAX_CHAT_TURNS", 20);

export const maxChatTurnsPerMinute = (): number => positiveIntegerFromEnv("MAX_CHAT_TURNS_PER_MINUTE", 6);

const chatWithinMinutes = (sessionCreatedAt: string, maxChatMinutes: number | undefined): boolean => {
  if (maxChatMinutes === undefined) return true;
  const createdAtMs = new Date(sessionCreatedAt).getTime();
  if (!Number.isFinite(createdAtMs)) return true;
  return Date.now() - createdAtMs <= maxChatMinutes * minuteMs;
};

const recentStudentTurnCount = (session: PilotSession, nowMs: number): number =>
  session.chatTurns.filter((turn) => {
    if (turn.role !== "student") return false;
    const timestampMs = new Date(turn.timestamp).getTime();
    return Number.isFinite(timestampMs) && nowMs - timestampMs < minuteMs;
  }).length;

export const chatLimitMessage = (session: PilotSession, nowMs = Date.now()): string | null => {
  const studentTurns = session.chatTurns.filter((turn) => turn.role === "student").length;
  if (studentTurns >= maxChatTurns()) return "Chat turn limit reached.";
  if (recentStudentTurnCount(session, nowMs) >= maxChatTurnsPerMinute()) return "Chat rate limit reached.";
  if (!chatWithinMinutes(session.createdAt, session.assignment.calibrationConfig?.maxChatMinutes)) return "Chat time limit reached.";
  return null;
};
