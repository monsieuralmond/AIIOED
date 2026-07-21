import { useState } from "react";
import type { ReactElement } from "react";
import type { UnderstandingCalibrationStage } from "../shared/research.js";
import { UnderstandingCalibrationStages } from "../shared/research.js";
import type { PilotSession } from "../shared/types.js";
import { ChatLog, IrreversibleTransitionDialog, StageFrame, SurveyResponseGroup } from "./understanding-calibration-components.js";
import {
  emptyRatings,
  emptyTextResponses,
  confidenceValueFromPostSurvey,
  finalReflectionSurveyItemsForModule,
  reflectionSurveyItemsForModule,
  nextProblemAfter,
  problemForConfidenceStage,
  problemForStage,
  surveyItemsForTopic,
  surveyResponsesComplete,
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
  updateRating,
  updateTextResponse
} from "./understanding-calibration-data.js";
import type { IndependentProblem } from "./understanding-calibration-data.js";
import { durationForProblemAnswer, startedEventForProblem } from "./understanding-calibration-problem-events.js";
import { appendCalibrationEventsOnly, appendCalibrationRecords, makeFinalReflectionCompletionUpdate } from "./understanding-calibration-session.js";

type FlowProps = {
  readonly problems: readonly IndependentProblem[];
  readonly session: PilotSession;
  readonly setSession: (updater: (session: PilotSession) => PilotSession) => void;
  readonly stage: UnderstandingCalibrationStage;
  readonly topic: string;
};

type PendingTransition = {
  readonly actionKey: string;
  readonly confirmLabel?: string;
  readonly message: string;
  readonly stage: UnderstandingCalibrationStage;
  readonly title?: string;
};

type IrreversibleTransitionEventType =
  | "irreversible_transition_cancelled"
  | "irreversible_transition_confirmed"
  | "irreversible_transition_prompt_shown";

const recordIrreversibleTransitionEvent = (
  setSession: FlowProps["setSession"],
  transition: PendingTransition,
  type: IrreversibleTransitionEventType
): void => {
  setSession((session) =>
    appendCalibrationEventsOnly(session, {
      events: [{
        type,
        payload: {
          actionKey: transition.actionKey,
          fromStage: transition.stage,
          message: transition.message,
          title: transition.title ?? "다음으로 넘어갈까요?"
        }
      }],
      stage: transition.stage
    })
  );
};

const startedAtForProblem = (session: PilotSession, problem: IndependentProblem): string => {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event?.type === "question_started" && event.payload["questionNumber"] === problem.number) return event.timestamp;
  }
  return "";
};

