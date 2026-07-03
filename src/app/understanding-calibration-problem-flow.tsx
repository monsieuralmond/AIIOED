import { useState } from "react";
import type { ReactElement } from "react";
import type { UnderstandingCalibrationStage } from "../shared/research";
import { UnderstandingCalibrationStages } from "../shared/research";
import type { PilotSession } from "../shared/types";
import { ChatLog, LikertGroup, StageFrame } from "./understanding-calibration-components";
import {
  emptyRatings,
  confidencePrompt,
  reflectionSurveyItemsForModule,
  nextProblemAfter,
  problemForConfidenceStage,
  problemForStage,
  ratingsComplete,
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
  updateRating
} from "./understanding-calibration-data";
import type { IndependentProblem } from "./understanding-calibration-data";
import { durationForProblemAnswer, startedEventForProblem } from "./understanding-calibration-problem-events";
import { appendCalibrationRecords, makeFinalReflectionCompletionUpdate } from "./understanding-calibration-session";

type FlowProps = {
  readonly problems: readonly IndependentProblem[];
  readonly session: PilotSession;
  readonly setSession: (updater: (session: PilotSession) => PilotSession) => void;
  readonly stage: UnderstandingCalibrationStage;
  readonly topic: string;
};

const confidenceValues = [1, 2, 3, 4, 5] as const;

function ProblemAnswerStage(props: FlowProps & { readonly problem: IndependentProblem }): ReactElement {
  const [answer, setAnswer] = useState("");
  const trimmed = answer.trim();

  const submitAnswer = (): void => {
    props.setSession((session) => {
      const durationMs = durationForProblemAnswer(session, props.problem);
      return appendCalibrationRecords(session, {
        artifacts: [{
          kind: props.problem.answerArtifactKind,
          payload: {
            answer: trimmed,
            durationMs,
            prompt: props.problem.prompt,
            promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
            questionNumber: props.problem.number,
            rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
            title: props.problem.title,
            topic: props.topic
          }
        }],
        events: [{
          type: "question_submitted",
          payload: {
            answerLength: trimmed.length,
            durationMs,
            promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
            questionNumber: props.problem.number,
            rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
            title: props.problem.title,
            topic: props.topic
          }
        }],
        nextStage: props.problem.confidenceStage,
        stage: props.problem.stage
      });
    });
  };

  return (
    <StageFrame
      disabled={trimmed.length === 0}
      primaryLabel="제출"
      sessionTitle={props.session.assignment.title}
      stage={props.problem.stage}
      subtitle="AI 없이 지금 떠오르는 생각을 자신의 말로 써 보세요. 제출하면 이 답은 다시 고칠 수 없습니다."
      title={props.problem.title}
      onPrimary={submitAnswer}
    >
      <article className="understanding-question-card" aria-label={`${props.problem.title} 문제`}>
        {props.problem.prompt.split("\n").map((line, index) => (line.length === 0 ? <br key={`${props.problem.number}-blank-${index}`} /> : <p key={`${props.problem.number}-${index}`}>{line}</p>))}
      </article>
      <label className="understanding-textarea">
        <span>내 답변</span>
        <textarea aria-label={`${props.problem.title} 답변`} value={answer} onChange={(event) => setAnswer(event.currentTarget.value)} />
      </label>
    </StageFrame>
  );
}

function ConfidenceStage(props: FlowProps & { readonly problem: IndependentProblem }): ReactElement {
  const [confidence, setConfidence] = useState(0);

  const submitConfidence = (): void => {
    const nextProblem = nextProblemAfter(props.problems, props.problem);
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [
          {
            type: "confidence_submitted",
            payload: {
              confidence,
              promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
              questionNumber: props.problem.number,
              rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
              title: props.problem.title,
              topic: props.topic
            }
          },
          ...(nextProblem === undefined ? [] : [startedEventForProblem(nextProblem)])
        ],
        measures: [{
          kind: props.problem.confidenceMeasureKind,
          payload: {
            confidence,
            promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
            questionNumber: props.problem.number,
            rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
            title: props.problem.title,
            topic: props.topic
          }
        }],
        nextStage: nextProblem?.stage ?? UnderstandingCalibrationStages.reflectionSurvey,
        stage: props.problem.confidenceStage
      })
    );
  };

  return (
    <StageFrame
      disabled={confidence === 0}
      primaryLabel={props.problem.number === 4 ? "활동 돌아보기" : "다음 문제"}
      sessionTitle={props.session.assignment.title}
      stage={props.problem.confidenceStage}
      subtitle="방금 제출한 답에 대해 지금 느끼는 확신 정도를 표시해 주세요."
      title={`${props.problem.title} 확신도`}
      onPrimary={submitConfidence}
    >
      <fieldset className="likert-row confidence-row">
        <legend>{confidencePrompt.label}</legend>
        <div className="likert-scale">
          <div className="likert-scale-labels confidence-scale-labels" aria-hidden="true">
            <span>{confidencePrompt.lowLabel}</span>
            <span>{confidencePrompt.highLabel}</span>
          </div>
          <div className="likert-options" role="radiogroup" aria-label="답변 확신도">
            {confidenceValues.map((value) => (
              <button aria-label={`답변 확신도 ${value}점`} aria-pressed={confidence === value} className={confidence === value ? "selected" : ""} key={value} type="button" onClick={() => setConfidence(value)}>
                {value}
              </button>
            ))}
          </div>
        </div>
      </fieldset>
    </StageFrame>
  );
}

