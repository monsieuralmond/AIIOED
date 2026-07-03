import { describe, expect, it } from "vitest";
import { ResearchConditions } from "./research";
import { assistantReplyForCalibration, requestTagsForMessage, understandingCalibrationSystemPromptForCondition } from "./calibration-ai";

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

  it("uses previous chat history when a follow-up question refers to the earlier turn", () => {
    const input = {
      history: [
        { role: "student", text: "양자컴퓨터에서 양자 중첩이 중요하다고 했지?" },
        { role: "assistant", text: "맞아요. 양자 중첩은 여러 가능성을 함께 다루는 성질을 설명할 때 쓰는 말이에요." }
      ],
      message: "방금 말한 걸 더 쉽게 설명해줘",
      passage: "양자컴퓨터는 큐비트와 양자 중첩 같은 원리를 활용한다.",
      topic: "양자컴퓨터"
    } as const;

    const reply = assistantReplyForCalibration(input);

    expect(reply).toContain("여러 가능성");
  });

  it("uses the single-group baseline prompt for understanding calibration chat", () => {
    const prompt = understandingCalibrationSystemPromptForCondition(ResearchConditions.singleGroupBaseline);

    expect(prompt).toContain("한국어 독해 보조 AI");
    expect(prompt).toContain("지문과 보조자료의 내용을 우선 활용");
    expect(prompt).toContain("이후 활동이나 평가가 있다는 사실을 암시하지 않는다");
    expect(prompt).toContain("과도한 칭찬이나 아첨을 하지 않는다");
    expect(prompt).toContain("기본 답변은 3~6문장");
  });

  it("keeps reserved research conditions inactive until they are deliberately enabled", () => {
    const baselinePrompt = understandingCalibrationSystemPromptForCondition(ResearchConditions.singleGroupBaseline);

    expect(understandingCalibrationSystemPromptForCondition(ResearchConditions.challenge)).toBe(baselinePrompt);
  });
});
