import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { ChatTurn, Outline, ReviewSuggestion, Stage } from "../shared/types.js";
import { FeedbackPanel } from "./student-feedback-panel.js";
import type { FeedbackPanelActions, FeedbackPanelModel, SuggestionCheckResult } from "./student-feedback-panel.js";
import { Button, TextInput } from "./ui.js";

type PanelTab = "chat" | "outline" | "feedback";

export type { SuggestionCheckResult } from "./student-feedback-panel.js";

type SupportPanelProps = {
  readonly checkingSuggestionId: string | null;
  readonly chatInput: string;
  readonly coachBusy: boolean;
  readonly outline: Outline;
  readonly resolvedSuggestionIds: readonly string[];
  readonly selectedSuggestionId: string | null;
  readonly suggestionCheckResult: SuggestionCheckResult | null;
  readonly stage: Stage;
  readonly suggestions: readonly ReviewSuggestion[];
  readonly turns: readonly ChatTurn[];
  readonly onInput: (value: string) => void;
  readonly onQuickPrompt: (message: string) => void;
  readonly onCheckSuggestion: (suggestion: ReviewSuggestion) => void;
  readonly onResolveSuggestion: (suggestion: ReviewSuggestion) => void;
  readonly onSelectSuggestion: (id: string) => void;
  readonly onSend: () => void;
};

const hasText = (value: string): boolean => value.trim().length > 0;

const sourceNotes = (outline: Outline): readonly string[] =>
  outline.question
    .split(/\n|;/u)
    .map((item) => item.replace(/^[-•]\s*/u, "").trim())
    .filter(hasText);

const responseTypeLabels: Readonly<Record<NonNullable<ChatTurn["responseType"]>, string>> = {
  clarify: "과제 설명",
  evidence_check: "근거 점검",
  question: "질문",
  redirect: "과제 복귀",
  refusal: "대신 쓰기 거절",
  revision_guidance: "고쳐쓰기 안내"
};

const tabsForStage = (stage: Stage): readonly PanelTab[] => {
  if (stage === "review") return ["feedback", "outline"];
  if (stage === "writing") return ["chat", "outline"];
  return ["chat"];
};

const defaultTab = (stage: Stage): PanelTab => (stage === "review" ? "feedback" : "chat");

const tabLabel = (tab: PanelTab): string => {
  if (tab === "chat") return "코치";
  if (tab === "outline") return "개요";
  return "피드백";
};

export function StudentSupportPanel(props: SupportPanelProps): ReactElement {
  const tabs = useMemo(() => tabsForStage(props.stage), [props.stage]);
  const [activeTab, setActiveTab] = useState<PanelTab>(() => defaultTab(props.stage));

  useEffect(() => {
    setActiveTab(defaultTab(props.stage));
  }, [props.stage]);

  const selectedSuggestion = props.suggestions.find((suggestion) => suggestion.id === props.selectedSuggestionId) ?? props.suggestions[0] ?? null;
  const feedbackModel: FeedbackPanelModel = {
    checkingSuggestionId: props.checkingSuggestionId,
    resolvedSuggestionIds: props.resolvedSuggestionIds,
    selectedSuggestion,
    suggestionCheckResult: props.suggestionCheckResult,
    suggestions: props.suggestions
  };
  const feedbackActions: FeedbackPanelActions = {
    onCheckSuggestion: props.onCheckSuggestion,
    onResolveSuggestion: props.onResolveSuggestion,
    onSelectSuggestion: props.onSelectSuggestion
  };

  return (
    <aside className="coach-panel" data-active-tab={activeTab} data-testid="coach-panel" onCopy={(event) => event.preventDefault()}>
      <div className="coach-tabs" role="tablist" aria-label="글쓰기 도움 메뉴">
        {tabs.map((tab) => (
          <button aria-selected={activeTab === tab} className={activeTab === tab ? "coach-tab active" : "coach-tab"} key={tab} onClick={() => setActiveTab(tab)} role="tab" type="button">
            {tabLabel(tab)}
          </button>
        ))}
      </div>
      <div className="coach-panel-content" key={activeTab}>
        {activeTab === "chat" ? <ChatPanel {...props} /> : null}
        {activeTab === "outline" ? <OutlinePanel outline={props.outline} /> : null}
        {activeTab === "feedback" ? <FeedbackPanel actions={feedbackActions} model={feedbackModel} /> : null}
      </div>
    </aside>
  );
}

