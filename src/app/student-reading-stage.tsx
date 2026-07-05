import type { ReactElement } from "react";
import type { PilotSession } from "../shared/types.js";
import { Button } from "./ui.js";

export function ReadingStage(props: { readonly session: PilotSession; readonly onNext: () => void }): ReactElement {
  return (
    <article className="document-surface">
      <section className="coach-intro">
        <span className="coach-avatar">RC</span>
        <div><strong>과제를 먼저 이해해요</strong><p>지문, 문제, 요구사항을 확인한 뒤 개요를 작성합니다.</p></div>
      </section>
      <h1>과제 이해하기</h1>
      <h2>{props.session.assignment.title}</h2>
      <dl className="meta-grid"><div><dt>난이도</dt><dd>{props.session.assignment.gradeLevel}</dd></div><div><dt>목표</dt><dd>{props.session.assignment.targetLength}</dd></div></dl>
      <h2>지문</h2>
      <p>{props.session.assignment.passage}</p>
      <h2>문제</h2>
      <p>{props.session.assignment.question}</p>
      <div className="stage-actions">
        <Button variant="primary" onClick={props.onNext}>이해했어요</Button>
      </div>
    </article>
  );
}
