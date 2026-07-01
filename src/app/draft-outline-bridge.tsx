import type { ReactElement } from "react";
import type { Outline } from "../shared/types";

const hasText = (value: string): boolean => value.trim().length > 0;

const cleanSourceNote = (source: string): string => source.replace(/^[-•]\s*/u, "").trim();

const sourceNotes = (outline: Outline): readonly string[] => outline.question.split(/\n|;/u).map(cleanSourceNote).filter(hasText);

const firstEvidenceItems = (outline: Outline): readonly string[] => outline.evidence.filter(hasText).slice(0, 2);

export function DraftOutlineBridge(props: { readonly outline: Outline }): ReactElement {
  const evidence = firstEvidenceItems(props.outline);
  const sources = sourceNotes(props.outline);
  return (
    <section aria-label="초안 작성용 개요" className="draft-outline-bridge">
      <header className="draft-outline-bridge-header">
        <div>
          <p className="support-label">내 개요</p>
          <h2>초안에 넣을 생각</h2>
        </div>
        <p>그대로 옮기기보다 내 말로 풀어써요.</p>
      </header>
      <dl className="draft-outline-grid">
        <div>
          <dt>중심 생각</dt>
          <dd>{props.outline.claim}</dd>
        </div>
        <div>
          <dt>근거</dt>
          <dd>{evidence.length === 0 ? "아직 없음" : evidence.join(" / ")}</dd>
        </div>
        <div>
          <dt>출처</dt>
          <dd>{sources.length === 0 ? "아직 없음" : sources.join(" / ")}</dd>
        </div>
        <div>
          <dt>반대 의견</dt>
          <dd>{props.outline.counterargument}</dd>
        </div>
      </dl>
    </section>
  );
}
