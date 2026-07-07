import { useEffect, useMemo, useState } from "react";
import type { ClipboardEvent, FormEvent, ReactElement } from "react";
import { addAssistantCoachTurn, addChatTurn, updateSessionLlmMetadata } from "../session/session.js";
import { GuidedWritingStages } from "../shared/research.js";
import type { ChatTurn, CoachResponseType, LlmMode, PilotSession, ReviewSuggestion } from "../shared/types.js";
import { requestCoachResponse, requestReviewSuggestions, requestSuggestionCheck } from "../ai/api-client.js";
import { DraftEditorWithHighlight, reviewFocus } from "./review-draft-editor.js";
import { FeedbackPanel } from "./student-feedback-panel.js";
import type { SuggestionCheckResult } from "./student-feedback-panel.js";
import {
  createGuidedOutlineBodyEntry,
  createGuidedSourceEntry,
  enterGuidedFeedback,
  guidedEvent,
  guidedNowIso,
  guidedOutlineHasText,
  guidedOutlineForCoach,
  guidedOutlineToText,
  guidedStepOrder,
  guidedStepSpecs,
  guidedSourcesHaveText,
  guidedSourcesToText,
  guidedTopicHasText,
  guidedTopicToText,
  hasText,
  latestGuidedDraftText,
  latestGuidedFeedbackSuggestions,
  latestGuidedOutlinePlan,
  latestGuidedSources,
  latestGuidedStepText,
  latestGuidedTopicPlan,
  latestGuidedWritingTitle,
  recordGuidedDraft,
  recordGuidedFeedbackGenerated,
  recordGuidedPaste,
  recordGuidedWritingTitle,
  recordGuidedSuggestionCheck,
  resolveGuidedSuggestion,
  saveGuidedOutlinePlan,
  saveGuidedSources,
  saveGuidedStep,
  saveGuidedTopicPlan,
  stepForGuidedStage,
  submitGuidedWriting
} from "./guided-writing-model.js";
import type { GuidedOutlineBodyEntry, GuidedOutlinePlan, GuidedSourceEntry, GuidedStep, GuidedTextStep, GuidedTopicPlan } from "./guided-writing-model.js";
import { Button, Surface, TextArea, TextInput, WarningBanner } from "./ui.js";

type GuidedValues = Readonly<Record<GuidedStep, string>>;
type GuidedExportFormat = "doc" | "txt";
type GuidedCoachTab = "coach" | "outline";

const withLlmMetadata = (session: PilotSession, llmMode: LlmMode | undefined, model: string | undefined): PilotSession =>
  llmMode === undefined || model === undefined ? session : updateSessionLlmMetadata(session, llmMode, model);

const isGuidedTextStep = (step: GuidedStep): step is GuidedTextStep => step === "material";

const resolvedSuggestionIdsFromSession = (session: PilotSession): readonly string[] =>
  session.events.flatMap((event) => {
    const suggestionId = event.payload["suggestionId"];
    return event.type === "suggestion_resolved" && event.stage === GuidedWritingStages.feedback && typeof suggestionId === "string" ? [suggestionId] : [];
  });

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");

const safeFileName = (value: string): string => {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/gu, "-").replace(/\s+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized.length > 0 ? normalized : "guided-writing";
};

