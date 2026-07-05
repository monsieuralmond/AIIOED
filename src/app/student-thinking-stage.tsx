import type { ReactElement } from "react";
import type { Outline } from "../shared/types.js";
import { ThinkingProgressCoach } from "./thinking-progress-coach.js";
import { Button, Field, TextArea, TextInput, WarningBanner } from "./ui.js";

const missingLabels: Readonly<Record<string, string>> = {
  claim: "나의 주장이 아직 짧아요.",
  counterargument: "반론을 한 번 생각해보세요.",
  evidence: "근거가 두 개 필요해요.",
  reasoning: "근거와 주장을 잇는 설명이 더 필요해요.",
  source: "근거가 어디에서 왔는지 출처 메모를 남겨보세요."
};

const rowsFromSourceNote = (sourceNote: string): readonly string[] => (sourceNote.length === 0 ? [""] : sourceNote.split("\n"));

const replaceRow = (items: readonly string[], index: number, value: string): readonly string[] =>
  items.map((item, itemIndex) => (itemIndex === index ? value : item));

const removeRow = (items: readonly string[], index: number): readonly string[] => items.filter((_, itemIndex) => itemIndex !== index);

function DeleteIconButton(props: { readonly disabled?: boolean; readonly label: string; readonly onClick: () => void }): ReactElement {
  return (
    <button aria-label={props.label} className="outline-delete-button" disabled={props.disabled} onClick={props.onClick} title={props.label} type="button">
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

export function ThinkingStage(props: { readonly missing: readonly string[]; readonly outline: Outline; readonly warning: string; readonly onAddEvidence: () => void; readonly onAddSource: () => void; readonly onChange: (outline: Outline) => void; readonly onCheck: () => void; readonly onContinue: () => void; readonly onNext: () => void }): ReactElement {
  const setTextField = (field: "claim" | "reasoning" | "counterargument" | "question", value: string): void => {
    props.onChange({ ...props.outline, [field]: value });
  };
  const evidenceRows = props.outline.evidence.length === 0 ? [""] : props.outline.evidence;
  const sourceRows = rowsFromSourceNote(props.outline.question);
  const setEvidence = (value: string, index: number): void => {
    const evidence = replaceRow(evidenceRows, index, value);
    props.onChange({ ...props.outline, evidence });
  };
  const removeEvidence = (index: number): void => {
    const evidence = removeRow(evidenceRows, index);
    props.onChange({ ...props.outline, evidence: evidence.length === 0 ? [""] : evidence });
  };
  const setSource = (value: string, index: number): void => {
    props.onChange({ ...props.outline, question: replaceRow(sourceRows, index, value).join("\n") });
  };
  const removeSource = (index: number): void => {
    const sources = removeRow(sourceRows, index);
    props.onChange({ ...props.outline, question: sources.length === 0 ? "" : sources.join("\n") });
  };
  const hasMissing = props.missing.length > 0;
  return (
    <article className="outline-surface">
      <h1>개요 작성</h1>
      {props.warning.length > 0 ? (
        <WarningBanner>
          <strong>{props.warning}</strong>
          {hasMissing ? <ul>{props.missing.map((item) => <li key={item}>{missingLabels[item] ?? item}</li>)}</ul> : <p>이제 초안으로 옮겨 쓸 수 있어요.</p>}
          <Button onClick={props.onContinue}>{hasMissing ? "그래도 초안 쓰기" : "초안 쓰기"}</Button>
        </WarningBanner>
      ) : null}
      <ThinkingProgressCoach outline={props.outline} />
      <Field label="중심 생각"><TextInput id="outline-claim" value={props.outline.claim} onChange={(event) => setTextField("claim", event.currentTarget.value)} /></Field>
      {evidenceRows.map((item, index) => (
        <section className="outline-block" key={`evidence-${index + 1}`}>
          <header className="outline-block-header">
            <span className="outline-entry-title">근거 또는 예시 {index + 1}</span>
            <DeleteIconButton label={`${index + 1}번 근거 삭제`} onClick={() => removeEvidence(index)} />
          </header>
          <TextArea aria-label={`근거 또는 예시 ${index + 1}`} className="outline-entry-textarea" id={`outline-evidence-${index + 1}`} value={item} onChange={(event) => setEvidence(event.currentTarget.value, index)} />
        </section>
      ))}
      <section className="source-builder" aria-label="출처 정리">
        <header className="source-builder-header">
          <div>
            <p className="support-label">출처 메모</p>
            <p>지문, 책, 기사, 웹자료처럼 근거가 나온 곳을 한 줄씩 적어요.</p>
          </div>
          <Button onClick={props.onAddSource}>출처 추가</Button>
        </header>
        <div className="source-list">
          {sourceRows.map((source, index) => (
            <section className="source-entry" key={`source-${index + 1}`}>
              <header className="outline-block-header">
                <span className="outline-entry-title">출처 {index + 1}</span>
                <DeleteIconButton disabled={sourceRows.length === 1 && source.trim().length === 0} label={`${index + 1}번 출처 삭제`} onClick={() => removeSource(index)} />
              </header>
              <TextArea aria-label={index === 0 ? "출처 메모" : `출처 메모 ${index + 1}`} className="outline-entry-textarea" id={`outline-source-${index + 1}`} value={source} onChange={(event) => setSource(event.currentTarget.value, index)} placeholder="- 지문: 플라스틱 분해와 생태계 피해 문장" />
            </section>
          ))}
        </div>
      </section>
      <Field label="설명 또는 연결 1"><TextArea id="outline-reasoning" value={props.outline.reasoning} onChange={(event) => setTextField("reasoning", event.currentTarget.value)} /></Field>
      <Field label="반대 의견"><TextArea id="outline-counterargument" value={props.outline.counterargument} onChange={(event) => setTextField("counterargument", event.currentTarget.value)} /></Field>
      <div className="outline-actions">
        <Button onClick={props.onAddEvidence}>근거 추가</Button>
        <Button onClick={props.onCheck}>개요 점검</Button>
        <Button variant="primary" onClick={props.onNext}>초안 쓰기 시작</Button>
      </div>
    </article>
  );
}
