import { describe, expect, it } from "vitest";
import { createSession } from "../../session/session.js";
import { sampleAssignment } from "../../shared/fixtures.js";
import type { ChatTurn } from "../../shared/types.js";
import { chatLimitMessage } from "./chat-limits.js";

describe("chat limits", () => {
  it("blocks bursts that exceed the per-minute chat limit", () => {
    process.env["MAX_CHAT_TURNS"] = "20";
    process.env["MAX_CHAT_TURNS_PER_MINUTE"] = "2";
    const chatTurns = [
      { id: "chat-1", role: "student", text: "첫 질문", timestamp: "2026-07-05T00:00:10.000Z" },
      { id: "chat-2", role: "student", text: "둘째 질문", timestamp: "2026-07-05T00:00:20.000Z" }
    ] satisfies readonly ChatTurn[];
    const session = {
      ...createSession(sampleAssignment),
      chatTurns
    };

    expect(chatLimitMessage(session, Date.parse("2026-07-05T00:00:30.000Z"))).toBe("Chat rate limit reached.");
  });
});
