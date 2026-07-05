import type { ReactElement } from "react";
import type { Outline } from "../shared/types.js";

type ReadinessItem = {
  readonly help: string;
  readonly key: string;
  readonly label: string;
  readonly ready: boolean;
};

const sourceWords = ["지문", "출처", "자료"] as const;
const counterWords = ["반론", "하지만", "반면", "그렇지만"] as const;

const hasText = (value: string): boolean => value.trim().length > 0;

const cleanSourceNote = (source: string): string => source.replace(/^[-•]\s*/u, "").trim();

const sourceNotes = (outline: Outline): readonly string[] => outline.question.split(/\n|;/u).map(cleanSourceNote).filter(hasText);

const meaningfulTokens = (value: string): readonly string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const tokenAppears = (draft: string, token: string): boolean => {
  if (draft.includes(token)) return true;
  const shortened = token.length >= 3 ? token.slice(0, token.length - 1) : token;
  return shortened !== token && shortened.length >= 2 && draft.includes(shortened);
};

const mentionsValue = (draft: string, value: string): boolean => meaningfulTokens(value).some((token) => tokenAppears(draft, token));

const mentionsAny = (draft: string, values: readonly string[]): boolean => values.some((value) => mentionsValue(draft, value));

const readinessItems = (draft: string, outline: Outline): readonly ReadinessItem[] => {
  const normalizedDraft = draft.toLowerCase();
  const evidence = outline.evidence.filter(hasText);
  const sources = sourceNotes(outline);
  const claimReady = hasText(outline.claim) && mentionsValue(normalizedDraft, outline.claim);
  const evidenceReady = evidence.some((item) => mentionsValue(normalizedDraft, item));
  const sourceReady = sources.length > 0 && (mentionsAny(normalizedDraft, sources) || sourceWords.some((word) => normalizedDraft.includes(word)));
  const counterReady = hasText(outline.counterargument) && (mentionsValue(normalizedDraft, outline.counterargument) || counterWords.some((word) => normalizedDraft.includes(word)));

  return [
    { help: "중심 생각이 초안 첫머리나 핵심 문장에 보여요.", key: "claim", label: "중심 생각", ready: claimReady },
    { help: "개요의 근거가 내 문장 속에 들어갔어요.", key: "evidence", label: "근거", ready: evidenceReady },
    { help: "지문이나 자료에서 온 단서가 표시돼요.", key: "source", label: "출처 단서", ready: sourceReady },
    { help: "반대 의견을 그냥 피하지 않고 다뤄요.", key: "counter", label: "반대 의견", ready: counterReady }
  ];
};

export function DraftReadinessCheck(props: { readonly draft: string; readonly outline: Outline }): ReactElement {
  const items = readinessItems(props.draft, props.outline);
  const readyCount = items.filter((item) => item.ready).length;

  return (
    <section aria-label="초안 준비 점검" className="draft-readiness-check">
      <header className="draft-readiness-header">
        <div>
          <p className="support-label">초안 준비 점검</p>
          <h2>과제 요구가 초안에 보이나요?</h2>
        </div>
        <strong>{readyCount}/{items.length}</strong>
      </header>
      <ul className="draft-readiness-list">
        {items.map((item) => (
          <li className={`draft-readiness-item ${item.ready ? "ready" : "open"}`} key={item.key}>
            <span aria-hidden="true" className="draft-readiness-dot" />
            <div>
              <strong>{item.label}</strong>
              <p>{item.help}</p>
            </div>
            <span className="draft-readiness-status">{item.ready ? "확인됨" : "다시 보기"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
