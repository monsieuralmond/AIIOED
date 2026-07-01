import type { ReactElement } from "react";
import { latestOutline } from "../session/session";
import type { ChatRole, PilotEvent, PilotSession, TeacherReviewUpdate } from "../shared/types";
import { TeacherReviewNoteEditor } from "./teacher-review-note";

type SummaryTone = "good" | "neutral" | "warning";

type ProcessSummaryItem = {
  readonly label: string;
  readonly tone: SummaryTone;
  readonly value: string;
};

export type ProcessSignal = {
  readonly detail: string;
  readonly id: string;
  readonly label: string;
  readonly tone: SummaryTone;
  readonly value: string;
};

const latestDraftText = (session: PilotSession): string => session.draftSnapshots.at(-1)?.text ?? "";

const roleLabels: Readonly<Record<ChatRole, string>> = {
  assistant: "AI 코치",
  student: "학생"
};

const stageLabels: Readonly<Record<PilotSession["currentStage"], string>> = {
  reading: "과제 이해",
  review: "고쳐쓰기",
  thinking: "개요 작성",
  writing: "초안 쓰기"
};

const missingFieldLabels: Readonly<Record<string, string>> = {
  claim: "주장",
  counterargument: "반론",
  evidence: "근거",
  reasoning: "설명",
  source: "출처"
};

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const payloadText = (event: PilotEvent, key: string): string => {
  const value = event.payload[key];
  return isString(value) ? value.trim() : "";
};

const payloadNumber = (event: PilotEvent, key: string): number | null => {
  const value = event.payload[key];
  return isNumber(value) ? value : null;
};

const clipped = (value: string, maxLength = 96): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
};

const missingLabels = (event: PilotEvent): readonly string[] => {
  const missing = event.payload["missing"];
  if (!Array.isArray(missing)) return [];
  return missing.filter(isString).map((item) => missingFieldLabels[item] ?? item);
};

const signalForEvent = (event: PilotEvent): ProcessSignal | null => {
  if (event.type === "source_added") {
    return { detail: clipped(payloadText(event, "source")), id: event.id, label: "출처 메모", tone: "good", value: "추가됨" };
  }
  if (event.type === "outline_warning_shown") {
    const missing = missingLabels(event);
    return { detail: missing.length === 0 ? "필수 개요 항목이 채워졌습니다." : `${missing.join(", ")} 보완 필요`, id: event.id, label: "개요 점검", tone: missing.length === 0 ? "good" : "warning", value: missing.length === 0 ? "통과" : `${missing.length}개 보완` };
  }
  if (event.type === "feedback_generated") {
    const count = payloadNumber(event, "count") ?? 0;
    return { detail: "학생이 고쳐쓰기 제안을 열어 확인했습니다.", id: event.id, label: "제안 보기", tone: count > 0 ? "neutral" : "good", value: `${count}개` };
  }
  if (event.type === "suggestion_checked") {
    const resolved = event.payload["resolved"];
    const category = payloadText(event, "category");
    const message = payloadText(event, "message");
    const value = isBoolean(resolved) && resolved ? "해결 확인" : "미해결";
    return { detail: clipped([category, message].filter((item) => item.length > 0).join(": ")), id: event.id, label: "수정 확인", tone: value === "해결 확인" ? "good" : "warning", value };
  }
  if (event.type === "suggestion_resolved") {
    const category = payloadText(event, "category");
    return { detail: category.length === 0 ? "학생이 제안을 해결로 표시했습니다." : `${category} 제안을 해결로 표시했습니다.`, id: event.id, label: "해결 표시", tone: "good", value: "학생 표시" };
  }
  if (event.type === "paste_detected") {
    const textLength = payloadNumber(event, "textLength") ?? 0;
    const preview = payloadText(event, "textPreviewFirst80");
    return { detail: clipped(preview.length === 0 ? "초안 입력 중 붙여넣기 시도가 기록되었습니다." : preview), id: event.id, label: "붙여넣기", tone: "warning", value: `${textLength}자` };
  }
  if (event.type === "submission_created") {
    return { detail: "학생이 최종 글을 제출했습니다.", id: event.id, label: "최종 제출", tone: "good", value: "제출됨" };
  }
  return null;
};

const compactSourceSignals = (signals: readonly ProcessSignal[]): readonly ProcessSignal[] => {
  const compacted: ProcessSignal[] = [];
  const sourceIndexByDetail = new Map<string, number>();
  const sourceCountByDetail = new Map<string, number>();
  for (const signal of signals) {
    if (signal.label !== "출처 메모") {
      compacted.push(signal);
      continue;
    }
    const count = (sourceCountByDetail.get(signal.detail) ?? 0) + 1;
    sourceCountByDetail.set(signal.detail, count);
    const existingIndex = sourceIndexByDetail.get(signal.detail);
    const compactedSignal = count === 1 ? signal : { ...signal, value: `${count}회` };
    if (existingIndex === undefined) {
      sourceIndexByDetail.set(signal.detail, compacted.length);
      compacted.push(compactedSignal);
    } else {
      compacted[existingIndex] = compactedSignal;
    }
  }
  return compacted;
};

const sourceMemoCount = (events: readonly PilotEvent[]): number => {
  const sourceTexts = events.filter((event) => event.type === "source_added").map((event) => payloadText(event, "source")).filter((source) => source.length > 0);
  return new Set(sourceTexts).size;
};

export const processSignalsForSession = (session: PilotSession): readonly ProcessSignal[] => compactSourceSignals(session.events.map(signalForEvent).filter((signal): signal is ProcessSignal => signal !== null)).slice(-8);

