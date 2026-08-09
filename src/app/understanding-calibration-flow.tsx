import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { requestSessionCalibrationChat } from "../session/research-api-client.js";
import { loadBrowserSessionIdentity } from "../session/browser-session.js";
import { UnderstandingCalibrationStages } from "../shared/research.js";
import type { UnderstandingCalibrationStage } from "../shared/research.js";
import type { CalibrationChatRequest } from "../shared/calibration-ai.js";
import type { PilotSession } from "../shared/types.js";
import { updateSessionLlmMetadata } from "../session/session.js";
import { Button, WarningBanner } from "./ui.js";
import { ChatInput, ChatLog, IrreversibleTransitionDialog, StageFrame, SurveyResponseGroup } from "./understanding-calibration-components.js";
import { chatCompletedPayload, durationSince, lastEventTimestamp } from "./understanding-calibration-events.js";
import {
  emptyRatings,
  emptyTextResponses,
  independentProblemsForModule,
  isCalibrationStage,
  predictionSurveyItemsForModule,
  preSurveyItemsForModule,
  surveyResponsesComplete,
  surveyItemsForTopic,
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
  updateRating,
  updateTextResponse
} from "./understanding-calibration-data.js";
import { startedEventForProblem } from "./understanding-calibration-problem-events.js";
import { UnderstandingCalibrationProblemFlow } from "./understanding-calibration-problem-flow.js";
import { appendCalibrationEventsOnly, appendCalibrationRecords, makeCalibrationChatTurn } from "./understanding-calibration-session.js";
import { UnderstandingCalibrationCompletedStage } from "./understanding-calibration-completed-stage.js";

type FailedChatRequest = {
  readonly message: string;
  readonly previewRequest?: CalibrationChatRequest;
  readonly requestId: string;
};

type PendingTransition = {
  readonly actionKey: string;
  readonly cancelLabel?: string;
  readonly confirmLabel?: string;
  readonly message: string;
  readonly stage: UnderstandingCalibrationStage;
  readonly title?: string;
  readonly onConfirm: () => void;
};

