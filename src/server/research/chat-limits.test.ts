import { describe, expect, it } from "vitest";
import { createSession } from "../../session/session.js";
import { sampleAssignment } from "../../shared/fixtures.js";
import { chatLimitMessage } from "./chat-limits.js";

describe("chat limits", () => {
  it("does not block chat after the advisory chat minutes pass", () => {
    const session = {
      ...createSession({
        ...sampleAssignment,
        calibrationConfig: {
          maxChatMinutes: 1
        }
      }),
      createdAt: "2026-07-05T00:00:00.000Z"
    };

    expect(chatLimitMessage(session, Date.parse("2026-07-05T00:20:00.000Z"))).toBeNull();
  });

  it("does not hard-block long or bursty classroom chat sessions", () => {
    process.env["MAX_CHAT_TURNS"] = "20";
    process.env["MAX_CHAT_TURNS_PER_MINUTE"] = "2";
    const chatTurns = Array.from({ length: 50 }, (_, index) => ({
      id: `chat-${index + 1}`,
      role: "student" as const,
      text: `질문 ${index + 1}`,
      timestamp: "2026-07-05T00:00:10.000Z"
    }));
    const session = {
      ...createSession(sampleAssignment),
      chatTurns
    };

    expect(chatLimitMessage(session, Date.parse("2026-07-05T00:00:30.000Z"))).toBeNull();
  });
});
