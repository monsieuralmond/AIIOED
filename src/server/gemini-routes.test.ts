import { describe, expect, it } from "vitest";
import { ResearchConditions } from "../shared/research.js";
import { buildCalibrationContents } from "./gemini-routes.js";

describe("Gemini calibration chat routing", () => {
  it("keeps previous dialogue in the current prompt for follow-up questions", () => {
    const contents = buildCalibrationContents({
      history: [
        { role: "student", text: "양자 중첩이 중요하다고 했지?" },
        { role: "assistant", text: "양자 중첩은 여러 가능성을 함께 다루는 성질을 설명할 때 쓰는 말이에요." }
      ],
      message: "방금 말한 걸 더 쉽게 설명해줘",
      passage: "양자컴퓨터는 큐비트를 사용한다.",
      researchCondition: ResearchConditions.singleGroupBaseline,
      topic: "양자컴퓨터"
    });

    const currentPrompt = contents[contents.length - 1]?.parts[0]?.text ?? "";

    expect(contents.map((content) => content.role)).toEqual(["user", "model", "user"]);
    expect(currentPrompt).toContain("이전 대화");
    expect(currentPrompt).toContain("여러 가능성");
    expect(currentPrompt).toContain("방금");
  });
});
