import type { PilotSession } from "../shared/types.js";

export const lastEventTimestamp = (session: PilotSession, type: string): string | null => {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event?.type === type) return event.timestamp;
  }
  return null;
};

export const durationSince = (timestamp: string | null): number | null => {
  if (timestamp === null) return null;
  const duration = Date.now() - Date.parse(timestamp);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
};

const stringArray = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return [];
  return value.every((item) => typeof item === "string") ? value : [];
};

const lastCalibrationRequestTags = (session: PilotSession): readonly string[] => {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event?.type === "calibration_chat_turn_created") return stringArray(event.payload["requestTags"]);
  }
  return [];
};

const totalCharsForRole = (session: PilotSession, role: "assistant" | "student"): number =>
  session.chatTurns.filter((turn) => turn.role === role).reduce((total, turn) => total + turn.text.length, 0);

export const chatCompletedPayload = (session: PilotSession, topic: string): Record<string, unknown> => ({
  completedAt: new Date().toISOString(),
  durationMs: durationSince(lastEventTimestamp(session, "calibration_chat_started")),
  lastRequestTags: lastCalibrationRequestTags(session),
  startedAt: lastEventTimestamp(session, "calibration_chat_started"),
  topic,
  totalAssistantChars: totalCharsForRole(session, "assistant"),
  totalTurns: session.chatTurns.length,
  totalUserChars: totalCharsForRole(session, "student")
});