export function TeacherProcessRecord(props: { readonly session: PilotSession; readonly onUpdateReview: (sessionId: string, input: TeacherReviewUpdate) => void }): ReactElement {
  const outline = latestOutline(props.session);
  const latestDraft = latestDraftText(props.session);
  const evidenceCount = outline?.evidence.filter((item) => item.trim().length > 0).length ?? 0;
  const hasClaim = outline !== null && outline.claim.trim().length > 0;
  const hasCounterargument = outline !== null && outline.counterargument.trim().length > 0;
  const feedbackEvents = props.session.events.filter((event) => event.type === "feedback_generated");
  const checkEvents = props.session.events.filter((event) => event.type === "suggestion_checked");
  const unresolvedChecks = checkEvents.filter((event) => event.payload["resolved"] !== true);
  const sourceCount = sourceMemoCount(props.session.events);
  const signalItems = processSignalsForSession(props.session);
  const llmLabel = props.session.metadata.llmMode === "real" ? props.session.metadata.model : "모의 코치";
  const summaryItems: readonly ProcessSummaryItem[] = [
    { label: "주장", tone: hasClaim ? "good" : "warning", value: hasClaim ? "주장 있음" : "주장 없음" },
    { label: "근거", tone: evidenceCount >= 2 ? "good" : "warning", value: `근거 ${evidenceCount}개` },
    { label: "출처", tone: sourceCount > 0 ? "good" : "warning", value: sourceCount > 0 ? `${sourceCount}개 메모` : "기록 없음" },
    { label: "수정 확인", tone: unresolvedChecks.length > 0 ? "warning" : checkEvents.length > 0 ? "good" : "neutral", value: checkEvents.length === 0 ? "없음" : `${checkEvents.length}회` },
    { label: "반론", tone: hasCounterargument ? "good" : "warning", value: hasCounterargument ? "반론 있음" : "반론 없음" },
    { label: "제출", tone: props.session.finalSubmission === null ? "neutral" : "good", value: props.session.finalSubmission === null ? "미제출" : "최종 제출됨" }
  ];
  const metrics = [
    { label: "대화", value: `${props.session.chatTurns.length}턴` },
    { label: "생각 정리", value: outline === null ? "없음" : "있음" },
    { label: "초안", value: `${props.session.draftSnapshots.length}개` },
    { label: "붙여넣기", value: `${props.session.pasteEvents.length}회` },
    { label: "피드백", value: `${feedbackEvents.length}회` },
    { label: "이벤트", value: `${props.session.events.length}개` }
  ];

  return (
    <article className="process-record">
      <header className="process-record-header">
        <div>
          <p className="eyebrow">학생 과정 기록</p>
          <h2>{props.session.student.displayName ?? props.session.student.anonymousId}</h2>
          <p className="process-record-subtitle">현재 단계 {stageLabels[props.session.currentStage]} · AI {llmLabel}</p>
        </div>
        <dl className="process-metrics">
          {metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
        </dl>
      </header>
      <section aria-label="과정 점검 요약" className="process-summary">
        <h3>과정 점검 요약</h3>
        <div className="process-summary-list">
          {summaryItems.map((item) => (
            <div className={`process-summary-item ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>
      <ProcessSignalPanel signals={signalItems} />
      <TeacherReviewNoteEditor key={props.session.sessionId} note={props.session.teacherReview} onSave={(input) => props.onUpdateReview(props.session.sessionId, input)} />
      <section>
        <h3>최종 글</h3>
        <p>{props.session.finalSubmission?.text ?? "아직 제출하지 않았습니다."}</p>
      </section>
      <section>
        <h3>대화 기록</h3>
        {props.session.chatTurns.length === 0 ? <p>아직 대화가 없습니다.</p> : <ol className="turn-list">{props.session.chatTurns.map((turn) => <li key={turn.id}><strong>{roleLabels[turn.role]}</strong><p>{turn.text}</p></li>)}</ol>}
      </section>
      <section>
        <h3>생각 정리 기록</h3>
        {outline === null ? <p>아직 생각 정리가 없습니다.</p> : <dl className="process-outline"><div><dt>주장</dt><dd>{outline.claim}</dd></div><div><dt>근거</dt><dd>{outline.evidence.filter((item) => item.trim().length > 0).join(" / ")}</dd></div><div><dt>출처</dt><dd>{outline.question}</dd></div><div><dt>반론</dt><dd>{outline.counterargument}</dd></div></dl>}
      </section>
      <section>
        <h3>초안 기록</h3>
        <p>{props.session.draftSnapshots.length}개 저장, 최근 {latestDraft.length}자</p>
        {latestDraft.length > 0 ? <blockquote>{latestDraft}</blockquote> : null}
      </section>
      <section>
        <h3>붙여넣기 기록</h3>
        {props.session.pasteEvents.length === 0 ? <p>붙여넣기 기록이 없습니다.</p> : <ol className="paste-list">{props.session.pasteEvents.map((paste) => <li key={paste.id}>{paste.textLength}자, {paste.lineCount}줄: {paste.textPreviewFirst80}</li>)}</ol>}
      </section>
    </article>
  );
}

function ProcessSignalPanel(props: { readonly signals: readonly ProcessSignal[] }): ReactElement {
  return (
    <section aria-label="라벨링 신호" className="process-signal-panel">
      <header>
        <h3>라벨링 신호</h3>
        <p>출처, 개요 점검, 수정 확인, 붙여넣기처럼 연구 라벨링에 바로 쓰일 행동입니다.</p>
      </header>
      {props.signals.length === 0 ? <p>아직 뚜렷한 과정 신호가 없습니다.</p> : (
        <ol className="process-signal-list">
          {props.signals.map((signal) => (
            <li className={`process-signal-item ${signal.tone}`} key={signal.id}>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p>{signal.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
