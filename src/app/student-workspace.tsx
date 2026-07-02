import { useEffect, useMemo, useState } from "react";
import type { ClipboardEvent, ReactElement } from "react";
import { requestCoachResponse } from "../ai/api-client";
import { createReviewSuggestionCheckResult, createReviewSuggestions } from "../review/review";
import { addAssistantCoachTurn, addChatTurn, enterStage, latestDraft, latestOutline, outlineMissingFields, recordFeedbackGenerated, recordPaste, recordSuggestionCheck, resolveSuggestion, submitFinal, updateDraft, updateOutline, updateSessionLlmMetadata, warnWeakOutline } from "../session/session";
import { emptyOutline } from "../shared/fixtures";
import type { LlmMode, Outline, PilotSession, ReviewSuggestion, Stage } from "../shared/types";
import { Stepper } from "./layout";
import { DraftEditorWithHighlight, reviewFocus } from "./review-draft-editor";
import { AssignmentReference } from "./student-assignment-reference";
import { ReadingStage } from "./student-reading-stage";
import { StudentSupportPanel } from "./student-support-panel";
import type { SuggestionCheckResult } from "./student-support-panel";
import { ThinkingStage } from "./student-thinking-stage";
import { StudentWritingStage } from "./student-writing-stage";
import { Button, Surface, WarningBanner } from "./ui";

const withLlmMetadata = (session: PilotSession, llmMode: LlmMode | undefined, model: string | undefined): PilotSession =>
  llmMode === undefined || model === undefined ? session : updateSessionLlmMetadata(session, llmMode, model);

const resolvedSuggestionIdsFromSession = (session: PilotSession): readonly string[] =>
  session.events.flatMap((event) => {
    const suggestionId = event.payload["suggestionId"];
    return event.type === "suggestion_resolved" && typeof suggestionId === "string" ? [suggestionId] : [];
  });

