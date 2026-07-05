import { describe, expect, it } from "vitest";
import { coachPrompt, reviewPrompt } from "./writing-coach-prompts.js";
import { sampleAssignment } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";

describe("writing coach prompt context", () => {
  it("omits assignment example material in guided writing mode", () => {
    const prompt = coachPrompt({
      assignment: {
        ...sampleAssignment,
        passage: "패스키는 비밀번호 없이 로그인하는 인증 방식이다.",
        question: "패스키를 설명하는 글을 쓰세요.",
        researchMode: ResearchModes.guidedWriting,
        title: "패스키 예시 과제"
      },
      draft: "양자컴퓨터는 보통 컴퓨터와 다른 방식으로 정보를 처리한다.",
      message: "도입을 더 흥미롭게 시작하려면 어떻게 하면 좋을까?",
      outline: {
        claim: "양자컴퓨터",
        counterargument: "",
        evidence: ["큐비트는 0과 1의 가능성을 함께 다룰 수 있다."],
        question: "양자컴퓨터",
        reasoning: "서론: 낯선 기술로 소개하기\n본론: 큐비트와 활용 가능성\n결론: 아직 모든 문제를 해결하지는 못함"
      }
    });

    expect(prompt).toContain("양자컴퓨터");
    expect(prompt).not.toContain("패스키");
  });

  it("keeps assignment passage available in ordinary writing coach mode", () => {
    const prompt = coachPrompt({
      assignment: {
        ...sampleAssignment,
        passage: "패스키는 비밀번호 없이 로그인하는 인증 방식이다.",
        question: "패스키를 설명하는 글을 쓰세요.",
        researchMode: ResearchModes.writingCoach,
        title: "패스키 글쓰기"
      },
      draft: "",
      message: "자료를 어떻게 연결할까?",
      outline: {
        claim: "패스키는 보안과 편리함을 함께 다룰 수 있다.",
        counterargument: "",
        evidence: ["비밀번호를 외우지 않아도 된다."],
        question: "패스키",
        reasoning: ""
      }
    });

    expect(prompt).toContain("패스키는 비밀번호 없이 로그인하는 인증 방식이다.");
  });

  it("includes recent conversation for follow-up writing coach questions", () => {
    const prompt = coachPrompt({
      assignment: { ...sampleAssignment, researchMode: ResearchModes.guidedWriting },
      draft: "",
      history: [
        {
          id: "chat-1",
          role: "assistant",
          text: "서론에서는 일상 장면으로 시작해 보세요.",
          timestamp: "2026-07-05T00:00:00.000Z"
        },
        {
          id: "chat-2",
          role: "student",
          text: "그 부분을 조금 더 쉽게 말하면?",
          timestamp: "2026-07-05T00:01:00.000Z"
        }
      ],
      message: "방금 말한 걸 이어서 설명해줘.",
      outline: {
        claim: "양자컴퓨터",
        counterargument: "",
        evidence: [],
        question: "양자컴퓨터",
        reasoning: ""
      }
    });

    expect(prompt).toContain("recentConversation");
    expect(prompt).toContain("서론에서는 일상 장면으로 시작해 보세요.");
    expect(prompt).toContain("입력의 recentConversation");
  });

  it("uses genre-neutral revision categories", () => {
    const prompt = reviewPrompt({
      draft: "양자컴퓨터는 일반 컴퓨터와 다른 방식으로 정보를 처리한다.",
      outline: {
        claim: "큐비트와 일반 비트의 차이를 중심으로 설명한다.",
        counterargument: "",
        evidence: ["큐비트는 여러 가능성을 함께 다룰 수 있다."],
        question: "양자컴퓨터",
        reasoning: "서론, 본론, 결론으로 설명한다."
      }
    });

    expect(prompt).toContain("내용과 초점");
    expect(prompt).toContain("자료와 설명");
    expect(prompt).not.toContain("주장과 초점");
    expect(prompt).not.toContain("근거와 설명");
  });
});