function ProblemAnswerStage(props: FlowProps & { readonly problem: IndependentProblem }): ReactElement {
  const [answer, setAnswer] = useState("");
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const trimmed = answer.trim();

  const submitAnswer = (): void => {
    const submittedAt = new Date().toISOString();
    props.setSession((session) => {
      const durationMs = durationForProblemAnswer(session, props.problem);
      return appendCalibrationRecords(session, {
        artifacts: [{
          kind: props.problem.answerArtifactKind,
          payload: {
            answer: trimmed,
            answerLength: trimmed.length,
            durationMs,
            problemKey: props.problem.answerArtifactKind,
            prompt: props.problem.prompt,
            promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
            questionNumber: props.problem.number,
            rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
            startedAt: startedAtForProblem(session, props.problem),
            submittedAt,
            title: props.problem.title,
            topic: props.topic,
            topicId: props.topic
          }
        }],
        events: [
          {
            type: "question_submitted",
            payload: {
              answerLength: trimmed.length,
              durationMs,
              problemKey: props.problem.answerArtifactKind,
              prompt: props.problem.prompt,
              promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
              questionNumber: props.problem.number,
              rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
              submittedAt,
              title: props.problem.title,
              topic: props.topic,
              topicId: props.topic
            }
          },
          {
            type: "confidence_started",
            stage: props.problem.confidenceStage,
            payload: {
              problemKey: props.problem.answerArtifactKind,
              promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
              questionNumber: props.problem.number,
              title: props.problem.title,
              topic: props.topic,
              topicId: props.topic
            }
          }
        ],
        nextStage: props.problem.confidenceStage,
        stage: props.problem.stage
      });
    });
  };

  const requestSubmitAnswer = (): void => {
    const transition: PendingTransition = {
      actionKey: `submit_problem_${props.problem.number}`,
      confirmLabel: "제출할래요",
      message: "제출하면 이 답은 다시 볼 수도, 고칠 수도 없습니다. 지금 답을 제출할까요?",
      stage: props.problem.stage,
      title: "답을 제출할까요?"
    };
    recordIrreversibleTransitionEvent(props.setSession, transition, "irreversible_transition_prompt_shown");
    setPendingTransition(transition);
  };

  const cancelSubmitAnswer = (): void => {
    if (pendingTransition !== null) recordIrreversibleTransitionEvent(props.setSession, pendingTransition, "irreversible_transition_cancelled");
    setPendingTransition(null);
  };

  const confirmSubmitAnswer = (): void => {
    const transition = pendingTransition;
    if (transition === null) return;
    recordIrreversibleTransitionEvent(props.setSession, transition, "irreversible_transition_confirmed");
    setPendingTransition(null);
    submitAnswer();
  };

  return (
    <StageFrame
      disabled={trimmed.length === 0}
      primaryLabel="제출"
      sessionTitle={props.session.assignment.title}
      stage={props.problem.stage}
      subtitle="AI 없이 지금 떠오르는 생각을 자신의 말로 써 보세요. 제출하면 이 답은 다시 고칠 수 없습니다."
      title={`문제 ${props.problem.number} / ${props.problems.length}`}
      onPrimary={requestSubmitAnswer}
    >
      <article className="understanding-question-card" aria-label={`${props.problem.title} 문제`}>
        <h2>{props.problem.title}</h2>
        {props.problem.prompt.split("\n").map((line, index) => (line.length === 0 ? <br key={`${props.problem.number}-blank-${index}`} /> : <p key={`${props.problem.number}-${index}`}>{line}</p>))}
      </article>
      <label className="understanding-textarea">
        <span>내 답변</span>
        <textarea aria-label={`${props.problem.title} 답변`} value={answer} onChange={(event) => setAnswer(event.currentTarget.value)} />
      </label>
      {pendingTransition === null ? null : (
        <IrreversibleTransitionDialog
          confirmLabel={pendingTransition.confirmLabel}
          message={pendingTransition.message}
          title={pendingTransition.title}
          onCancel={cancelSubmitAnswer}
          onConfirm={confirmSubmitAnswer}
        />
      )}
    </StageFrame>
  );
}