export function StudentWorkspace(props: { readonly session: PilotSession; readonly setSession: (updater: (session: PilotSession) => PilotSession) => void }): ReactElement {
  const [outline, setOutline] = useState<Outline>(() => latestOutline(props.session) ?? emptyOutline);
  const [draft, setDraft] = useState(() => latestDraft(props.session));
  const [chatInput, setChatInput] = useState("");
  const [apiError, setApiError] = useState("");
  const [warning, setWarning] = useState("");
  const [warningFields, setWarningFields] = useState<readonly string[]>([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [resolvedSuggestionIds, setResolvedSuggestionIds] = useState<readonly string[]>([]);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [reviewSuggestions, setReviewSuggestions] = useState<readonly ReviewSuggestion[]>(() => (props.session.currentStage === "review" ? createReviewSuggestions({ outline, draft }) : []));
  const [suggestionCheckResult, setSuggestionCheckResult] = useState<SuggestionCheckResult | null>(null);
  const [checkingSuggestionId, setCheckingSuggestionId] = useState<string | null>(null);
  const liveSuggestions = useMemo(() => createReviewSuggestions({ outline, draft }), [draft, outline]);
  const suggestions = props.session.currentStage === "review" && reviewSuggestions.length > 0 ? reviewSuggestions : liveSuggestions;
  const selectedSuggestion = suggestions.find((suggestion) => suggestion.id === selectedSuggestionId) ?? suggestions[0] ?? null;
  const previousStage = previousStageFor(props.session.currentStage);

  useEffect(() => {
    const nextOutline = latestOutline(props.session) ?? emptyOutline;
    const nextDraft = latestDraft(props.session);
    setOutline(nextOutline);
    setDraft(nextDraft);
    setSubmitted(props.session.finalSubmission !== null);
    setResolvedSuggestionIds(resolvedSuggestionIdsFromSession(props.session));
    setSelectedSuggestionId(null);
    setSuggestionCheckResult(null);
    setCheckingSuggestionId(null);
    setReviewSuggestions(props.session.currentStage === "review" ? createReviewSuggestions({ draft: nextDraft, outline: nextOutline }) : []);
  }, [props.session.sessionId]);

  const goStage = (stage: Stage): void => props.setSession((session) => enterStage(session, stage));
  const saveOutline = (nextOutline: Outline): void => { setOutline(nextOutline); props.setSession((session) => updateOutline(session, nextOutline)); };
  const sendCoachMessage = (message: string): void => {
    if (message.trim().length === 0) return;
    props.setSession((session) => addChatTurn(session, "student", message));
    setChatInput("");
    setApiError("");
    setWarning("");
    setCoachBusy(true);
    requestCoachResponse({ assignment: props.session.assignment, outline, draft, message })
      .then((response) => {
        props.setSession((session) => withLlmMetadata(addAssistantCoachTurn(session, response.text, response.type), response.llmMode, response.model));
      })
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : "AI 코치 응답에 실패했습니다."))
      .finally(() => setCoachBusy(false));
  };
  const sendChat = (): void => sendCoachMessage(chatInput);
  const startWriting = (): void => {
    const missing = outlineMissingFields(outline);
    if (missing.length > 0) {
      setWarning("생각 정리가 아직 부족해요");
      setWarningFields(missing);
      props.setSession((session) => warnWeakOutline(session, outline));
      return;
    }
    setWarning("");
    setWarningFields([]);
    goStage("writing");
  };
  const changeDraft = (text: string): void => { setDraft(text); props.setSession((session) => updateDraft(session, text)); };
  const pasteDraft = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const text = event.clipboardData.getData("text/plain");
    props.setSession((session) => recordPaste(session, text));
    setWarning("붙여넣기가 기록되었어요");
  };
  const submit = (): void => { props.setSession((session) => submitFinal(session, draft)); setSubmitted(true); };
  const openReview = (): void => {
    const localSuggestions = createReviewSuggestions({ draft, outline });
    setApiError("");
    setWarning("기본 피드백을 열었어요.");
    setReviewSuggestions(localSuggestions);
    setSelectedSuggestionId(localSuggestions[0]?.id ?? null);
    setSuggestionCheckResult(null);
    setCheckingSuggestionId(null);
    setReviewBusy(false);
    props.setSession((session) => {
      const reviewSession = session.currentStage === "review" ? session : enterStage(session, "review");
      return recordFeedbackGenerated(reviewSession, localSuggestions);
    });
  };
  const markSuggestion = (suggestion: ReviewSuggestion): void => {
    setResolvedSuggestionIds((items) => (items.includes(suggestion.id) ? items : [...items, suggestion.id]));
    props.setSession((session) => resolveSuggestion(session, suggestion));
  };
  const selectSuggestion = (id: string): void => {
    setSuggestionCheckResult(null);
    setCheckingSuggestionId(null);
    setSelectedSuggestionId(id);
  };
  const checkSuggestion = (suggestion: ReviewSuggestion): void => {
    const result = createReviewSuggestionCheckResult({ draft, outline, suggestion });
    setCheckingSuggestionId(null);
    setSuggestionCheckResult(null);
    setSuggestionCheckResult({
      message: result.message,
      status: result.resolved ? "resolved" : "open",
      suggestionId: suggestion.id
    });
    if (result.resolved) setResolvedSuggestionIds((items) => (items.includes(suggestion.id) ? items : [...items, suggestion.id]));
    props.setSession((session) => {
      const checkedSession = recordSuggestionCheck(session, suggestion, result);
      return result.resolved ? resolveSuggestion(checkedSession, suggestion) : checkedSession;
    });
  };
  const advance = (): void => {
    if (props.session.currentStage === "reading") {
      goStage("thinking");
      return;
    }
    if (props.session.currentStage === "thinking") {
      startWriting();
      return;
    }
    if (props.session.currentStage === "writing") {
      openReview();
    }
  };
  const moveBackward = (): void => {
    if (previousStage === null) return;
    setWarning("");
    setWarningFields([]);
    goStage(previousStage);
  };

  return (
    <main className="student-page">
      <section className="student-session-bar">
        <strong>{props.session.assignment.title}</strong>
        <Button className="assignment-reference-button" variant="ghost" onClick={() => setAssignmentOpen(true)}>과제 보기</Button>
      </section>
      <section className="student-progress-row">
        <Stepper current={props.session.currentStage} />
        <div className="stage-navigation-actions">
          <Button aria-label="이전 단계" disabled={previousStage === null} onClick={moveBackward}>이전 단계</Button>
          <Button aria-label="다음 단계" disabled={props.session.currentStage === "review"} variant="primary" onClick={advance}>{nextStageLabel(props.session.currentStage)}</Button>
        </div>
      </section>
      {apiError.length > 0 ? <section className="student-api-warning"><WarningBanner>{apiError}</WarningBanner></section> : null}
      <section className="workspace">
        <Surface className="work-pane" testId="work-pane">
          {props.session.currentStage === "reading" ? <ReadingStage session={props.session} onNext={() => goStage("thinking")} /> : null}
          {props.session.currentStage === "thinking" ? <ThinkingStage missing={warningFields} outline={outline} warning={warning} onAddEvidence={() => saveOutline({ ...outline, evidence: [...outline.evidence, ""] })} onAddSource={() => saveOutline({ ...outline, question: outline.question.trim().length === 0 ? "- " : `${outline.question.trimEnd()}\n- ` })} onChange={saveOutline} onCheck={() => { const missing = outlineMissingFields(outline); setWarningFields(missing); setWarning(missing.length === 0 ? "개요가 준비됐어요" : "개요를 점검했어요"); props.setSession((session) => warnWeakOutline(session, outline)); }} onContinue={() => goStage("writing")} onNext={startWriting} /> : null}
          {props.session.currentStage === "writing" ? <StudentWritingStage draft={draft} outline={outline} reviewBusy={reviewBusy} warning={warning} onDraft={changeDraft} onPaste={pasteDraft} onReview={openReview} /> : null}
          {props.session.currentStage === "review" ? <ReviewStage draft={draft} outline={outline} selectedSuggestion={selectedSuggestion} submitted={submitted} warning={warning} onDraft={changeDraft} onPaste={pasteDraft} onSubmit={submit} /> : null}
        </Surface>
        <StudentSupportPanel checkingSuggestionId={checkingSuggestionId} chatInput={chatInput} coachBusy={coachBusy} outline={outline} resolvedSuggestionIds={resolvedSuggestionIds} selectedSuggestionId={selectedSuggestion?.id ?? null} stage={props.session.currentStage} suggestionCheckResult={suggestionCheckResult} suggestions={suggestions} turns={props.session.chatTurns} onCheckSuggestion={checkSuggestion} onInput={setChatInput} onQuickPrompt={sendCoachMessage} onResolveSuggestion={markSuggestion} onSelectSuggestion={selectSuggestion} onSend={sendChat} />
      </section>
      {assignmentOpen ? <AssignmentReference session={props.session} onClose={() => setAssignmentOpen(false)} /> : null}
    </main>
  );
}

