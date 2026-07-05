import { describe, expect, it } from "vitest";
import { createCoachResponse } from "./coach.js";
import { sampleAssignment, sampleOutline } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";

describe("task-bound mock coach", () => {
  it("redirects unrelated questions to the assigned task", () => {
    const response = createCoachResponse({
      assignment: sampleAssignment,
      outline: sampleOutline,
      draft: "",
      message: "오늘 날씨 알려줘"
    });

    expect(response.text).toContain("글쓰기와 관련된 질문");
    expect(response.type).toBe("redirect");
  });

  it("anchors every response to task context", () => {
    const response = createCoachResponse({
      assignment: sampleAssignment,
      outline: sampleOutline,
      draft: "",
      message: "근거를 어떻게 찾지?"
    });

    expect(/지문|문제|주장|근거|이유|초안/.test(response.text)).toBe(true);
    expect(response.type).toBe("evidence_check");
  });

  it("refuses copy-ready writing and rewrite requests", () => {
    const response = createCoachResponse({
      assignment: sampleAssignment,
      outline: sampleOutline,
      draft: "일회용 플라스틱은 줄여야 한다.",
      message: "이 문장을 더 멋지게 고쳐줘. 그냥 글을 써줘."
    });

    expect(response.text).toContain("대신");
    expect(response.text).toContain("네가");
    expect(response.text).not.toContain("일회용 플라스틱은 현대 사회에서");
    expect(response.type).toBe("refusal");
  });

  it("allows sentence-level writing help without treating it as full authorship", () => {
    const response = createCoachResponse({
      assignment: { ...sampleAssignment, researchMode: ResearchModes.guidedWriting },
      outline: { ...sampleOutline, claim: "양자컴퓨터", question: "양자컴퓨터", reasoning: "서론-본론-결론 개요" },
      draft: "양자컴퓨터는 보통 컴퓨터와 다르게 정보를 다룬다.",
      message: "이 문장이 어색한데 더 자연스럽게 다듬는 방법을 알려줘"
    });

    expect(response.text).toContain("부분 표현");
    expect(response.type).toBe("revision_guidance");
  });

  it("labels clarification and revision guidance for later judging", () => {
    const clarification = createCoachResponse({
      assignment: sampleAssignment,
      outline: sampleOutline,
      draft: "",
      message: "과제를 설명해줘"
    });
    const revision = createCoachResponse({
      assignment: sampleAssignment,
      outline: sampleOutline,
      draft: "일회용 플라스틱은 줄여야 한다. 환경 피해가 크다.",
      message: "내 글에서 무엇을 점검해야 해?"
    });

    expect(clarification.type).toBe("clarify");
    expect(revision.type).toBe("revision_guidance");
  });
});