function ChatPanel(props: SupportPanelProps): ReactElement {
  return (
    <section className="chat-section" aria-label="AI 코치 대화">
      <div className="quick-actions" aria-label="빠른 질문">
        <Button disabled={props.coachBusy} onClick={() => props.onQuickPrompt("이 과제를 내가 해야 할 일 중심으로 설명해줘.")}>과제 설명해줘</Button>
        <Button disabled={props.coachBusy} onClick={() => props.onQuickPrompt("좋은 답안에 꼭 들어가야 할 요구사항을 확인해줘.")}>요구사항 확인</Button>
        {props.stage !== "reading" ? <Button disabled={props.coachBusy} onClick={() => props.onQuickPrompt("내 주장에 맞는 근거를 어디서 어떻게 확인할지 질문해줘.")}>근거 점검</Button> : null}
        {props.stage === "thinking" ? <Button disabled={props.coachBusy} onClick={() => props.onQuickPrompt("내 개요에서 빠진 부분을 질문으로 알려줘.")}>개요 도와줘</Button> : null}
        {props.stage !== "reading" ? <Button disabled={props.coachBusy} onClick={() => props.onQuickPrompt("지금 막힌 부분을 스스로 풀 수 있게 질문해줘.")}>막혔어요</Button> : null}
      </div>
      <div className="chat-log" onCopy={(event) => event.preventDefault()}>
        <div className="assistant-message">먼저 과제를 이해하고, 네 주장을 스스로 세워볼까요?</div>
        {props.turns.map((turn) => <CoachMessage key={turn.id} turn={turn} />)}
      </div>
      <div className="chat-input">
        <TextInput placeholder="코치에게 물어보기" value={props.chatInput} onChange={(event) => props.onInput(event.currentTarget.value)} />
        <Button disabled={props.coachBusy} onClick={props.onSend}>{props.coachBusy ? "응답 중" : "보내기"}</Button>
      </div>
    </section>
  );
}

function CoachMessage(props: { readonly turn: ChatTurn }): ReactElement {
  if (props.turn.role === "student") {
    return <div className="student-message">{props.turn.text}</div>;
  }
  return (
    <div className="assistant-message" data-response-type={props.turn.responseType ?? "untyped"}>
      {props.turn.responseType === undefined ? null : <span className="assistant-response-type">{responseTypeLabels[props.turn.responseType]}</span>}
      <span>{props.turn.text}</span>
    </div>
  );
}

function OutlinePanel(props: { readonly outline: Outline }): ReactElement {
  const evidence = props.outline.evidence.filter(hasText);
  const sources = sourceNotes(props.outline);
  return (
    <section aria-label="개요 요약" className="stage-support">
      <p className="support-label">개요</p>
      <dl className="support-outline">
        <div><dt>중심 생각</dt><dd>{props.outline.claim || "아직 없음"}</dd></div>
        <div><dt>근거</dt><dd>{evidence.join(" / ") || "아직 없음"}</dd></div>
        <div>
          <dt>출처</dt>
          <dd>{sources.length === 0 ? "아직 없음" : <ul className="source-summary-list">{sources.map((source) => <li key={source}>{source}</li>)}</ul>}</dd>
        </div>
        <div><dt>설명</dt><dd>{props.outline.reasoning || "아직 없음"}</dd></div>
        <div><dt>반대 의견</dt><dd>{props.outline.counterargument || "아직 없음"}</dd></div>
      </dl>
    </section>
  );
}