const nextStageLabel = (stage: Stage): string => {
  if (stage === "reading") return "다음: 개요 작성";
  if (stage === "thinking") return "다음: 초안 쓰기";
  if (stage === "writing") return "다음: 고쳐쓰기";
  return "제출 전 확인";
};

const previousStageFor = (stage: Stage): Stage | null => {
  if (stage === "thinking") return "reading";
  if (stage === "writing") return "thinking";
  if (stage === "review") return "writing";
  return null;
};

function ReviewStage(props: { readonly draft: string; readonly outline: Outline; readonly selectedSuggestion: ReviewSuggestion | null; readonly submitted: boolean; readonly warning: string; readonly onDraft: (text: string) => void; readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void; readonly onSubmit: () => void }): ReactElement {
  const focus = reviewFocus(props.selectedSuggestion, props.draft, props.outline);
  return (
    <article className="draft-surface review-writing-surface">
      <h1>고쳐쓰기</h1>
      <p className="draft-guide">오른쪽 피드백을 확인하며 초안을 직접 고쳐 씁니다.</p>
      {props.warning.length > 0 ? <WarningBanner>{props.warning}</WarningBanner> : null}
      {focus === null ? null : (
        <section aria-label="선택한 피드백 초점" className="review-focus-strip">
          <div><span>지금 볼 곳</span><strong>{focus.label}</strong></div>
          <blockquote>{focus.excerpt}</blockquote>
        </section>
      )}
      <DraftEditorWithHighlight draft={props.draft} highlightText={focus?.highlightText ?? ""} onDraft={props.onDraft} onPaste={props.onPaste} />
      <div className="draft-footer review-draft-footer">
        <span>{props.draft.length}자</span>
        <div>
          {props.submitted ? <p className="success-text">제출 완료</p> : null}
          <Button variant="primary" onClick={props.onSubmit}>제출</Button>
        </div>
      </div>
    </article>
  );
}
