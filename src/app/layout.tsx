import type { ReactElement } from "react";
import type { Stage } from "../shared/types.js";

const stageLabels: readonly { readonly stage: Stage; readonly label: string; readonly shortLabel: string }[] = [
  { stage: "reading", label: "과제 이해하기", shortLabel: "이해" },
  { stage: "thinking", label: "개요 작성", shortLabel: "개요" },
  { stage: "writing", label: "초안 쓰기", shortLabel: "초안" },
  { stage: "review", label: "고쳐쓰기", shortLabel: "수정" }
];

export function TopBar(props: { readonly actorName: string | undefined; readonly onHome: () => void; readonly onLogout: (() => void) | undefined; readonly onSwitchRole: (() => void) | undefined }): ReactElement {
  return (
    <header className="top-bar">
      <button className="brand-button" type="button" onClick={props.onHome} aria-label="홈">
        <span className="brand-mark">RC</span>
        <span className="brand-name">Reading Coach Lab</span>
      </button>
      <nav className="top-links" aria-label="상단 메뉴">
        <span className="actor-pill">{props.actorName === undefined ? "v1" : props.actorName}</span>
        {props.onLogout === undefined ? null : <button className="switch-role-button" type="button" onClick={props.onLogout}>로그아웃</button>}
        {props.onSwitchRole === undefined ? null : <button className="switch-role-button" type="button" onClick={props.onSwitchRole}>역할 바꾸기</button>}
      </nav>
    </header>
  );
}

export function Stepper(props: { readonly current: Stage }): ReactElement {
  const currentIndex = stageLabels.findIndex((item) => item.stage === props.current);
  return (
    <ol className="stepper" data-testid="top-stepper">
      {stageLabels.map((item, index) => (
        <li className={index <= currentIndex ? "step active" : "step"} key={item.stage}>
          <span className="step-index">{index + 1}</span>
          <span className="step-label-full">{item.label}</span>
          <span aria-hidden="true" className="step-label-short">{item.shortLabel}</span>
        </li>
      ))}
    </ol>
  );
}
