import { useRef } from "react";
import type { ClipboardEvent, ReactElement, UIEvent } from "react";
import type { Outline, ReviewSuggestion } from "../shared/types";
import { TextArea } from "./ui";

export type ReviewFocus = {
  readonly label: string;
  readonly excerpt: string;
  readonly highlightText: string;
};

type DraftHighlightPart = {
  readonly kind: "plain" | "highlight";
  readonly text: string;
};

const firstDraftSentence = (draft: string): string => {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return "아직 작성한 문장이 없어요.";
  const match = trimmed.match(/^[^\n.!?。！？]+[.!?。！？]?/u);
  const sentence = (match?.[0] ?? trimmed).trim();
  return sentence.length > 96 ? `${sentence.slice(0, 96)}...` : sentence;
};

const draftEndingSegment = (draft: string): string => {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return "아직 작성한 문장이 없어요.";
  return trimmed.length > 110 ? trimmed.slice(-110) : trimmed;
};

const draftEnding = (draft: string): string => {
  const trimmed = draft.trim();
  const segment = draftEndingSegment(draft);
  if (trimmed.length === 0) return segment;
  return trimmed.length > 110 ? `...${segment}` : segment;
};

const draftSentences = (draft: string): readonly string[] =>
  draft
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

const firstSentenceContaining = (draft: string, matcher: (sentence: string) => boolean): string | null => {
  const sentence = draftSentences(draft).find(matcher);
  if (sentence === undefined) return null;
  return sentence.length > 110 ? `${sentence.slice(0, 110)}...` : sentence;
};

const evidenceFocusSentence = (draft: string, outline: Outline): string | null => {
  const evidenceStarts = outline.evidence.map((item) => item.trim().slice(0, 4)).filter((item) => item.length >= 2);
  return firstSentenceContaining(draft, (sentence) => evidenceStarts.some((item) => sentence.includes(item)));
};

const sourceFocusSentence = (draft: string, outline: Outline): string | null => {
  const sourcePattern = /(지문|출처|자료|책에서|도서|기사|보고서|연구|통계|쪽|페이지|웹사이트|뉴스|환경부|논문|조사|문장)/u;
  return firstSentenceContaining(draft, (sentence) => sourcePattern.test(sentence)) ?? evidenceFocusSentence(draft, outline);
};

export const reviewFocus = (suggestion: ReviewSuggestion | null, draft: string, outline: Outline): ReviewFocus | null => {
  if (suggestion === null) return null;
  const useEnding = suggestion.id === "length" || suggestion.id === "positive";
  const highlightText = useEnding
    ? draftEndingSegment(draft)
    : suggestion.id === "evidence"
      ? evidenceFocusSentence(draft, outline) ?? firstDraftSentence(draft)
      : suggestion.id === "source"
        ? sourceFocusSentence(draft, outline) ?? firstDraftSentence(draft)
        : suggestion.id === "counterargument"
          ? firstSentenceContaining(draft, (sentence) => /(하지만|반면|그럼에도|반론|의견)/u.test(sentence)) ?? firstDraftSentence(draft)
          : firstDraftSentence(draft);
  return {
    label: suggestion.focusLabel,
    excerpt: useEnding ? draftEnding(draft) : highlightText,
    highlightText
  };
};

const draftHighlightParts = (draft: string, highlightText: string): readonly DraftHighlightPart[] => {
  if (draft.length === 0 || highlightText.length === 0) return [{ kind: "plain", text: draft }];
  const start = draft.indexOf(highlightText);
  if (start < 0) return [{ kind: "plain", text: draft }];
  const end = start + highlightText.length;
  const parts: readonly DraftHighlightPart[] = [
    { kind: "plain", text: draft.slice(0, start) },
    { kind: "highlight", text: draft.slice(start, end) },
    { kind: "plain", text: draft.slice(end) }
  ];
  return parts.filter((part) => part.text.length > 0);
};

export function DraftEditorWithHighlight(props: { readonly draft: string; readonly highlightText: string; readonly onDraft: (text: string) => void; readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void }): ReactElement {
  const parts = draftHighlightParts(props.draft, props.highlightText);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const syncHighlightScroll = (event: UIEvent<HTMLTextAreaElement>): void => {
    if (highlightLayerRef.current === null) return;
    highlightLayerRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightLayerRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };
  return (
    <div className="draft-editor-stack" data-testid="review-draft-scroll-region">
      <div aria-hidden="true" className="draft-highlight-layer" data-testid="draft-highlight-layer" ref={highlightLayerRef}>
        {parts.map((part, index) => (part.kind === "highlight" ? <mark data-testid="draft-highlighted-span" key={`highlight-${index}`}>{part.text}</mark> : <span key={`plain-${index}`}>{part.text}</span>))}
      </div>
      <TextArea data-testid="draft-editor" className="draft-editor draft-editor-layer" value={props.draft} onChange={(event) => props.onDraft(event.currentTarget.value)} onPaste={props.onPaste} onScroll={syncHighlightScroll} aria-label="최종 글쓰기" />
    </div>
  );
}