export function UnderstandingCalibrationFlow(props: { readonly session: PilotSession; readonly setSession: (updater: (session: PilotSession) => PilotSession) => void }): ReactElement {
  const module = props.session.modules.understandingCalibration;
  const topic = module?.topic ?? props.session.assignment.title;
  const passage = module?.sourceText ?? props.session.assignment.passage;
  const stage = isCalibrationStage(props.session.currentStage) ? props.session.currentStage : UnderstandingCalibrationStages.preSurvey;
  const preSurveyItems = preSurveyItemsForModule(module);
  const predictionSurveyItems = predictionSurveyItemsForModule(module);
  const independentProblems = independentProblemsForModule(module);
  const preSurveyItemsForTopic = surveyItemsForTopic(preSurveyItems, topic);
  const predictionSurveyItemsForTopic = surveyItemsForTopic(predictionSurveyItems, topic);

  const [preRatings, setPreRatings] = useState(() => emptyRatings(preSurveyItems));
  const [preTextResponses, setPreTextResponses] = useState(() => emptyTextResponses(preSurveyItems));
  const [chatInput, setChatInput] = useState("");
  const [predictionRatings, setPredictionRatings] = useState(() => emptyRatings(predictionSurveyItems));
  const [predictionTextResponses, setPredictionTextResponses] = useState(() => emptyTextResponses(predictionSurveyItems));
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [failedChatRequest, setFailedChatRequest] = useState<FailedChatRequest | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const chatTurnsRef = useRef(props.session.chatTurns);

  useEffect(() => {
    chatTurnsRef.current = props.session.chatTurns;
  }, [props.session.chatTurns]);

  const previewChatRequest = (message: string): CalibrationChatRequest | undefined => {
    const identity = loadBrowserSessionIdentity();
    if (identity?.sessionId === props.session.sessionId) return undefined;
    return {
      ...(module?.aiContext === undefined ? {} : { aiContext: module.aiContext }),
      history: chatTurnsRef.current.map((turn) => ({ role: turn.role, text: turn.text })),
      message,
      passage,
      researchCondition: props.session.researchCondition,
      topic
    };
  };

  const recordTransitionEvent = (type: "irreversible_transition_cancelled" | "irreversible_transition_confirmed" | "irreversible_transition_prompt_shown", transition: PendingTransition): void => {
    props.setSession((session) =>
      appendCalibrationEventsOnly(session, {
        events: [
          {
            type,
            payload: {
              actionKey: transition.actionKey,
              fromStage: transition.stage,
              message: transition.message,
              title: transition.title ?? "다음으로 넘어갈까요?"
            }
          },
          ...(transition.actionKey === "start_closed_book_evaluation"
            ? [{
                type: type === "irreversible_transition_prompt_shown"
                  ? "evaluation_gate_opened" as const
                  : type === "irreversible_transition_cancelled"
                    ? "evaluation_gate_cancelled" as const
                    : "evaluation_gate_confirmed" as const,
                payload: {
                  actionKey: transition.actionKey,
                  fromStage: transition.stage,
                  topic
                }
              }]
            : [])
        ],
        stage: transition.stage
      })
    );
  };

  const requestTransition = (transition: PendingTransition): void => {
    recordTransitionEvent("irreversible_transition_prompt_shown", transition);
    setPendingTransition(transition);
  };

  const cancelTransition = (): void => {
    if (pendingTransition !== null) recordTransitionEvent("irreversible_transition_cancelled", pendingTransition);
    setPendingTransition(null);
  };

  const confirmTransition = (): void => {
    const transition = pendingTransition;
    if (transition === null) return;
    recordTransitionEvent("irreversible_transition_confirmed", transition);
    setPendingTransition(null);
    transition.onConfirm();
  };

  const savePreSurvey = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [{ kind: "pre_survey_text_responses", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, textResponses: preTextResponses, topic } }],
        events: [
          { type: "calibration_pre_survey_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: preRatings, textResponses: preTextResponses, topic } },
          { type: "calibration_guide_started", payload: { topic } }
        ],
        measures: [{ kind: "pre_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: preRatings, textResponses: preTextResponses, topic } }],
        nextStage: UnderstandingCalibrationStages.guide,
        stage: UnderstandingCalibrationStages.preSurvey
      })
    );
  };

  const completeGuide = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [{ type: "calibration_reading_started", payload: { topic } }],
        nextStage: UnderstandingCalibrationStages.reading,
        stage: UnderstandingCalibrationStages.guide
      })
    );
  };

  const completeReading = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [
          { type: "calibration_reading_completed", payload: { durationMs: durationSince(lastEventTimestamp(session, "calibration_reading_started")), passageLength: passage.length, topic } },
          { type: "calibration_chat_started", payload: { topic } }
        ],
        nextStage: UnderstandingCalibrationStages.chat,
        stage: UnderstandingCalibrationStages.reading
      })
    );
  };

  const requestAssistantResponse = async (chatRequest: FailedChatRequest): Promise<void> => {
    setChatPending(true);
    setChatError("");
    try {
      const response = await requestSessionCalibrationChat({
        message: chatRequest.message,
        ...(chatRequest.previewRequest === undefined ? {} : { previewRequest: chatRequest.previewRequest }),
        requestId: chatRequest.requestId,
        sessionId: props.session.sessionId
      });
      const assistantTurn = makeCalibrationChatTurn("assistant", response.text, response.type);
      chatTurnsRef.current = [...chatTurnsRef.current, assistantTurn];
      props.setSession((session) => {
        const nextSession = appendCalibrationRecords(session, {
          chatTurns: [assistantTurn],
          events: [
            { type: "assistant_message", payload: { responseType: response.type, text: response.text } },
            {
              type: "calibration_chat_turn_created",
              payload: {
                aiMode: response.llmMode ?? session.metadata.llmMode,
                assistantMessage: response.text,
                assistantMessageLength: response.text.length,
                assistantTurnId: assistantTurn.id,
                model: response.model ?? session.metadata.model,
                requestTags: response.requestTags,
                studentTurnId: chatRequest.requestId,
                userMessage: chatRequest.message,
                userMessageLength: chatRequest.message.length
              }
            }
          ],
          stage: UnderstandingCalibrationStages.chat
        });
        return response.llmMode === undefined || response.model === undefined ? nextSession : updateSessionLlmMetadata(nextSession, response.llmMode, response.model);
      });
      setFailedChatRequest(null);
    } catch (error) {
      const messageForStudent = error instanceof Error && error.message.trim().length > 0
        ? `AI 응답을 받지 못했습니다. 잠시 후 다시 보내 주세요. (${error.message})`
        : "AI 응답을 받지 못했습니다. 잠시 후 다시 보내 주세요.";
      setChatError(messageForStudent);
      setFailedChatRequest(chatRequest);
    } finally {
      setChatPending(false);
    }
  };

  const sendChat = async (): Promise<void> => {
    const message = chatInput.trim();
    if (message.length === 0 || chatPending) return;
    const studentTurn = makeCalibrationChatTurn("student", message);
    setChatInput("");
    const previewRequest = previewChatRequest(message);
    setFailedChatRequest(null);
    chatTurnsRef.current = [...chatTurnsRef.current, studentTurn];
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        chatTurns: [studentTurn],
        events: [{ type: "student_message", payload: { text: message } }],
        stage: UnderstandingCalibrationStages.chat
      })
    );
    await requestAssistantResponse({
      message,
      ...(previewRequest === undefined ? {} : { previewRequest }),
      requestId: studentTurn.id
    });
  };

  const completeChat = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [
          { type: "calibration_chat_completed", payload: chatCompletedPayload(session, topic) },
          { type: "evaluation_started", payload: { topic } },
          { type: "passage_locked", payload: { topic } },
          { type: "chat_locked", payload: { chatTurnCount: session.chatTurns.length, topic } }
        ],
        nextStage: UnderstandingCalibrationStages.predictionSurvey,
        stage: UnderstandingCalibrationStages.chat
      })
    );
  };

  const savePrediction = (): void => {
    const firstProblem = independentProblems[0];
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [{ kind: "prediction_survey_text_responses", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, textResponses: predictionTextResponses, topic } }],
        events: [
          { type: "calibration_prediction_survey_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: predictionRatings, textResponses: predictionTextResponses, topic } },
          { type: "pre_evaluation_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: predictionRatings, textResponses: predictionTextResponses, topic } },
          ...(firstProblem === undefined ? [] : [startedEventForProblem(firstProblem)])
        ],
        measures: [{ kind: "pre_evaluation_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: predictionRatings, rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION, textResponses: predictionTextResponses, topic } }],
        nextStage: firstProblem?.stage ?? UnderstandingCalibrationStages.reflectionSurvey,
        stage: UnderstandingCalibrationStages.predictionSurvey
      })
    );
  };

  if (stage === UnderstandingCalibrationStages.preSurvey) {
    return (
      <StageFrame disabled={!surveyResponsesComplete(preSurveyItems, preRatings, preTextResponses)} primaryLabel="안내 보기" sessionTitle={props.session.assignment.title} stage={stage} subtitle={`${topic}에 대해 지금 떠오르는 생각을 먼저 남깁니다.`} title="시작 전 확인" onPrimary={savePreSurvey}>
        <SurveyResponseGroup
          items={preSurveyItemsForTopic}
          ratings={preRatings}
          textResponses={preTextResponses}
          onRatingChange={(id, value) => setPreRatings((ratings) => updateRating(ratings, id, value))}
          onTextChange={(id, value) => setPreTextResponses((responses) => updateTextResponse(responses, id, value))}
        />
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.guide) {
    return (
      <StageFrame primaryLabel="지문 읽기" sessionTitle={props.session.assignment.title} stage={stage} subtitle="활동 방식과 평가 조건을 먼저 확인합니다." title="활동 안내" onPrimary={completeGuide}>
        <article className="understanding-question-card">
          <p>지금부터 제시되는 글을 읽고 AI와 자유롭게 대화하며 학습하게 됩니다.</p>
          <p>이후에는 AI와의 대화를 바탕으로 새로운 문제를 해결하는 평가가 진행됩니다.</p>
          <p>평가 문항은 미리 공개되지 않습니다.</p>
          <p>지문의 문장을 그대로 기억하는 것보다 내용을 충분히 이해하는 것이 중요합니다.</p>
          <p>필요한 만큼 AI와 자유롭게 대화한 후 스스로 준비되었다고 판단되면 평가를 시작하세요.</p>
        </article>
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.reading) {
    return (
      <StageFrame primaryLabel="AI에게 질문하기" sessionTitle={props.session.assignment.title} stage={stage} subtitle="천천히 읽고 중요한 내용을 이해해 보세요. 평가가 시작되면 지문을 다시 볼 수 없습니다." title={props.session.assignment.title} onPrimary={completeReading}>
        <article className="understanding-passage"><h2>지문</h2><p>{passage}</p></article>
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.chat) {
    const hasAssistantResponse = props.session.chatTurns.some((turn) => turn.role === "assistant");
    return (
      <StageFrame disabled={chatPending || !hasAssistantResponse} layout="split" primaryLabel="평가 시작" sessionTitle={props.session.assignment.title} stage={stage} subtitle="글을 읽고 더 확인하고 싶은 내용이 있으면 AI에게 자유롭게 질문해 보세요. 준비가 되면 평가를 시작하세요." title={topic} onPrimary={() => requestTransition({
        actionKey: "start_closed_book_evaluation",
        cancelLabel: "계속 학습하기",
        confirmLabel: "평가 시작하기",
        message: "학습을 종료하고 평가를 시작하시겠습니까?\n\n이후에는 AI와 더 이상 대화할 수 없습니다.\n\n평가는 AI와의 대화를 통해 이해한 내용을 바탕으로 진행됩니다.\n\n아직 더 학습이 필요하다면 AI와 계속 대화할 수 있습니다.",
        stage,
        title: "평가를 시작할까요?",
        onConfirm: completeChat
      })}>
        <div className="calibration-study-layout">
          <article className="understanding-passage calibration-study-passage"><h2>지문</h2><p>{passage}</p></article>
          <section aria-label="AI와 대화" className="calibration-chat-panel">
            <header>
              <span>AI에게 질문하기</span>
              <h2>궁금한 점을 물어보세요</h2>
            </header>
            <ChatLog turns={props.session.chatTurns} />
            {chatError.length > 0 ? <WarningBanner>{chatError}</WarningBanner> : null}
            {failedChatRequest === null ? null : (
              <div className="calibration-chat-retry">
                <p>방금 질문은 남겨두었습니다. 연결이 회복되면 같은 질문을 다시 보낼 수 있습니다.</p>
                <Button disabled={chatPending} type="button" variant="secondary" onClick={() => { void requestAssistantResponse(failedChatRequest); }}>
                  {chatPending ? "다시 보내는 중" : "같은 질문 다시 보내기"}
                </Button>
              </div>
            )}
            <ChatInput disabled={chatPending} value={chatInput} onChange={setChatInput} onSubmit={() => { void sendChat(); }} />
          </section>
        </div>
        {pendingTransition === null ? null : (
          <IrreversibleTransitionDialog
            cancelLabel={pendingTransition.cancelLabel}
            confirmLabel={pendingTransition.confirmLabel}
            message={pendingTransition.message}
            title={pendingTransition.title}
            onCancel={cancelTransition}
            onConfirm={confirmTransition}
          />
        )}
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.predictionSurvey) {
    return (
      <StageFrame disabled={!surveyResponsesComplete(predictionSurveyItems, predictionRatings, predictionTextResponses)} primaryLabel="문제 시작" sessionTitle={props.session.assignment.title} stage={stage} subtitle="이제 지문과 AI 대화 없이 문제를 풉니다. 시작 전에 현재 판단을 남겨 주세요." title="평가 직전 확인" onPrimary={() => requestTransition({
        actionKey: "start_independent_problems",
        message: "문제를 시작하면 지문, AI 대화, 이전 화면으로 돌아갈 수 없습니다. 지금 판단을 모두 표시했나요?",
        stage,
        onConfirm: savePrediction
      })}>
        <SurveyResponseGroup
          items={predictionSurveyItemsForTopic}
          ratings={predictionRatings}
          textResponses={predictionTextResponses}
          onRatingChange={(id, value) => setPredictionRatings((ratings) => updateRating(ratings, id, value))}
          onTextChange={(id, value) => setPredictionTextResponses((responses) => updateTextResponse(responses, id, value))}
        />
        {pendingTransition === null ? null : (
          <IrreversibleTransitionDialog
            cancelLabel={pendingTransition.cancelLabel}
            confirmLabel={pendingTransition.confirmLabel}
            message={pendingTransition.message}
            title={pendingTransition.title}
            onCancel={cancelTransition}
            onConfirm={confirmTransition}
          />
        )}
      </StageFrame>
    );
  }

  if (stage !== UnderstandingCalibrationStages.completed) return <UnderstandingCalibrationProblemFlow problems={independentProblems} session={props.session} setSession={props.setSession} stage={stage} topic={topic} />;
  return <UnderstandingCalibrationCompletedStage sessionTitle={props.session.assignment.title} title={topic} />;
}