function ConfidenceStage(props: FlowProps & { readonly problem: IndependentProblem }): ReactElement {
  const postSurveyItems = surveyItemsForTopic(props.problem.postSurveyItems, props.topic);
  const [ratings, setRatings] = useState(() => emptyRatings(postSurveyItems));
  const [textResponses, setTextResponses] = useState(() => emptyTextResponses(postSurveyItems));
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);

  const submitConfidence = (): void => {
    const nextProblem = nextProblemAfter(props.problems, props.problem);
    const submittedAt = new Date().toISOString();
    const confidence = confidenceValueFromPostSurvey(postSurveyItems, ratings);
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [
          {
            type: "confidence_submitted",
            payload: {
              confidence,
              problemKey: props.problem.answerArtifactKind,
              promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
              questionNumber: props.problem.number,
              ratings,
              rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
              submittedAt,
              surveyItems: postSurveyItems,
              textResponses,
              title: props.problem.title,
              topic: props.topic,
              topicId: props.topic
            }
          },
          ...(nextProblem === undefined
            ? [{
              type: "reflection_started" as const,
              stage: UnderstandingCalibrationStages.reflectionSurvey,
              payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, questionNumber: props.problem.number, topic: props.topic, topicId: props.topic }
            }]
            : [startedEventForProblem(nextProblem)])
        ],
        measures: [{
          kind: props.problem.confidenceMeasureKind,
          payload: {
            confidence,
            problemKey: props.problem.answerArtifactKind,
            promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
            questionNumber: props.problem.number,
            ratings,
            rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
            submittedAt,
            surveyItems: postSurveyItems,
            textResponses,
            title: props.problem.title,
            topic: props.topic,
            topicId: props.topic
          }
        }],
        nextStage: nextProblem?.stage ?? UnderstandingCalibrationStages.reflectionSurvey,
        stage: props.problem.confidenceStage
      })
    );
  };

  const requestSubmitConfidence = (): void => {
    const transition: PendingTransition = {
      actionKey: `submit_problem_${props.problem.number}_confidence`,
      message: "제출하면 방금 답에 대한 확인 내용을 다시 고칠 수 없습니다. 다음으로 넘어갈까요?",
      stage: props.problem.confidenceStage,
      title: "확인 내용을 제출할까요?"
    };
    recordIrreversibleTransitionEvent(props.setSession, transition, "irreversible_transition_prompt_shown");
    setPendingTransition(transition);
  };

  const cancelSubmitConfidence = (): void => {
    if (pendingTransition !== null) recordIrreversibleTransitionEvent(props.setSession, pendingTransition, "irreversible_transition_cancelled");
    setPendingTransition(null);
  };

  const confirmSubmitConfidence = (): void => {
    const transition = pendingTransition;
    if (transition === null) return;
    recordIrreversibleTransitionEvent(props.setSession, transition, "irreversible_transition_confirmed");
    setPendingTransition(null);
    submitConfidence();
  };

  return (
    <StageFrame
      disabled={!surveyResponsesComplete(postSurveyItems, ratings, textResponses)}
      primaryLabel={props.problem.number === 4 ? "활동 돌아보기" : "다음 문제"}
      sessionTitle={props.session.assignment.title}
      stage={props.problem.confidenceStage}
      subtitle="방금 제출한 답에 대해 지금 느끼는 생각을 표시해 주세요."
      title={`문제 ${props.problem.number} / ${props.problems.length} 직후 확인`}
      onPrimary={requestSubmitConfidence}
    >
      <SurveyResponseGroup
        items={postSurveyItems}
        ratings={ratings}
        textResponses={textResponses}
        onRatingChange={(id, value) => setRatings((current) => updateRating(current, id, value))}
        onTextChange={(id, value) => setTextResponses((current) => updateTextResponse(current, id, value))}
      />
      {pendingTransition === null ? null : (
        <IrreversibleTransitionDialog
          confirmLabel={pendingTransition.confirmLabel}
          message={pendingTransition.message}
          title={pendingTransition.title}
          onCancel={cancelSubmitConfidence}
          onConfirm={confirmSubmitConfidence}
        />
      )}
    </StageFrame>
  );
}