function ReflectionSurveyStage(props: FlowProps): ReactElement {
  const reflectionItems = reflectionSurveyItemsForModule(props.session.modules.understandingCalibration);
  const [ratings, setRatings] = useState(() => emptyRatings(reflectionItems));

  const submitReflection = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [{ type: "reflection_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, questionNumber: 0, reflectionKind: "survey", ratings, topic: props.topic } }],
        measures: [{ kind: "reflection_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings, topic: props.topic } }],
        nextStage: UnderstandingCalibrationStages.chatReview,
        stage: UnderstandingCalibrationStages.reflectionSurvey
      })
    );
  };

  return (
    <StageFrame
      disabled={!ratingsComplete(reflectionItems, ratings)}
      primaryLabel="대화 다시 보기"
      sessionTitle={props.session.assignment.title}
      stage={UnderstandingCalibrationStages.reflectionSurvey}
      subtitle="방금 활동을 하며 느낀 점을 표시해 주세요."
      title="활동 돌아보기"
      onPrimary={submitReflection}
    >
      <LikertGroup items={reflectionItems} ratings={ratings} onChange={(id, value) => setRatings((current) => updateRating(current, id, value))} />
    </StageFrame>
  );
}

function ChatReviewStage(props: FlowProps): ReactElement {
  const moveToFinalReflection = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [{ type: "calibration_chat_review_submitted", payload: { totalTurns: session.chatTurns.length, topic: props.topic } }],
        nextStage: UnderstandingCalibrationStages.finalReflection,
        stage: UnderstandingCalibrationStages.chatReview
      })
    );
  };

  return (
    <StageFrame
      primaryLabel="마무리 생각 쓰기"
      sessionTitle={props.session.assignment.title}
      stage={UnderstandingCalibrationStages.chatReview}
      subtitle="처음에 AI와 나누었던 대화를 다시 살펴보세요."
      title={props.topic}
      onPrimary={moveToFinalReflection}
    >
      <ChatLog readonlyMode turns={props.session.chatTurns} />
    </StageFrame>
  );
}

function FinalReflectionStage(props: FlowProps): ReactElement {
  const [finalReflection, setFinalReflection] = useState("");
  const trimmed = finalReflection.trim();

  const complete = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, makeFinalReflectionCompletionUpdate({
        completedAt: new Date().toISOString(),
        finalReflection: trimmed,
        topic: props.topic
      }))
    );
  };

  return (
    <StageFrame
      disabled={trimmed.length === 0}
      primaryLabel="완료"
      sessionTitle={props.session.assignment.title}
      stage={UnderstandingCalibrationStages.finalReflection}
      subtitle="오늘 활동을 마치며 다음에 더 확인하고 싶은 부분을 써 주세요."
      title={props.topic}
      onPrimary={complete}
    >
      <label className="understanding-textarea">
        <span>마무리 생각</span>
        <textarea value={finalReflection} onChange={(event) => setFinalReflection(event.currentTarget.value)} />
      </label>
    </StageFrame>
  );
}

export function UnderstandingCalibrationProblemFlow(props: FlowProps): ReactElement | null {
  const problem = problemForStage(props.problems, props.stage);
  if (problem !== undefined) return <ProblemAnswerStage {...props} problem={problem} />;
  const confidenceProblem = problemForConfidenceStage(props.problems, props.stage);
  if (confidenceProblem !== undefined) return <ConfidenceStage {...props} problem={confidenceProblem} />;
  if (props.stage === UnderstandingCalibrationStages.reflectionSurvey) return <ReflectionSurveyStage {...props} />;
  if (props.stage === UnderstandingCalibrationStages.chatReview) return <ChatReviewStage {...props} />;
  if (props.stage === UnderstandingCalibrationStages.finalReflection) return <FinalReflectionStage {...props} />;
  return null;
}
