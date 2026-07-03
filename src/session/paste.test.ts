import { describe, expect, it } from "vitest";
import { createSession, recordPaste } from "./session.js";
import { sampleAssignment } from "../shared/fixtures.js";

describe("paste logging", () => {
  it("records large draft paste metadata without storing full text", () => {
    const pastedText =
      "플라스틱은 편리하지만 너무 많이 버려지면 바다로 흘러가 생태계에 피해를 줄 수 있다. 그래서 불필요한 일회용 플라스틱을 줄여야 한다. 재사용 가능한 물건을 선택하면 쓰레기를 줄이고 환경 피해도 줄일 수 있다. 학교와 가정에서 함께 실천하면 변화가 더 오래 이어질 수 있다.";
    const session = recordPaste(createSession(sampleAssignment), pastedText);
    const firstPaste = session.pasteEvents[0];

    expect(firstPaste?.textLength).toBeGreaterThanOrEqual(120);
    expect(firstPaste?.target).toBe("draft");
    expect(firstPaste?.textPreviewFirst80.length).toBeLessThanOrEqual(80);
    expect(session.events.some((event) => event.type === "paste_detected")).toBe(true);
  });
});