function ReflectionSurveyStage(props: FlowProps): ReactElement {
  const reflectionItems = reflectionSurveyItemsForModule(props.session.modules.understandingCalibration);
  const [ratings, setRatings] = useState(() => emptyRatings(reflectionItems));
  const [textResponses, setTextResponses] = useState(() => emptyTextResponses(reflectionItems));

  const submitReflection = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [{ kind: "reflection_survey_text_responses", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, textResponses, topic: props.topic } }],
        events: [
          { type: "reflection_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, questionNumber: 0, reflectionKind: "survey", ratings, textResponses, topic: props.topic, topicId: props.topic } },
          { type: "chat_review_started", stage: UnderstandingCalibrationStages.chatReview, payload: { questionNumber: 0, totalTurns: session.chatTurns.length, topic: props.topic, topicId: props.topic } }
        ],
        measures: [{ kind: "reflection_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings, textResponses, topic: props.topic } }],
        nextStage: UnderstandingCalibrationStages.chatReview,
        stage: UnderstandingCalibrationStages.reflectionSurvey
      })
    );
  };

  return (
    <StageFrame
      disabled={!surveyResponsesComplete(reflectionItems, ratings, textResponses)}
      primaryLabel="대화 다시 보기"
      sessionTitle={props.session.assignment.title}
      stage={UnderstandingCalibrationStages.reflectionSurvey}
      subtitle="방금 활동을 하며 느낀 점을 표시해 주세요."
      title="활동 돌아보기"
      onPrimary={submitReflection}
    >
      <SurveyResponseGroup
        items={reflectionItems}
        ratings={ratings}
        textResponses={textResponses}
        onRatingChange={(id, value) => setRatings((current) => updateRating(current, id, value))}
        onTextChange={(id, value) => setTextResponses((current) => updateTextResponse(current, id, value))}
      />
    </StageFrame>
  );
}

function ChatReviewStage(props: FlowProps): ReactElement {
  const moveToFinalReflection = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [
          { type: "chat_review_submitted", payload: { questionNumber: 0, totalTurns: session.chatTurns.length, topic: props.topic, topicId: props.topic } },
          { type: "calibration_chat_review_submitted", payload: { questionNumber: 0, totalTurns: session.chatTurns.length, topic: props.topic, topicId: props.topic } }
        ],
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
  const finalReflectionItems = finalReflectionSurveyItemsForModule(props.session.modules.understandingCalibration);
  const [ratings, setRatings] = useState(() => emptyRatings(finalReflectionItems));
  const [textResponses, setTextResponses] = useState(() => emptyTextResponses(finalReflectionItems));
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);

  const complete = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, makeFinalReflectionCompletionUpdate({
        completedAt: new Date().toISOString(),
        ratings,
        textResponses,
        topic: props.topic
      }))
    );
  };

  const requestComplete = (): void => {
    const transition: PendingTransition = {
      actionKey: "complete_understanding_calibration",
      confirmLabel: "완료할래요",
      message: "완료하면 이 활동은 제출된 상태로 저장됩니다. 마지막 생각을 모두 남겼나요?",
      stage: UnderstandingCalibrationStages.finalReflection,
      title: "활동을 완료할까요?"
    };
    recordIrreversibleTransitionEvent(props.setSession, transition, "irreversible_transition_prompt_shown");
    setPendingTransition(transition);
  };

  const cancelComplete = (): void => {
    if (pendingTransition !== null) recordIrreversibleTransitionEvent(props.setSession, pendingTransition, "irreversible_transition_cancelled");
    setPendingTransition(null);
  };

  const confirmComplete = (): void => {
    const transition = pendingTransition;
    if (transition === null) return;
    recordIrreversibleTransitionEvent(props.setSession, transition, "irreversible_transition_confirmed");
    setPendingTransition(null);
    complete();
  };

  return (
    <StageFrame
      disabled={!surveyResponsesComplete(finalReflectionItems, ratings, textResponses)}
      primaryLabel="완료"
      sessionTitle={props.session.assignment.title}
      stage={UnderstandingCalibrationStages.finalReflection}
      subtitle="다시 본 대화를 바탕으로 마지막 생각을 남겨 주세요."
      title={props.topic}
      onPrimary={requestComplete}
    >
      <SurveyResponseGroup
        items={finalReflectionItems}
        ratings={ratings}
        textResponses={textResponses}
        onRatingChange={(id, value) => setRatings((current) => updateRating(current, id, value))}
        onTextChange={(id, value) => setTextResponses((current) => updateTextResponse(current, id, value))}
      />
      {pendingTransition === null ? null : (
        <IrreversibleTransitionDialog
          confirmLabel={pendingTransition.confirmLabel}
          message={pendingTransition.message}
          title={pendingTransition.title}
          onCancel={cancelComplete}
          onConfirm={confirmComplete}
        />
      )}
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
