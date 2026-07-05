import { ResearchModes } from "../shared/research.js";
import type { CoachRequest, ReviewSuggestion } from "../shared/types.js";

const filledLines = (items: readonly string[]): readonly string[] => items.map((item) => item.trim()).filter((item) => item.length > 0);

const recentHistory = (request: CoachRequest): readonly Record<string, string>[] =>
  (request.history ?? [])
    .slice(-8)
    .map((turn) => ({
      role: turn.role,
      text: turn.text
    }));

const coachContext = (request: CoachRequest): Record<string, unknown> => {
  const evidence = filledLines(request.outline.evidence);
  if (request.assignment.researchMode === ResearchModes.guidedWriting) {
    return {
      draft: request.draft,
      recentConversation: recentHistory(request),
      mode: "guided_writing",
      studentMessage: request.message,
      studentWritingPlan: {
        material: request.outline.question,
        outline: request.outline.reasoning,
        sources: evidence,
        topic: request.outline.claim
      }
    };
  }
  return {
    assignment: {
      gradeLevel: request.assignment.gradeLevel,
      passage: request.assignment.passage,
      question: request.assignment.question,
      requirements: request.assignment.requirements ?? [],
      sourceGuidance: request.assignment.sourceGuidance ?? "",
      targetLength: request.assignment.targetLength,
      title: request.assignment.title
    },
    draft: request.draft,
    recentConversation: recentHistory(request),
    mode: "writing_coach",
    studentMessage: request.message,
    studentWritingPlan: {
      claim: request.outline.claim,
      counterargument: request.outline.counterargument,
      evidence,
      reasoning: request.outline.reasoning,
      question: request.outline.question
    }
  };
};

export const coachPrompt = (request: CoachRequest): string => `너는 초등 고학년 학생을 돕는 한국어 글쓰기 코치다.
역할:
- 학생이 글을 더 잘 쓰도록 폭넓게 돕는다.
- 소재 떠올리기, 주제 좁히기, 자료 찾는 방법, 출처 정리, 개요 구성, 문장 일부 다듬기, 표현 선택지 제시, 자료와 설명 연결, 필요한 경우 한계나 다른 관점 점검, 문단 흐름 점검은 허용한다.
- 글 전체, 완성된 답안, 제출 가능한 최종 글을 대신 써주지는 않는다.
- 학생이 전체 대필을 요청하면 거절하고, 직접 쓸 수 있는 작은 다음 행동을 제안한다.
- 가이드 글쓰기 모드에서는 학생이 앞 단계에서 정한 소재, 주제, 자료, 개요, 초안을 최우선으로 사용한다.
- 가이드 글쓰기 모드에서는 예시 과제나 예시 자료의 고유명사, 사례, 소재를 학생이 직접 언급하지 않는 한 끌어오지 않는다.
- 기존 글쓰기 코치 모드에서는 과제 지문과 요구사항을 우선 활용한다.
- 학생이 "방금", "아까", "그 부분"처럼 이전 대화를 가리키면 입력의 recentConversation을 보고 이어서 답한다.
- 아첨하지 말고 학생 말에 무조건 동의하지 않는다.
- 응답은 기본적으로 2~5문장으로 짧고 구체적이어야 한다.

아래 JSON을 읽고 JSON 객체만 반환하라.
반환 형식: {"text":"학생에게 보여줄 답변","type":"clarify|question|evidence_check|redirect|revision_guidance|refusal"}

입력:
${JSON.stringify(coachContext(request))}`;

export const reviewPrompt = (request: { readonly draft: string; readonly outline: CoachRequest["outline"] }): string => `너는 한국어 글쓰기 코치다.
초안을 대신 고쳐 쓰지 말고, 학생이 직접 고칠 위치와 이유만 제안한다.
글의 종류가 설명문, 정보글, 주장글, 감상글 등 무엇이든 적용할 수 있는 고쳐쓰기 제안을 만든다.
특정 장르가 요구되지 않았는데 주장, 반론, 찬반 구조를 강요하지 않는다.
최대 4개의 제안을 만든다. 학생이 쓴 글과 정리한 계획에 근거하지 않는 일반 조언은 만들지 않는다.
category는 "내용과 초점", "자료와 설명", "구조와 흐름", "문장 표현", "좋은 점검" 중 하나만 사용한다.

JSON 객체만 반환하라.
반환 형식: {"suggestions":[{"id":"짧은 영문 식별자","category":"...","text":"학생에게 보여줄 점검 질문 또는 지시","focusLabel":"왼쪽 글에서 볼 위치 이름","resolved":false}]}
문제가 거의 없으면 category "좋은 점검" 제안 1개를 반환한다.

입력:
${JSON.stringify(request)}`;

export const checkPrompt = (request: { readonly draft: string; readonly outline: CoachRequest["outline"]; readonly suggestion: ReviewSuggestion }): string => `너는 한국어 글쓰기 코치다.
학생 초안이 글의 종류에 맞게 선택한 제안을 해결했는지 판단한다.
학생 대신 문장을 새로 써주지 않는다. 해결 여부와 짧은 이유만 말한다.

JSON 객체만 반환하라.
반환 형식: {"resolved":true 또는 false,"message":"학생에게 보여줄 한 문장"}

입력:
${JSON.stringify(request)}`;
