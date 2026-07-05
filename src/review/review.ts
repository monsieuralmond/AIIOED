import type { Outline, ReviewSuggestion } from "../shared/types.js";

export type ReviewSuggestionCheckResult = {
  readonly message: string;
  readonly resolved: boolean;
};

const normalizedWords = (text: string): readonly string[] => text.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/u).filter((word) => word.length >= 2);

const includesClaimWords = (draft: string, claim: string): boolean => normalizedWords(claim).some((word) => draft.includes(word));

const evidenceHits = (draft: string, outline: Outline): number => outline.evidence.filter((item) => item.trim().length > 0 && draft.includes(item.trim().slice(0, 4))).length;

const sourceNotes = (outline: Outline): readonly string[] =>
  outline.question
    .split(/\n|;/u)
    .map((item) => item.replace(/^[-•]\s*/u, "").trim())
    .filter((item) => item.length > 0);

const sourceMarkerPattern = /(지문|출처|자료|책에서|도서|기사|보고서|연구|통계|쪽|페이지|웹사이트|뉴스|환경부|논문|조사|문장)/u;

const draftShowsSource = (draft: string, outline: Outline): boolean => {
  if (sourceNotes(outline).length === 0) return true;
  return sourceMarkerPattern.test(draft);
};

export const createReviewSuggestions = (input: { readonly outline: Outline; readonly draft: string }): readonly ReviewSuggestion[] => {
  const suggestions: ReviewSuggestion[] = [];
  if (!includesClaimWords(input.draft, input.outline.claim)) {
    suggestions.push({ id: "claim", category: "내용과 초점", text: "초안 첫부분에서 글이 무엇을 설명하거나 다루려는지 분명히 드러나는지 확인해보세요.", focusLabel: "초안의 첫 부분", resolved: false });
  }
  if (evidenceHits(input.draft, input.outline) < 2) {
    suggestions.push({ id: "evidence", category: "자료와 설명", text: "정리한 자료나 예시가 초안 안에서 설명하려는 내용과 연결되는지 다시 확인해보세요.", focusLabel: "자료나 예시가 들어가야 할 문장", resolved: false });
  }
  if (!draftShowsSource(input.draft, input.outline)) {
    suggestions.push({ id: "source", category: "자료와 설명", text: "자료나 예시가 어디에서 온 것인지 초안에 짧게 표시했는지 확인해보세요.", focusLabel: "자료 출처 표시", resolved: false });
  }
  if (input.outline.counterargument.trim().length > 0 && !/(하지만|반면|그럼에도)/u.test(input.draft)) {
    suggestions.push({ id: "counterargument", category: "구조와 흐름", text: "다른 관점이나 한계를 언급한 뒤 글의 흐름이 자연스럽게 이어지는지 확인해보세요.", focusLabel: "다른 관점 뒤 연결 문장", resolved: false });
  }
  if (input.draft.trim().length < 300) {
    suggestions.push({ id: "length", category: "문장 표현", text: "충분한 설명이 부족해요. 중요한 내용이 왜 필요한지 한두 문장 더 보태보세요.", focusLabel: "설명을 덧붙일 부분", resolved: false });
  }
  return suggestions.length > 0 ? suggestions : [{ id: "positive", category: "좋은 점검", text: "내용, 자료, 흐름이 잘 연결되어 있어요. 마지막으로 문장 흐름을 읽어보세요.", focusLabel: "전체 글 흐름", resolved: false }];
};

export const reviewSuggestionIsResolved = (input: { readonly outline: Outline; readonly draft: string; readonly suggestion: ReviewSuggestion }): boolean => {
  if (input.suggestion.id === "claim") return includesClaimWords(input.draft, input.outline.claim);
  if (input.suggestion.id === "evidence") return evidenceHits(input.draft, input.outline) >= 2;
  if (input.suggestion.id === "source") return draftShowsSource(input.draft, input.outline);
  if (input.suggestion.id === "counterargument") return input.outline.counterargument.trim().length === 0 || /(하지만|반면|그럼에도)/u.test(input.draft);
  if (input.suggestion.id === "length") return input.draft.trim().length >= 300;
  if (input.suggestion.id === "positive") return true;
  return !createReviewSuggestions({ draft: input.draft, outline: input.outline }).some((suggestion) => suggestion.id === input.suggestion.id);
};

const unresolvedSuggestionMessage = (suggestion: ReviewSuggestion): string => {
  if (suggestion.id === "claim") return "글이 무엇을 다루려는지 아직 초안에 분명히 들어가지 않았어요.";
  if (suggestion.id === "evidence") return "개요에 쓴 자료나 예시 두 가지가 초안에 아직 모두 들어가지 않았어요.";
  if (suggestion.id === "source") return "자료가 어디에서 온 것인지 초안에 아직 표시되지 않았어요.";
  if (suggestion.id === "counterargument") return "다른 관점이나 한계 뒤에 흐름을 이어 주는 연결 문장이 아직 필요해요.";
  if (suggestion.id === "length") return "설명이 아직 짧아요. 중요한 내용이 왜 필요한지 한두 문장 더 보태보세요.";
  return "이 제안은 아직 해결되지 않았어요.";
};

export const createReviewSuggestionCheckResult = (input: { readonly outline: Outline; readonly draft: string; readonly suggestion: ReviewSuggestion }): ReviewSuggestionCheckResult => {
  const resolved = reviewSuggestionIsResolved(input);
  return {
    message: resolved ? "수정이 확인됐어요. 이 제안을 해결로 표시했어요." : unresolvedSuggestionMessage(input.suggestion),
    resolved
  };
};
