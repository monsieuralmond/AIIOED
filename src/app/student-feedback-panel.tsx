import type { ReactElement } from "react";
import type { ReviewSuggestion } from "../shared/types";
import { Button } from "./ui";

export type SuggestionCheckResult = {
  readonly message: string;
  readonly status: "open" | "resolved";
  readonly suggestionId: string;
};

export type FeedbackPanelModel = {
  readonly checkingSuggestionId: string | null;
  readonly resolvedSuggestionIds: readonly string[];
  readonly selectedSuggestion: ReviewSuggestion | null;
  readonly suggestionCheckResult: SuggestionCheckResult | null;
  readonly suggestions: readonly ReviewSuggestion[];
};

export type FeedbackPanelActions = {
  readonly onCheckSuggestion: (suggestion: ReviewSuggestion) => void;
  readonly onResolveSuggestion: (suggestion: ReviewSuggestion) => void;
  readonly onSelectSuggestion: (id: string) => void;
};

type FeedbackCategoryDefinition = {
  readonly key: ReviewSuggestion["category"];
  readonly title: string;
};

type SuggestionDetailModel = {
  readonly checkResult: SuggestionCheckResult | null;
  readonly checking: boolean;
  readonly resolved: boolean;
  readonly suggestion: ReviewSuggestion;
};

type FeedbackCategoryModel = {
  readonly category: FeedbackCategoryDefinition;
  readonly resolvedSuggestionIds: readonly string[];
  readonly selectedSuggestionId: string | null;
  readonly suggestions: readonly ReviewSuggestion[];
};

const feedbackCategories: readonly FeedbackCategoryDefinition[] = [
  { key: "주장과 초점", title: "1. 주장과 초점" },
  { key: "근거와 설명", title: "2. 근거와 설명" },
  { key: "구조와 흐름", title: "3. 구조와 흐름" },
  { key: "문장 표현", title: "4. 문장 표현" }
];

const resolvedSuggestionCount = (suggestions: readonly ReviewSuggestion[], resolvedSuggestionIds: readonly string[]): number =>
  suggestions.filter((suggestion) => resolvedSuggestionIds.includes(suggestion.id)).length;

const focusStatus = (model: SuggestionDetailModel): string => {
  if (model.resolved) return "해결 표시됨";
  if (model.checking) return "수정 확인 중";
  if (model.checkResult?.status === "resolved") return "수정 확인됨";
  if (model.checkResult?.status === "open") return "다시 살펴보기";
  return "왼쪽 글에서 확인하기";
};

export function FeedbackPanel(props: { readonly actions: FeedbackPanelActions; readonly model: FeedbackPanelModel }): ReactElement {
  const resolvedCount = resolvedSuggestionCount(props.model.suggestions, props.model.resolvedSuggestionIds);
  const remainingCount = Math.max(props.model.suggestions.length - resolvedCount, 0);
  const detailModel = props.model.selectedSuggestion === null ? null : {
    checkResult: props.model.suggestionCheckResult?.suggestionId === props.model.selectedSuggestion.id ? props.model.suggestionCheckResult : null,
    checking: props.model.checkingSuggestionId === props.model.selectedSuggestion.id,
    resolved: props.model.resolvedSuggestionIds.includes(props.model.selectedSuggestion.id),
    suggestion: props.model.selectedSuggestion
  } satisfies SuggestionDetailModel;

  return (
    <section aria-label="검토 제안" className="feedback-panel">
      <header className="feedback-header">
        <span className="coach-avatar small">RC</span>
        <div><h2>고쳐쓰기를 위한 피드백</h2><p>{props.model.suggestions.length}개의 제안을 확인하세요.</p></div>
      </header>
      <FeedbackProgress remainingCount={remainingCount} resolvedCount={resolvedCount} totalCount={props.model.suggestions.length} />
      {detailModel === null ? null : <CurrentFocus model={detailModel} />}
      <div className="feedback-categories">
        {feedbackCategories.map((category) => <FeedbackCategory actions={{ onSelectSuggestion: props.actions.onSelectSuggestion }} key={category.key} model={{ category, resolvedSuggestionIds: props.model.resolvedSuggestionIds, selectedSuggestionId: props.model.selectedSuggestion?.id ?? null, suggestions: props.model.suggestions }} />)}
      </div>
      {detailModel === null ? null : <SuggestionDetail actions={props.actions} model={detailModel} />}
    </section>
  );
}

