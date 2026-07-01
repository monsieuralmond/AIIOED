import type { CoachRequest, CoachResponse } from "../shared/types";

const unrelatedPatterns = [/날씨/u, /축구/u, /게임/u, /노래/u, /뉴스/u];
const authorshipPatterns = [/써\s*줘/u, /작성해/u, /대신\s*써/u, /고쳐\s*줘/u, /바꿔\s*줘/u, /멋지게/u, /초안/u, /문장/u];
const clarificationPatterns = [/과제/u, /설명/u, /요구사항/u, /해야\s*할\s*일/u];
const evidencePatterns = [/근거/u, /출처/u, /자료/u, /어디/u, /찾/u, /확인/u];
const revisionPatterns = [/점검/u, /고쳐쓰기/u, /검토/u, /수정/u, /피드백/u];

const matches = (patterns: readonly RegExp[], value: string): boolean => patterns.some((pattern) => pattern.test(value));

export const createCoachResponse = (request: CoachRequest): CoachResponse => {
  if (matches(unrelatedPatterns, request.message)) {
    return { text: "지금은 이 지문과 문제를 해결하는 대화만 할 수 있어요. 네 주장이나 근거 중 어디가 막혔는지 말해줄래요?", type: "redirect" };
  }
  if (matches(authorshipPatterns, request.message)) {
    return { text: "대신 네 생각을 네가 먼저 한 문장으로 적어볼래요? 나는 완성된 답을 써주지 않고, 지문과 근거를 스스로 확인하도록 질문으로 도와줄게요.", type: "refusal" };
  }
  if (matches(clarificationPatterns, request.message)) {
    return { text: `이 과제는 "${request.assignment.title}"에 대해 지문을 읽고, 네 주장과 근거 두 가지, 반론을 넣어 글을 쓰는 일이에요. 먼저 문제에서 요구하는 조건을 네 말로 한 번 정리해볼래요?`, type: "clarify" };
  }
  if (matches(evidencePatterns, request.message)) {
    return { text: "지문에서 네 주장과 가장 가까운 문장을 하나 고르고, 그 문장이 네 생각을 어떻게 뒷받침하는지 네 말로 설명해볼래요?", type: "evidence_check" };
  }
  if (matches(revisionPatterns, request.message) || request.draft.trim().length > 0) {
    return { text: "초안을 고칠 때는 내가 대신 문장을 바꾸지 않을게요. 주장, 근거, 설명, 반론 중 가장 약한 한 곳을 표시하고 왜 약한지 먼저 말해볼래요?", type: "revision_guidance" };
  }
  if (request.outline.claim.trim().length === 0) {
    return { text: "먼저 문제를 보고 네 주장을 한 문장으로 세워볼래요? 지문에서 어떤 단서가 그 주장에 가까운지도 함께 찾아보세요.", type: "question" };
  }
  if (request.outline.evidence.filter((item) => item.trim().length > 0).length < 2) {
    return { text: `주장 "${request.outline.claim}"은 보이지만 근거가 아직 적어요. 지문에서 이 주장을 받치는 단서를 하나 더 찾고, 그 단서가 무엇을 보여주는지 적어볼래요?`, type: "evidence_check" };
  }
  return { text: "근거는 주장과 연결되어야 해요. 지문 속 내용이 네 주장에 왜 도움이 되는지 이유를 짧게 설명해볼래요?", type: "question" };
};