const downloadFile = (fileName: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const exportGuidedDraft = (draft: string, title: string, format: GuidedExportFormat): void => {
  const baseName = safeFileName(title);
  if (format === "txt") {
    downloadFile(`${baseName}.txt`, new Blob([`${title}\n\n${draft}`], { type: "text/plain;charset=utf-8" }));
    return;
  }
  const body = escapeHtml(draft).replaceAll("\n", "<br>");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#1f1f2e;}main{max-width:720px;margin:40px auto;}h1{font-size:24px;margin:0 0 24px;}p{white-space:normal;}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${body}</p></main></body></html>`;
  downloadFile(`${baseName}.doc`, new Blob([html], { type: "application/msword;charset=utf-8" }));
};

const replaceSourceEntry = (sources: readonly GuidedSourceEntry[], id: string, patch: Partial<Pick<GuidedSourceEntry, "content" | "source">>): readonly GuidedSourceEntry[] =>
  sources.map((source) => (source.id === id ? { ...source, ...patch } : source));

const removeSourceEntry = (sources: readonly GuidedSourceEntry[], id: string): readonly GuidedSourceEntry[] => {
  const nextSources = sources.filter((source) => source.id !== id);
  return nextSources.length > 0 ? nextSources : [createGuidedSourceEntry()];
};

const replaceBodyEntry = (items: readonly GuidedOutlineBodyEntry[], id: string, text: string): readonly GuidedOutlineBodyEntry[] =>
  items.map((item) => (item.id === id ? { ...item, text } : item));

const removeBodyEntry = (items: readonly GuidedOutlineBodyEntry[], id: string): readonly GuidedOutlineBodyEntry[] => {
  const nextItems = items.filter((item) => item.id !== id);
  return nextItems.length > 0 ? nextItems : [createGuidedOutlineBodyEntry()];
};

const enterGuidedStepWithoutSaving = (session: PilotSession, step: GuidedStep): PilotSession => {
  const nextStage = guidedStepSpecs[step].stage;
  if (nextStage === session.currentStage) return session;
  return {
    ...session,
    currentStage: nextStage,
    events: [...session.events, guidedEvent("stage_entered", nextStage, { stage: nextStage })],
    updatedAt: guidedNowIso()
  };
};

export function GuidedWritingFlow(props: { readonly session: PilotSession; readonly setSession: (updater: (session: PilotSession) => PilotSession) => void }): ReactElement {
  const currentStep = stepForGuidedStage(props.session.currentStage);
  const values = useMemo<GuidedValues>(
    () => ({
      material: latestGuidedStepText(props.session, "material"),
      outline: latestGuidedStepText(props.session, "outline"),
      revision: "",
      sources: latestGuidedStepText(props.session, "sources"),
      topic: guidedTopicToText(latestGuidedTopicPlan(props.session)) || latestGuidedStepText(props.session, "topic"),
      writing: latestGuidedDraftText(props.session)
    }),
    [props.session]
  );
  const [stepText, setStepText] = useState(() => (isGuidedTextStep(currentStep) ? values[currentStep] : ""));
  const [topicPlan, setTopicPlan] = useState<GuidedTopicPlan>(() => latestGuidedTopicPlan(props.session));
  const [writingTitle, setWritingTitle] = useState(() => latestGuidedWritingTitle(props.session));
  const [sources, setSources] = useState<readonly GuidedSourceEntry[]>(() => latestGuidedSources(props.session));
  const [outlinePlan, setOutlinePlan] = useState<GuidedOutlinePlan>(() => latestGuidedOutlinePlan(props.session));
  const [draft, setDraft] = useState(() => values.writing);
  const [chatInput, setChatInput] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [reviewSuggestions, setReviewSuggestions] = useState<readonly ReviewSuggestion[]>(() => latestGuidedFeedbackSuggestions(props.session));
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(() => latestGuidedFeedbackSuggestions(props.session)[0]?.id ?? null);
  const [resolvedSuggestionIds, setResolvedSuggestionIds] = useState<readonly string[]>(() => resolvedSuggestionIdsFromSession(props.session));
  const [suggestionCheckResult, setSuggestionCheckResult] = useState<SuggestionCheckResult | null>(null);
  const [checkingSuggestionId, setCheckingSuggestionId] = useState<string | null>(null);

  useEffect(() => {
    setStepText(isGuidedTextStep(currentStep) ? values[currentStep] : "");
    setTopicPlan(latestGuidedTopicPlan(props.session));
    setWritingTitle(latestGuidedWritingTitle(props.session));
    setSources(latestGuidedSources(props.session));
    setOutlinePlan(latestGuidedOutlinePlan(props.session));
    setDraft(values.writing);
    const nextSuggestions = latestGuidedFeedbackSuggestions(props.session);
    setReviewSuggestions(nextSuggestions);
    setSelectedSuggestionId(nextSuggestions[0]?.id ?? null);
    setResolvedSuggestionIds(resolvedSuggestionIdsFromSession(props.session));
    setSuggestionCheckResult(null);
    setCheckingSuggestionId(null);
  }, [currentStep, props.session, values]);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [props.session.currentStage]);

  const currentIndex = currentStep === "revision" && props.session.currentStage === GuidedWritingStages.completed ? guidedStepOrder.length - 1 : guidedStepOrder.findIndex((step) => step === currentStep);
  const nextStep = guidedStepOrder[currentIndex + 1] ?? null;
  const previousStep = guidedStepOrder[currentIndex - 1] ?? null;
  const completed = props.session.currentStage === GuidedWritingStages.completed;
  const selectedSuggestion = reviewSuggestions.find((suggestion) => suggestion.id === selectedSuggestionId) ?? reviewSuggestions[0] ?? null;
  const withSupportPanel = (currentStep === "writing" || currentStep === "revision") && !completed;
  const currentTopicText = guidedTopicToText(topicPlan) || values.topic;
  const artworkTitle = writingTitle.trim();
  const exportTitle = artworkTitle.length > 0 ? artworkTitle : "최종 글";
  const displayTitle = writingTitle.trim().length > 0 ? writingTitle.trim() : props.session.assignment.title;

  const coachValues = (): GuidedValues => ({
    material: values.material,
    outline: guidedOutlineToText(outlinePlan) || values.outline,
    revision: "",
    sources: guidedSourcesToText(sources) || values.sources,
    topic: currentTopicText,
    writing: draft
  });

  const coachHistoryWithPendingMessage = (message: string): readonly ChatTurn[] => [
    ...props.session.chatTurns,
    {
      id: `pending-${Date.now()}`,
      role: "student",
      text: message,
      timestamp: new Date().toISOString()
    }
  ];

  const saveCurrentAndEnter = (step: GuidedStep): void => {
    if (step === currentStep) return;
    props.setSession((session) => {
      if (currentStep === "sources") return guidedSourcesHaveText(sources) ? saveGuidedSources(session, sources, step) : enterGuidedStepWithoutSaving(session, step);
      if (currentStep === "outline") return guidedOutlineHasText(outlinePlan) ? saveGuidedOutlinePlan(session, outlinePlan, step) : enterGuidedStepWithoutSaving(session, step);
      if (currentStep === "topic") return guidedTopicHasText(topicPlan) ? saveGuidedTopicPlan(session, { focus: topicPlan.focus, title: "" }, step) : enterGuidedStepWithoutSaving(session, step);
      if (isGuidedTextStep(currentStep)) return hasText(stepText) ? saveGuidedStep(session, currentStep, stepText, step) : enterGuidedStepWithoutSaving(session, step);
      return enterGuidedStepWithoutSaving(session, step);
    });
  };

  const saveAndNext = (): void => {
    if (nextStep === null) return;
    saveCurrentAndEnter(nextStep);
  };

  const changeDraft = (text: string): void => {
    setDraft(text);
    props.setSession((session) => recordGuidedDraft(session, text));
  };

  const changeTitle = (title: string): void => {
    setWritingTitle(title);
    props.setSession((session) => recordGuidedWritingTitle(session, title));
  };

  const pasteDraft = (clipboardEvent: ClipboardEvent<HTMLTextAreaElement>): void => {
    const text = clipboardEvent.clipboardData.getData("text/plain");
    props.setSession((session) => recordGuidedPaste(session, text));
  };

  const submit = (): void => {
    if (!hasText(draft)) return;
    props.setSession((session) => submitGuidedWriting(recordGuidedWritingTitle(session, writingTitle), draft));
  };

  const sendMessage = (): void => {
    const message = chatInput.trim();
    if (message.length === 0 || coachBusy) return;
    props.setSession((session) => addChatTurn(session, "student", message));
    setChatInput("");
    setApiError("");
    setCoachBusy(true);
    requestCoachResponse({ assignment: props.session.assignment, draft, history: coachHistoryWithPendingMessage(message), message, outline: guidedOutlineForCoach(coachValues()) })
      .then((response) => {
        if (response.text.trim().length === 0) throw new Error("AI가 빈 응답을 반환했습니다. 같은 질문을 한 번 더 보내 주세요.");
        props.setSession((session) => withLlmMetadata(addAssistantCoachTurn(session, response.text, response.type), response.llmMode, response.model));
      })
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : "AI 응답에 실패했습니다."))
      .finally(() => setCoachBusy(false));
  };

  const startRevision = (): void => {
    if (!hasText(draft)) return;
    setApiError("");
    setReviewBusy(true);
    const reviewOutline = guidedOutlineForCoach(coachValues());
    requestReviewSuggestions({ draft, outline: reviewOutline })
      .then((response) => {
        setReviewSuggestions(response.suggestions);
        setSelectedSuggestionId(response.suggestions[0]?.id ?? null);
        setResolvedSuggestionIds([]);
        setSuggestionCheckResult(null);
        setCheckingSuggestionId(null);
        props.setSession((session) => {
          const withTitle = recordGuidedWritingTitle(session, writingTitle);
          const withDraft = recordGuidedDraft(withTitle, draft);
          const withFeedbackStage = enterGuidedFeedback(withDraft);
          return withLlmMetadata(recordGuidedFeedbackGenerated(withFeedbackStage, response.suggestions), response.llmMode, response.model);
        });
      })
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : "AI 고쳐쓰기 제안 생성에 실패했습니다."))
      .finally(() => setReviewBusy(false));
  };

  const selectSuggestion = (id: string): void => {
    setSuggestionCheckResult(null);
    setCheckingSuggestionId(null);
    setSelectedSuggestionId(id);
  };

  const markSuggestion = (suggestion: ReviewSuggestion): void => {
    setResolvedSuggestionIds((items) => (items.includes(suggestion.id) ? items : [...items, suggestion.id]));
    props.setSession((session) => resolveGuidedSuggestion(session, suggestion));
  };

  const checkSuggestion = (suggestion: ReviewSuggestion): void => {
    setApiError("");
    setCheckingSuggestionId(suggestion.id);
    requestSuggestionCheck({ draft, outline: guidedOutlineForCoach(coachValues()), suggestion })
      .then((response) => {
        setSuggestionCheckResult({ message: response.message, status: response.resolved ? "resolved" : "open", suggestionId: response.suggestionId });
        if (response.resolved) setResolvedSuggestionIds((items) => (items.includes(suggestion.id) ? items : [...items, suggestion.id]));
        props.setSession((session) => {
          const checkedSession = recordGuidedSuggestionCheck(session, suggestion, response);
          return response.resolved ? resolveGuidedSuggestion(checkedSession, suggestion) : checkedSession;
        });
      })
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : "수정 확인에 실패했습니다."))
      .finally(() => setCheckingSuggestionId(null));
  };

  return (
    <main className="student-page guided-writing-page">
      <section className="student-session-bar">
        <strong>{displayTitle}</strong>
      </section>
      <section className="student-progress-row guided-progress-row">
        <ol className="guided-stepper" aria-label="글쓰기 단계">
          {guidedStepOrder.map((step, index) => (
            <li className={index <= currentIndex ? "guided-step active" : "guided-step"} key={step}>
              <button aria-current={step === currentStep ? "step" : undefined} className="guided-step-button" disabled={completed} type="button" onClick={() => saveCurrentAndEnter(step)}>
                {index + 1}. {guidedStepSpecs[step].label}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className={withSupportPanel ? "workspace guided-writing-workspace with-coach" : "workspace guided-writing-workspace"}>
        <Surface className="work-pane guided-writing-pane" testId="guided-writing-flow">
          {completed ? <GuidedComplete draft={draft} exportTitle={exportTitle} title={artworkTitle} /> : null}
          {!completed && currentStep === "material" ? <GuidedPlanningStage step={currentStep} text={stepText} onText={setStepText} /> : null}
          {!completed && currentStep === "topic" ? <GuidedTopicStage focus={topicPlan.focus} onFocus={(focus: string) => setTopicPlan({ focus, title: "" })} /> : null}
          {!completed && currentStep === "sources" ? <GuidedSourcesStage sources={sources} onAdd={() => setSources((items) => [...items, createGuidedSourceEntry()])} onChange={setSources} /> : null}
          {!completed && currentStep === "outline" ? <GuidedOutlineStage outline={outlinePlan} sources={sources} onChange={setOutlinePlan} /> : null}
          {!completed && currentStep === "writing" ? <GuidedDraftStage draft={draft} title={writingTitle} onDraft={changeDraft} onPaste={pasteDraft} onTitle={changeTitle} /> : null}
          {!completed && currentStep === "revision" ? <GuidedRevisionStage draft={draft} outline={guidedOutlineForCoach(coachValues())} selectedSuggestion={selectedSuggestion} onDraft={changeDraft} onPaste={pasteDraft} /> : null}
          {apiError.length > 0 && currentStep !== "writing" ? <div className="guided-inline-warning"><WarningBanner>{apiError}</WarningBanner></div> : null}
          {!completed ? (
            <footer className="guided-stage-actions">
              <Button disabled={previousStep === null} onClick={() => previousStep === null ? undefined : saveCurrentAndEnter(previousStep)}>이전 단계</Button>
              {currentStep === "writing" ? <Button disabled={!hasText(draft) || reviewBusy} variant="primary" onClick={startRevision}>{reviewBusy ? "제안 만드는 중" : "고쳐쓰기 제안 보기"}</Button> : null}
              {currentStep === "revision" ? <Button disabled={!hasText(draft)} variant="primary" onClick={submit}>최종 제출</Button> : null}
              {currentStep !== "writing" && currentStep !== "revision" ? <Button variant="primary" onClick={saveAndNext}>다음 단계</Button> : null}
            </footer>
          ) : null}
        </Surface>
        {currentStep === "writing" && !completed ? <GuidedCoachPanel busy={coachBusy} error={apiError} input={chatInput} turns={props.session.chatTurns} values={coachValues()} onInput={setChatInput} onSend={sendMessage} /> : null}
        {currentStep === "revision" && !completed ? (
          <GuidedFeedbackSupportPanel
            checkingSuggestionId={checkingSuggestionId}
            resolvedSuggestionIds={resolvedSuggestionIds}
            selectedSuggestion={selectedSuggestion}
            suggestionCheckResult={suggestionCheckResult}
            suggestions={reviewSuggestions}
            onCheckSuggestion={checkSuggestion}
            onResolveSuggestion={markSuggestion}
            onSelectSuggestion={selectSuggestion}
          />
        ) : null}
      </section>
    </main>
  );
}

function GuidedPlanningStage(props: { readonly onText: (value: string) => void; readonly step: GuidedTextStep; readonly text: string }): ReactElement {
  const spec = guidedStepSpecs[props.step];
  const promptHeading = props.step === "material" ? "소재를 떠올려볼까요" : "생각해볼 질문";
  return (
    <article className="guided-stage-card">
      <p className="eyebrow">AI 없이 직접 정리하기</p>
      <h1>{spec.title}</h1>
      <p>{spec.helper}</p>
      <section className="guided-thinking-prompts" aria-label={`${spec.label} 생각 질문`}>
        <strong>{promptHeading}</strong>
        <ul>
          {spec.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
      </section>
      <label className="guided-writing-editor">
        <span>{spec.label}</span>
        <TextArea placeholder={spec.placeholder} rows={10} value={props.text} onChange={(event) => props.onText(event.currentTarget.value)} />
      </label>
    </article>
  );
}

function GuidedTopicStage(props: { readonly focus: string; readonly onFocus: (value: string) => void }): ReactElement {
  const spec = guidedStepSpecs.topic;
  return (
    <article className="guided-stage-card">
      <p className="eyebrow">AI 없이 직접 정리하기</p>
      <h1>{spec.title}</h1>
      <p>{spec.helper}</p>
      <section className="guided-thinking-prompts" aria-label="주제 정하기 생각 질문">
        <strong>생각해볼 질문</strong>
        <ul>
          {spec.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
      </section>
      <div className="guided-topic-fields">
        <label className="guided-writing-editor">
          <span>주제 설명</span>
          <TextArea placeholder="예: 큐비트와 일반 비트의 차이를 중심으로 양자컴퓨터의 원리를 쉽게 설명한다." rows={6} value={props.focus} onChange={(event) => props.onFocus(event.currentTarget.value)} />
        </label>
      </div>
    </article>
  );
}

function GuidedSourcesStage(props: { readonly onAdd: () => void; readonly onChange: (sources: readonly GuidedSourceEntry[]) => void; readonly sources: readonly GuidedSourceEntry[] }): ReactElement {
  const spec = guidedStepSpecs.sources;
  return (
    <article className="guided-stage-card">
      <p className="eyebrow">AI 없이 직접 정리하기</p>
      <h1>{spec.title}</h1>
      <p>{spec.helper}</p>
      <section className="guided-thinking-prompts" aria-label="자료 찾기 생각 질문">
        <strong>자료를 고를 때</strong>
        <ul>
          {spec.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
      </section>
      <div className="guided-structured-list">
        {props.sources.map((source, index) => (
          <section className="guided-source-entry" key={source.id}>
            <header className="guided-entry-header">
              <strong>자료 {index + 1}</strong>
              <IconDeleteButton disabled={props.sources.length === 1 && !guidedSourcesHaveText(props.sources)} label={`자료 ${index + 1} 삭제`} onClick={() => props.onChange(removeSourceEntry(props.sources, source.id))} />
            </header>
            <label className="guided-writing-editor">
              <span>내용</span>
              <TextArea placeholder="예: 양자컴퓨터는 0과 1을 동시에 다루는 양자 상태를 이용해 특정 계산을 빠르게 처리할 수 있다." rows={4} value={source.content} onChange={(event) => props.onChange(replaceSourceEntry(props.sources, source.id, { content: event.currentTarget.value }))} />
            </label>
            <label className="guided-writing-editor">
              <span>출처</span>
              <TextInput placeholder="예: 한국과학기술정보연구원 자료, IBM Quantum 설명 문서, 과학 해설 기사" value={source.source} onChange={(event) => props.onChange(replaceSourceEntry(props.sources, source.id, { source: event.currentTarget.value }))} />
            </label>
          </section>
        ))}
      </div>
      <div className="guided-inline-actions">
        <Button onClick={props.onAdd}>자료 추가</Button>
      </div>
    </article>
  );
}

function GuidedOutlineStage(props: { readonly onChange: (outline: GuidedOutlinePlan) => void; readonly outline: GuidedOutlinePlan; readonly sources: readonly GuidedSourceEntry[] }): ReactElement {
  const spec = guidedStepSpecs.outline;
  const [showSources, setShowSources] = useState(false);
  const setField = (field: "conclusion" | "introduction", value: string): void => props.onChange({ ...props.outline, [field]: value });
  const setBody = (body: readonly GuidedOutlineBodyEntry[]): void => props.onChange({ ...props.outline, body });
  return (
    <article className="guided-stage-card">
      <p className="eyebrow">AI 없이 직접 정리하기</p>
      <h1>{spec.title}</h1>
      <p>{spec.helper}</p>
      <div className="guided-reference-actions">
        <Button variant="secondary" onClick={() => setShowSources((current) => !current)}>{showSources ? "자료 닫기" : "자료 보기"}</Button>
      </div>
      {showSources ? <GuidedSourcesReference sources={props.sources} /> : null}
      <section className="guided-thinking-prompts" aria-label="개요 짜기 생각 질문">
        <strong>서론-본론-결론으로 놓아보기</strong>
        <ul>
          {spec.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
      </section>
      <section className="guided-outline-section">
        <h2>서론</h2>
        <TextArea placeholder="예: 스마트폰보다 더 작은 반도체 칩 하나가 자동차와 인공지능까지 움직이는 시대가 되었다." rows={4} value={props.outline.introduction} onChange={(event) => setField("introduction", event.currentTarget.value)} />
      </section>
      <section className="guided-outline-section">
        <header className="guided-entry-header">
          <h2>본론</h2>
          <Button onClick={() => setBody([...props.outline.body, createGuidedOutlineBodyEntry()])}>본론 칸 추가</Button>
        </header>
        <div className="guided-structured-list">
          {props.outline.body.map((entry, index) => (
            <section className="guided-body-entry" key={entry.id}>
              <header className="guided-entry-header">
                <strong>본론 {index + 1}</strong>
                <IconDeleteButton disabled={props.outline.body.length === 1 && entry.text.trim().length === 0} label={`본론 ${index + 1} 삭제`} onClick={() => setBody(removeBodyEntry(props.outline.body, entry.id))} />
              </header>
              <TextArea placeholder="예: 반도체는 전기가 흐르는 길을 아주 작게 조절해 정보를 처리한다." rows={4} value={entry.text} onChange={(event) => setBody(replaceBodyEntry(props.outline.body, entry.id, event.currentTarget.value))} />
            </section>
          ))}
        </div>
      </section>
      <section className="guided-outline-section">
        <h2>결론</h2>
        <TextArea placeholder="예: 기술은 멀리 있는 것이 아니라 우리가 매일 쓰는 기기 안에서 세상을 움직이고 있다." rows={4} value={props.outline.conclusion} onChange={(event) => setField("conclusion", event.currentTarget.value)} />
      </section>
    </article>
  );
}

function GuidedSourcesReference(props: { readonly sources: readonly GuidedSourceEntry[] }): ReactElement {
  const visibleSources = props.sources.filter((source) => source.content.trim().length > 0 || source.source.trim().length > 0);
  return (
    <section className="guided-reference-panel" aria-label="자료 찾기에서 정리한 내용">
      <header>
        <strong>자료 찾기에서 쓴 내용</strong>
        <span>개요를 짤 때 참고만 하고, 필요한 부분은 내 말로 다시 정리하세요.</span>
      </header>
      {visibleSources.length === 0 ? <p>아직 저장된 자료가 없습니다.</p> : null}
      {visibleSources.map((source, index) => (
        <article key={source.id}>
          <strong>자료 {index + 1}</strong>
          {source.content.trim().length > 0 ? <p>{source.content}</p> : null}
          {source.source.trim().length > 0 ? <small>출처: {source.source}</small> : null}
        </article>
      ))}
    </section>
  );
}

function GuidedDraftStage(props: { readonly draft: string; readonly onDraft: (value: string) => void; readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void; readonly onTitle: (value: string) => void; readonly title: string }): ReactElement {
  return (
    <article className="guided-stage-card guided-draft-card">
      <p className="eyebrow">AI 도움을 받을 수 있는 단계</p>
      <h1>글쓰기</h1>
      <label className="guided-writing-editor guided-title-editor">
        <span>제목</span>
        <TextInput placeholder="예: 양자컴퓨터는 왜 특별한 계산을 할 수 있을까?" value={props.title} onChange={(event) => props.onTitle(event.currentTarget.value)} />
      </label>
      <section className="guided-thinking-prompts" aria-label="글쓰기 생각 질문">
        <strong>글쓰기 전 확인</strong>
        <ul>
          {guidedStepSpecs.writing.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
      </section>
      <TextArea aria-label="단계형 최종 글쓰기" className="draft-editor guided-draft-editor" placeholder={guidedStepSpecs.writing.placeholder} value={props.draft} onChange={(event) => props.onDraft(event.currentTarget.value)} onPaste={props.onPaste} />
      <div className="draft-footer"><span>{props.draft.length}자</span></div>
    </article>
  );
}

function GuidedRevisionStage(props: { readonly draft: string; readonly onDraft: (value: string) => void; readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void; readonly outline: ReturnType<typeof guidedOutlineForCoach>; readonly selectedSuggestion: ReviewSuggestion | null }): ReactElement {
  const focus = reviewFocus(props.selectedSuggestion, props.draft, props.outline);
  return (
    <article className="guided-stage-card guided-revision-card">
      <p className="eyebrow">AI 제안 확인 후 직접 고치기</p>
      <h1>고쳐쓰기</h1>
      <p>오른쪽 제안을 보며 설명이 부족한 곳을 직접 고쳐 씁니다. AI가 문장을 대신 완성하지 않습니다.</p>
      {focus === null ? null : (
        <section aria-label="선택한 피드백 초점" className="review-focus-strip">
          <div><span>지금 볼 곳</span><strong>{focus.label}</strong></div>
          <blockquote>{focus.excerpt}</blockquote>
        </section>
      )}
      <DraftEditorWithHighlight draft={props.draft} highlightText={focus?.highlightText ?? ""} onDraft={props.onDraft} onPaste={props.onPaste} />
      <div className="draft-footer"><span>{props.draft.length}자</span></div>
    </article>
  );
}

function GuidedSummary(props: { readonly values: GuidedValues }): ReactElement {
  return (
    <dl className="guided-summary">
      {(["material", "topic", "sources", "outline"] as const).map((step) => <div key={step}><dt>{guidedStepSpecs[step].label}</dt><dd>{props.values[step] || "아직 없음"}</dd></div>)}
    </dl>
  );
}

function GuidedCoachPanel(props: { readonly busy: boolean; readonly error: string; readonly input: string; readonly onInput: (value: string) => void; readonly onSend: () => void; readonly turns: readonly ChatTurn[]; readonly values: GuidedValues }): ReactElement {
  const [activeTab, setActiveTab] = useState<GuidedCoachTab>("coach");
  const tabClassName = (tab: GuidedCoachTab): string => (activeTab === tab ? "coach-tab active" : "coach-tab");
  const canSend = !props.busy && props.input.trim().length > 0;
  const submitMessage = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSend) return;
    props.onSend();
  };
  return (
    <aside className="coach-panel guided-coach-panel" data-testid="guided-writing-coach" onCopy={(event) => event.preventDefault()}>
      <div className="coach-tabs" role="tablist" aria-label="글쓰기 도움 메뉴">
        <button aria-controls="guided-coach-tabpanel" aria-selected={activeTab === "coach"} className={tabClassName("coach")} id="guided-coach-tab" role="tab" type="button" onClick={() => setActiveTab("coach")}>코치</button>
        <button aria-controls="guided-outline-tabpanel" aria-selected={activeTab === "outline"} className={tabClassName("outline")} id="guided-outline-tab" role="tab" type="button" onClick={() => setActiveTab("outline")}>개요</button>
      </div>
      <div className="coach-panel-content">
        {activeTab === "coach" ? (
          <section aria-labelledby="guided-coach-tab" className="chat-section" id="guided-coach-tabpanel" role="tabpanel">
            <div className="chat-log">
              <div className="assistant-message">앞에서 정리한 내용을 바탕으로 글을 쓰다가 막히는 점을 질문하세요. 글 전체를 대신 써 달라는 요청에는 답하지 않습니다.</div>
              {props.turns.map((turn) => <GuidedCoachMessage key={turn.id} turn={turn} />)}
            </div>
            {props.error.length > 0 ? <WarningBanner>{props.error}</WarningBanner> : null}
            <form className="chat-input" onSubmit={submitMessage}>
              <TextInput placeholder="글쓰기에서 막힌 점 질문하기" value={props.input} onChange={(event) => props.onInput(event.currentTarget.value)} />
              <Button disabled={!canSend} type="submit">{props.busy ? "응답 중" : "보내기"}</Button>
            </form>
          </section>
        ) : (
          <section aria-labelledby="guided-outline-tab" className="guided-outline-tab" id="guided-outline-tabpanel" role="tabpanel">
            <p>앞에서 직접 정리한 내용을 확인하며 글을 이어가세요.</p>
            <GuidedSummary values={props.values} />
          </section>
        )}
      </div>
    </aside>
  );
}

function GuidedFeedbackSupportPanel(props: { readonly checkingSuggestionId: string | null; readonly onCheckSuggestion: (suggestion: ReviewSuggestion) => void; readonly onResolveSuggestion: (suggestion: ReviewSuggestion) => void; readonly onSelectSuggestion: (id: string) => void; readonly resolvedSuggestionIds: readonly string[]; readonly selectedSuggestion: ReviewSuggestion | null; readonly suggestionCheckResult: SuggestionCheckResult | null; readonly suggestions: readonly ReviewSuggestion[] }): ReactElement {
  return (
    <aside className="coach-panel guided-coach-panel" data-testid="guided-writing-feedback" onCopy={(event) => event.preventDefault()}>
      <div className="coach-tabs"><button aria-selected="true" className="coach-tab active" role="tab" type="button">고쳐쓰기</button></div>
      <div className="coach-panel-content">
        {props.suggestions.length === 0 ? (
          <section className="feedback-panel">
            <header className="feedback-header"><span className="coach-avatar small">RC</span><div><h2>아직 제안이 없습니다.</h2><p>이전 단계로 돌아가 고쳐쓰기 제안을 먼저 만들어 주세요.</p></div></header>
          </section>
        ) : (
          <FeedbackPanel
            actions={{ onCheckSuggestion: props.onCheckSuggestion, onResolveSuggestion: props.onResolveSuggestion, onSelectSuggestion: props.onSelectSuggestion }}
            model={{
              checkingSuggestionId: props.checkingSuggestionId,
              resolvedSuggestionIds: props.resolvedSuggestionIds,
              selectedSuggestion: props.selectedSuggestion,
              suggestionCheckResult: props.suggestionCheckResult,
              suggestions: props.suggestions
            }}
          />
        )}
      </div>
    </aside>
  );
}

function GuidedCoachMessage(props: { readonly turn: ChatTurn }): ReactElement {
  const label = (responseType: CoachResponseType | undefined): string => responseType === "refusal" ? "대신 쓰기 거절" : responseType === "redirect" ? "과제 복귀" : "글쓰기 도움";
  return props.turn.role === "student" ? <div className="student-message">{props.turn.text}</div> : <div className="assistant-message"><span className="assistant-response-type">{label(props.turn.responseType)}</span><span>{props.turn.text}</span></div>;
}

function IconDeleteButton(props: { readonly disabled?: boolean; readonly label: string; readonly onClick: () => void }): ReactElement {
  return (
    <button aria-label={props.label} className="outline-delete-button guided-delete-button" disabled={props.disabled} onClick={props.onClick} title={props.label} type="button">
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </svg>
    </button>
  );
}

function GuidedComplete(props: { readonly draft: string; readonly exportTitle: string; readonly title: string }): ReactElement {
  return (
    <article className="guided-stage-card guided-complete-card">
      <p className="eyebrow">제출 완료</p>
      <h1>글이 완성되었습니다</h1>
      <p>다른 문서 편집기나 디자인 도구에서 다시 다듬을 수 있도록 파일로 내보낼 수 있습니다.</p>
      <section aria-label="완성된 글 미리보기" className="final-artwork-preview">
        <div className="final-artwork-frame">
          {props.title.length > 0 ? <h2>{props.title}</h2> : null}
          <p>{props.draft}</p>
        </div>
      </section>
      <div className="guided-export-actions" aria-label="최종 글 내보내기">
        <Button variant="primary" onClick={() => exportGuidedDraft(props.draft, props.exportTitle, "doc")}>내 작품 내보내기 (Word)</Button>
        <Button onClick={() => exportGuidedDraft(props.draft, props.exportTitle, "txt")}>텍스트 파일</Button>
      </div>
    </article>
  );
}
