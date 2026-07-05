import { maxChatTurnsPerMinute } from "./chat-limits.js";

const minuteMs = 60_000;
const requestTimesBySession = new Map<string, readonly number[]>();

export const reserveChatRequestSlot = (sessionId: string, nowMs = Date.now()): string | null => {
  const recent = (requestTimesBySession.get(sessionId) ?? []).filter((timestamp) => nowMs - timestamp < minuteMs);
  if (recent.length >= maxChatTurnsPerMinute()) {
    requestTimesBySession.set(sessionId, recent);
    return "Chat rate limit reached.";
  }
  requestTimesBySession.set(sessionId, [...recent, nowMs]);
  return null;
};

export const resetChatRequestSlotsForTests = (): void => {
  requestTimesBySession.clear();
};
