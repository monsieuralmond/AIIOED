import { ResearchModes } from "../shared/research.js";
import type { CoachRequest, CoachResponse } from "../shared/types.js";

const unrelatedPatterns = [/날씨/u, /축구/u, /게임/u, /노래/u];
const fullAuthorshipPatterns = [
  /글\s*전체/u,
  /전체\s*(글|답|답안|원고|에세이)/u,
  /처음부터\s*끝까지/u,
  /완성(된)?\s*(글|답|답안|원고|에세이)/u,
  /대신\s*(써|작성)/u,
  /(그냥|바로)\s*(글|답|답안|원고|에세이).*(써|작성)/u,
  /(글|답|답안|원고|에세이).*(그냥|바로).*(써|작성)/u,
  /서론.*본론.*결론.*(써|작성)/u
];
const clarificationPatterns = [/과제/u, /설명/u, /요구사항/u, /해야\s*할\s*일/u];
const evidencePatterns = [/근거/u, /출처/u, /자료/u, /어디/u, /찾/u, /확인/u];
const revisionPatterns = [/점검/u, /고쳐쓰기/u, /검토/u, /수정/u, /피드백/u, /고쳐\s*줘/u, /바꿔\s*줘/u, /다듬/u, /표현/u, /문장/u, /초안/u, /멋지게/u];

const matches = (patterns: readonly RegExp[], value: string): boolean => patterns.some((pattern) => pattern.test(value));
const isGuidedWriting = (request: CoachRequest): boolean => request.assignment.researchMode === ResearchModes.guidedWriting;

export const createCoachResponse = (request: CoachRequest): CoachResponse => {
  if (matches(unrelatedPatterns, request.message)) {
    return { text: "지금은 글쓰기와 관련된 질문을 도와줄게요. 소재, 주제, 자료, 개요, 초안 중 어디가 막혔는지 말해줄래요?", type: "redirect" };
  }
  if (matches(fullAuthorshipPatterns, request.message)) {
    return { text: "글 전체를 대신 써주지는 않을게요. 대신 소재를 좁히기, 문장 일부 다듬기, 근거 연결, 개요 정리처럼 네가 직접 쓸 수 있게 도와줄 수 있어요.", type: "refusal" };
  }
  if (matches(clarificationPatterns, request.message)) {
    return {
      text: isGuidedWriting(request)
        ? "이 활동은 소재, 주제, 자료, 개요를 바탕으로 네 글을 완성하는 과정이에요. 지금 단계에서 무엇을 정리하고 싶은지 말해줘요."
        : `이 과제는 "${request.assignment.title}"에 대해 지문을 읽고, 네 주장과 근거 두 가지, 반론을 넣어 글을 쓰는 일이에요. 먼저 문제에서 요구하는 조건을 네 말로 한 번 정리해볼래요?`,
      type: "clarify"
    };
  }
  if (matches(evidencePatterns, request.message)) {
    return {
      text: isGuidedWriting(request)
        ? "자료를 고를 때는 내용, 출처, 내 주제와의 연결을 함께 봐야 해요. 지금 찾은 자료 중 글에 꼭 필요한 정보가 무엇인지 한 가지부터 말해줄래요?"
        : "지문에서 네 주장과 가장 가까운 문장을 하나 고르고, 그 문장이 네 생각을 어떻게 뒷받침하는지 네 말로 설명해볼래요?",
      type: "evidence_check"
    };
  }
  if (matches(revisionPatterns, request.message) || request.draft.trim().length > 0) {
    return { text: "부분 표현이나 문장 선택지는 도와줄 수 있어요. 글 전체를 대신 쓰기보다, 어색한 문장이나 막힌 부분을 한두 문장으로 보여주면 왜 고치면 좋은지 같이 볼게요.", type: "revision_guidance" };
  }
  if (request.outline.claim.trim().length === 0) {
    return { text: isGuidedWriting(request) ? "먼저 쓰고 싶은 소재를 하나 정하고, 그 소재에서 독자가 궁금해할 만한 질문을 만들어볼래요?" : "먼저 문제를 보고 네 주장을 한 문장으로 세워볼래요? 지문에서 어떤 단서가 그 주장에 가까운지도 함께 찾아보세요.", type: "question" };
  }
  if (request.outline.evidence.filter((item) => item.trim().length > 0).length < 2) {
    return { text: `"${request.outline.claim}"에 맞는 자료가 아직 적어요. 사실, 사례, 비교, 변화 중 하나를 골라 글에 넣을 만한 근거를 더 찾아볼래요?`, type: "evidence_check" };
  }
  return { text: isGuidedWriting(request) ? "지금 정한 소재와 주제가 글에서 어떻게 이어지는지 한 문장으로 말해볼래요? 그 문장을 기준으로 개요와 자료를 연결해보면 좋아요." : "근거는 주장과 연결되어야 해요. 지문 속 내용이 네 주장에 왜 도움이 되는지 이유를 짧게 설명해볼래요?", type: "question" };
};
