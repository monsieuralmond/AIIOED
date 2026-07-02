import { describe, expect, it } from "vitest";
import { assistantReplyForCalibration, requestTagsForMessage } from "./calibration-ai";

describe("understanding calibration AI request tags", () => {
  it.each([
    ["이게 무슨 뜻이야?", ["definition_request", "clarification_request"]],
    ["초등학생도 알 수 있게 쉽게 설명해줘", ["easy_explanation_request"]],
    ["예시를 들어 줄래?", ["example_request"]],
    ["비유로 설명해줘", ["analogy_request"]],
    ["핵심을 요약해서 글로 정리해줘", ["summary_request", "generated_explanation_request"]],
    ["왜 그렇게 되는지 원리를 알려줘", ["why_how_request"]],
    ["이 말이 맞는지 확인해줘", ["verification_request"]],
    ["항상 다 가능한 건지 한계가 있어?", ["limitation_request"]],
    ["오늘 날씨 알려줘", ["off_topic"]]
  ])("tags %s", (message, expectedTags) => {
    expect(requestTagsForMessage(message)).toEqual(expect.arrayContaining(expectedTags));
  });

  it("keeps generated explanation requests available in mock mode", () => {
    const reply = assistantReplyForCalibration({
      message: "핵심을 글로 정리해줘",
      passage: "일회용 플라스틱은 오래 남고 생태계에 피해를 줄 수 있다.",
      topic: "일회용 플라스틱"
    });
    expect(reply).toContain("일회용 플라스틱");
    expect(reply).not.toContain("대신");
    expect(reply).not.toContain("써줄 수 없");
  });
});
