import type { ReactElement } from "react";
import type { Outline } from "../shared/types.js";
import { Button } from "./ui.js";

type OutlineTargetId = "outline-claim" | "outline-evidence-1" | "outline-source-1" | "outline-reasoning" | "outline-counterargument";

type CoachStep = {
  readonly complete: boolean;
  readonly guidance: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly targetId: OutlineTargetId;
};

const filledEvidenceCount = (outline: Outline): number => outline.evidence.filter((item) => item.trim().length > 0).length;

const hasSourceNote = (outline: Outline): boolean => outline.question.split("\n").some((item) => item.trim().length > 1);

const outlineSteps = (outline: Outline): readonly CoachStep[] => [
  {
    complete: outline.claim.trim().length >= 10,
    guidance: "문제에 대한 내 생각을 한 문장으로 먼저 정해요.",
    label: "중심 생각부터 정해요",
    shortLabel: "주장",
    targetId: "outline-claim"
  },
  {
    complete: filledEvidenceCount(outline) >= 2,
    guidance: "지문이나 자료에서 내 주장을 도와주는 장면을 두 개 골라요.",
    label: "근거를 두 개 고르세요",
    shortLabel: "근거",
    targetId: "outline-evidence-1"
  },
  {
    complete: hasSourceNote(outline),
    guidance: "근거가 어디에서 왔는지 나중에 다시 찾을 수 있게 남겨요.",
    label: "출처를 남겨요",
    shortLabel: "출처",
    targetId: "outline-source-1"
  },
  {
    complete: outline.reasoning.trim().length >= 20,
    guidance: "근거가 왜 내 주장과 이어지는지 내 말로 설명해요.",
    label: "근거와 주장을 연결해요",
    shortLabel: "연결",
    targetId: "outline-reasoning"
  },
  {
    complete: outline.counterargument.trim().length > 0,
    guidance: "반대쪽 생각을 한 번 적어 두면 글이 더 단단해져요.",
    label: "반대 의견도 살펴봐요",
    shortLabel: "반론",
    targetId: "outline-counterargument"
  }
];

const focusOutlineTarget = (targetId: OutlineTargetId): void => {
  document.getElementById(targetId)?.focus();
};

export function ThinkingProgressCoach(props: { readonly outline: Outline }): ReactElement {
  const steps = outlineSteps(props.outline);
  const completeCount = steps.filter((step) => step.complete).length;
  const activeStep = steps.find((step) => !step.complete);
  const isReady = activeStep === undefined;
  return (
    <section aria-label="개요 진행 안내" className="thinking-progress-coach">
      <header className="thinking-progress-header">
        <div>
          <p className="support-label">생각 정리 순서</p>
          <h2>지금 할 일</h2>
        </div>
        <span className="thinking-progress-count">{completeCount}/5</span>
      </header>
      <div className="thinking-progress-steps" role="list">
        {steps.map((step) => (
          <span className={step.complete ? "thinking-progress-step complete" : "thinking-progress-step"} key={step.shortLabel} role="listitem">
            <span className="thinking-progress-dot" />
            {step.shortLabel}
          </span>
        ))}
      </div>
      <div className={isReady ? "thinking-next-action ready" : "thinking-next-action"}>
        <div>
          <strong>{activeStep?.label ?? "초안으로 옮길 준비가 되었어요"}</strong>
          <p>{activeStep?.guidance ?? "개요 점검을 눌러 빠진 부분이 없는지만 확인하세요."}</p>
        </div>
        {activeStep === undefined ? <span className="thinking-ready-label">준비 완료</span> : <Button onClick={() => focusOutlineTarget(activeStep.targetId)}>작성 위치로 이동</Button>}
      </div>
    </section>
  );
}