function FeedbackProgress(props: { readonly remainingCount: number; readonly resolvedCount: number; readonly totalCount: number }): ReactElement {
  return (
    <section aria-label="고쳐쓰기 진행 상황" className="feedback-progress-summary">
      <div aria-label={`전체 제안 ${props.totalCount}개`} className="feedback-progress-item">
        <span>전체</span>
        <strong>{props.totalCount}</strong>
      </div>
      <div aria-label={`해결한 제안 ${props.resolvedCount}개`} className="feedback-progress-item">
        <span>해결</span>
        <strong>{props.resolvedCount}</strong>
      </div>
      <div aria-label={`남은 제안 ${props.remainingCount}개`} className="feedback-progress-item pending">
        <span>남은 제안</span>
        <strong>{props.remainingCount}</strong>
      </div>
    </section>
  );
}

function CurrentFocus(props: { readonly model: SuggestionDetailModel }): ReactElement {
  return (
    <section aria-label="현재 볼 곳" className="current-feedback-focus">
      <span className="support-label">현재 볼 곳</span>
      <strong>{props.model.suggestion.focusLabel}</strong>
      <small>{focusStatus(props.model)}</small>
    </section>
  );
}

function SuggestionDetail(props: { readonly actions: FeedbackPanelActions; readonly model: SuggestionDetailModel }): ReactElement {
  return (
    <section className="suggestion-detail" role="note">
      <p className="support-label">제안 보기</p>
      <strong className="suggestion-focus-label">{props.model.suggestion.focusLabel}</strong>
      <p>{props.model.suggestion.text}</p>
      {props.model.checking ? <p className="suggestion-checking-note" aria-live="polite">수정 내용을 확인하고 있어요.</p> : null}
      {props.model.checkResult === null ? null : <p className={`suggestion-check-result ${props.model.checkResult.status}`}>{props.model.checkResult.message}</p>}
      <div className="suggestion-actions">
        <Button disabled={props.model.checking} onClick={() => props.actions.onCheckSuggestion(props.model.suggestion)}>{props.model.checking ? "확인 중" : "내 수정 확인"}</Button>
        <Button disabled={props.model.checking || props.model.resolved} onClick={() => props.actions.onResolveSuggestion(props.model.suggestion)}>해결 표시</Button>
      </div>
    </section>
  );
}

function FeedbackCategory(props: { readonly actions: { readonly onSelectSuggestion: (id: string) => void }; readonly model: FeedbackCategoryModel }): ReactElement {
  const items = props.model.suggestions.filter((suggestion) => suggestion.category === props.model.category.key);
  const resolvedCount = items.filter((suggestion) => props.model.resolvedSuggestionIds.includes(suggestion.id)).length;
  const allResolved = items.length === 0 || resolvedCount === items.length;
  const active = items.some((suggestion) => suggestion.id === props.model.selectedSuggestionId);
  const categoryClass = ["feedback-category", allResolved ? "complete" : "", active ? "active" : ""].filter((item) => item.length > 0).join(" ");
  return (
    <section className={categoryClass}>
      <div>
        <strong>{props.model.category.title}</strong>
        <span className={allResolved ? "feedback-state complete" : "feedback-state pending"}>{items.length === 0 ? "점검 완료" : `${resolvedCount}/${items.length} 해결됨`}</span>
      </div>
      {items.length === 0 ? <p>현재 큰 제안은 없습니다.</p> : (
        <div className="feedback-actions">
          {items.map((suggestion) => {
            const resolved = props.model.resolvedSuggestionIds.includes(suggestion.id);
            const selected = suggestion.id === props.model.selectedSuggestionId;
            return <Button aria-pressed={selected} className={selected ? "active-suggestion-button" : ""} disabled={resolved} key={suggestion.id} onClick={() => props.actions.onSelectSuggestion(suggestion.id)}>{resolved ? "확인됨" : "제안 보기"}</Button>;
          })}
        </div>
      )}
    </section>
  );
}
