import type { Outline, ReviewSuggestion } from "../shared/types";

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
    suggestions.push({ id: "claim", category: "주장과 초점", text: "초안 첫부분에서 네 주장이 분명히 드러나는지 확인해보세요.", focusLabel: "초안의 첫 부분", resolved: false });
  }
  if (evidenceHits(input.draft, input.outline) < 2) {
    suggestions.push({ id: "evidence", category: "근거와 설명", text: "정리한 근거가 초안 안에서 주장과 연결되는지 다시 확인해보세요.", focusLabel: "근거가 들어가야 할 문장", resolved: false });
  }
  if (!draftShowsSource(input.draft, input.outline)) {
    suggestions.push({ id: "source", category: "근거와 설명", text: "근거가 어디에서 온 것인지 초안에 짧게 표시했는지 확인해보세요.", focusLabel: "근거 출처 표시", resolved: false });
  }
  if (input.outline.counterargument.trim().length > 0 && !/(하지만|반면|그럼에도)/u.test(input.draft)) {
    suggestions.push({ id: "counterargument", category: "구조와 흐름", text: "반론을 인정한 뒤 다시 네 주장으로 돌아오는 문장을 찾아보세요.", focusLabel: "반론 뒤 연결 문장", resolved: false });
  }
  if (input.draft.trim().length < 300) {
    suggestions.push({ id: "length", category: "문장 표현", text: "충분한 설명이 부족해요. 근거가 왜 주장에 도움이 되는지 한두 문장 더 보태보세요.", focusLabel: "설명을 덧붙일 부분", resolved: false });
  }
  return suggestions.length > 0 ? suggestions : [{ id: "positive", category: "좋은 점검", text: "주장, 근거, 반론이 모두 들어가 있어요. 마지막으로 문장 흐름을 읽어보세요.", focusLabel: "전체 글 흐름", resolved: false }];
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
