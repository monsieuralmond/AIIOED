import { useEffect, useRef } from "react";
import type { FormEvent, KeyboardEvent, ReactElement, ReactNode } from "react";
import type { ChatTurn } from "../shared/types.js";
import type { UnderstandingCalibrationStage } from "../shared/research.js";
import { Button, Surface } from "./ui.js";
import { calibrationStageLabels, calibrationStageOrder, surveyResponseType } from "./understanding-calibration-data.js";
import type { LikertItem } from "./understanding-calibration-data.js";

const likertValues = [1, 2, 3, 4, 5] as const;
const likertScaleLabels = {
  high: "매우 그렇다",
  low: "전혀 아니다"
} as const;

type StageFrameProps = {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly layout?: "default" | "split";
  readonly primaryLabel: string;
  readonly sessionTitle: string;
  readonly stage: UnderstandingCalibrationStage;
  readonly subtitle?: string;
  readonly title: string;
  readonly onPrimary: () => void;
};

export function StageFrame(props: StageFrameProps): ReactElement {
  const stageIndex = calibrationStageOrder.findIndex((stage) => stage === props.stage) + 1;
  const isSplitLayout = props.layout === "split";
  return (
    <main className="student-page understanding-flow" data-stage={props.stage} data-testid="understanding-calibration-flow">
      <div className="student-session-bar">
        <strong>{props.sessionTitle}</strong>
      </div>
      <div className="student-progress-row understanding-progress-row">
        <div className="understanding-stage-title" aria-label="현재 활동">
          <span>{stageIndex} / {calibrationStageOrder.length}</span>
          <strong>{calibrationStageLabels[props.stage]}</strong>
        </div>
      </div>
      <div className={isSplitLayout ? "understanding-shell understanding-shell-split" : "understanding-shell"}>
        <Surface className={isSplitLayout ? "understanding-card understanding-card-split" : "understanding-card"}>
          <p className="support-label">{calibrationStageLabels[props.stage]}</p>
          <h1>{props.title}</h1>
          {props.subtitle === undefined ? null : <p className="understanding-lead">{props.subtitle}</p>}
          <div className="understanding-card-body">{props.children}</div>
          <footer className="understanding-actions">
            <Button disabled={props.disabled} variant="primary" onClick={props.onPrimary}>{props.primaryLabel}</Button>
          </footer>
        </Surface>
      </div>
    </main>
  );
}

type LikertGroupProps = {
  readonly items: readonly LikertItem[];
  readonly ratings: Readonly<Record<string, number>>;
  readonly onChange: (id: string, value: number) => void;
};

export function LikertGroup(props: LikertGroupProps): ReactElement {
  return (
    <div className="likert-list">
      {props.items.filter((item) => surveyResponseType(item) === "likert").map((item) => (
        <fieldset className="likert-row" key={item.id}>
          <legend>{item.label}</legend>
          {item.helper === undefined ? null : <p>{item.helper}</p>}
          <div className="likert-scale">
            <div className="likert-scale-labels" aria-hidden="true">
              <span>{likertScaleLabels.low}</span>
              <span>{likertScaleLabels.high}</span>
            </div>
            <div className="likert-options" role="radiogroup" aria-label={item.label}>
              {likertValues.map((value) => (
                <button
                  aria-label={`${item.label} ${value}점`}
                  aria-pressed={props.ratings[item.id] === value}
                  className={props.ratings[item.id] === value ? "selected" : ""}
                  key={value}
                  type="button"
                  onClick={() => props.onChange(item.id, value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </fieldset>
      ))}
    </div>
  );
}

type SurveyResponseGroupProps = {
  readonly items: readonly LikertItem[];
  readonly ratings: Readonly<Record<string, number>>;
  readonly textResponses: Readonly<Record<string, string>>;
  readonly onRatingChange: (id: string, value: number) => void;
  readonly onTextChange: (id: string, value: string) => void;
};

export function SurveyResponseGroup(props: SurveyResponseGroupProps): ReactElement {
  return (
    <div className="likert-list">
      {props.items.map((item) => {
        if (surveyResponseType(item) === "text") {
          return (
            <label className="survey-text-response" key={item.id}>
              <span>{item.label}</span>
              {item.helper === undefined ? null : <p>{item.helper}</p>}
              <textarea value={props.textResponses[item.id] ?? ""} onChange={(event) => props.onTextChange(item.id, event.currentTarget.value)} />
            </label>
          );
        }
        return (
          <fieldset className="likert-row" key={item.id}>
            <legend>{item.label}</legend>
            {item.helper === undefined ? null : <p>{item.helper}</p>}
            <div className="likert-scale">
              <div className="likert-scale-labels" aria-hidden="true">
                <span>{likertScaleLabels.low}</span>
                <span>{likertScaleLabels.high}</span>
              </div>
              <div className="likert-options" role="radiogroup" aria-label={item.label}>
                {likertValues.map((value) => (
                  <button
                    aria-label={`${item.label} ${value}점`}
                    aria-pressed={props.ratings[item.id] === value}
                    className={props.ratings[item.id] === value ? "selected" : ""}
                    key={value}
                    type="button"
                    onClick={() => props.onRatingChange(item.id, value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

type Choice = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

type ChoiceGroupProps = {
  readonly choices: readonly Choice[];
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

export function ChoiceGroup(props: ChoiceGroupProps): ReactElement {
  return (
    <fieldset className="choice-list">
      <legend>{props.label}</legend>
      {props.choices.map((choice) => (
        <label className="choice-item" key={choice.id}>
          <input checked={props.value === choice.id} name={props.label} type="radio" value={choice.id} onChange={(event) => props.onChange(event.currentTarget.value)} />
          <span><strong>{choice.label}</strong>{choice.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function ChatLog(props: { readonly turns: readonly ChatTurn[]; readonly readonlyMode?: boolean }): ReactElement {
  const listRef = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    if (props.readonlyMode === true) return;
    const list = listRef.current;
    if (list === null) return;
    list.scrollTop = list.scrollHeight;
  }, [props.readonlyMode, props.turns.length]);
  if (props.turns.length === 0) return <p className="understanding-empty">아직 대화가 없습니다.</p>;
  return (
    <ol className={props.readonlyMode === true ? "calibration-chat-log readonly" : "calibration-chat-log"} ref={listRef}>
      {props.turns.map((turn) => (
        <li className={turn.role} key={turn.id}>
          <strong>{turn.role === "student" ? "나" : "AI"}</strong>
          <p>{turn.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function ChatInput(props: { readonly disabled?: boolean; readonly value: string; readonly onChange: (value: string) => void; readonly onSubmit: () => void }): ReactElement {
  const canSubmit = props.disabled !== true && props.value.trim().length > 0;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) return;
    props.onSubmit();
  };
  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!canSubmit) return;
    props.onSubmit();
  };
  return (
    <form className="calibration-chat-input" onSubmit={submit}>
      <textarea aria-label="질문" disabled={props.disabled === true} id="calibration-chat-message" placeholder="궁금한 점을 적어보세요" value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} onKeyDown={submitOnEnter} />
      <Button disabled={!canSubmit} type="submit" variant="secondary">{props.disabled === true ? "보내는 중" : "보내기"}</Button>
    </form>
  );
}
