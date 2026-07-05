import type { ClipboardEvent, ReactElement } from "react";
import type { Outline } from "../shared/types.js";
import { DraftOutlineBridge } from "./draft-outline-bridge.js";
import { DraftReadinessCheck } from "./draft-readiness-check.js";
import { Button, TextArea, WarningBanner } from "./ui.js";

type StudentWritingStageProps = {
  readonly draft: string;
  readonly outline: Outline;
  readonly reviewBusy: boolean;
  readonly warning: string;
  readonly onDraft: (text: string) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  readonly onReview: () => void;
};

export function StudentWritingStage(props: StudentWritingStageProps): ReactElement {
  return (
    <article className="draft-surface">
      <h1>초안 쓰기</h1>
      {props.warning.length > 0 ? <WarningBanner>{props.warning}</WarningBanner> : null}
      <DraftOutlineBridge outline={props.outline} />
      <DraftReadinessCheck draft={props.draft} outline={props.outline} />
      <TextArea data-testid="draft-editor" className="draft-editor" value={props.draft} onChange={(event) => props.onDraft(event.currentTarget.value)} onPaste={props.onPaste} aria-label="최종 글쓰기" />
      <div className="draft-footer"><span>{props.draft.length}자</span><Button disabled={props.reviewBusy} variant="primary" onClick={props.onReview}>{props.reviewBusy ? "AI 피드백 생성 중" : "고쳐쓰기 시작"}</Button></div>
    </article>
  );
}
