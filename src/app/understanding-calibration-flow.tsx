import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { requestSessionCalibrationChat } from "../session/research-api-client";
import { UnderstandingCalibrationStages } from "../shared/research";
import type { PilotSession } from "../shared/types";
import { updateSessionLlmMetadata } from "../session/session";
import { WarningBanner } from "./ui";
import { ChatInput, ChatLog, LikertGroup, StageFrame } from "./understanding-calibration-components";
import { chatCompletedPayload, durationSince, lastEventTimestamp } from "./understanding-calibration-events";
import {
  emptyRatings,
  independentProblemsForModule,
  isCalibrationStage,
  predictionSurveyItemsForModule,
  preSurveyItemsForModule,
  ratingsComplete,
  surveyItemsForTopic,
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
  updateRating
} from "./understanding-calibration-data";
import { startedEventForProblem } from "./understanding-calibration-problem-events";
import { UnderstandingCalibrationProblemFlow } from "./understanding-calibration-problem-flow";
import { appendCalibrationRecords, makeCalibrationChatTurn } from "./understanding-calibration-session";
import { UnderstandingCalibrationCompletedStage } from "./understanding-calibration-completed-stage";

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
  const [preFreeResponse, setPreFreeResponse] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [predictionRatings, setPredictionRatings] = useState(() => emptyRatings(predictionSurveyItems));
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatTurnsRef = useRef(props.session.chatTurns);

  useEffect(() => {
    chatTurnsRef.current = props.session.chatTurns;
  }, [props.session.chatTurns]);

  const savePreSurvey = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [{ kind: "pre_free_response", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, text: preFreeResponse.trim(), topic } }],
        events: [
          { type: "calibration_pre_survey_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: preRatings, textLength: preFreeResponse.trim().length, topic } },
          { type: "calibration_reading_started", payload: { topic } }
        ],
        measures: [{ kind: "pre_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: preRatings, topic } }],
        nextStage: UnderstandingCalibrationStages.reading,
        stage: UnderstandingCalibrationStages.preSurvey
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

  const sendChat = async (): Promise<void> => {
    const message = chatInput.trim();
    if (message.length === 0 || chatPending) return;
    setChatPending(true);
    setChatError("");
    const studentTurn = makeCalibrationChatTurn("student", message);
    setChatInput("");
    try {
      const response = await requestSessionCalibrationChat({
        message,
        requestId: studentTurn.id,
        sessionId: props.session.sessionId
      });
      const assistantTurn = makeCalibrationChatTurn("assistant", response.text, response.type);
      chatTurnsRef.current = [...chatTurnsRef.current, studentTurn, assistantTurn];
      props.setSession((session) => {
        const nextSession = appendCalibrationRecords(session, {
          chatTurns: [studentTurn, assistantTurn],
          events: [
            { type: "student_message", payload: { text: message } },
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
                studentTurnId: studentTurn.id,
                userMessage: message,
                userMessageLength: message.length
              }
            }
          ],
          stage: UnderstandingCalibrationStages.chat
        });
        return response.llmMode === undefined || response.model === undefined ? nextSession : updateSessionLlmMetadata(nextSession, response.llmMode, response.model);
      });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "AI 응답을 가져오지 못했습니다.");
    } finally {
      setChatPending(false);
    }
  };

  const completeChat = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [{ type: "calibration_chat_completed", payload: chatCompletedPayload(session, topic) }],
        nextStage: UnderstandingCalibrationStages.predictionSurvey,
        stage: UnderstandingCalibrationStages.chat
      })
    );
  };

  const savePrediction = (): void => {
    const firstProblem = independentProblems[0];
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [
          { type: "calibration_prediction_survey_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: predictionRatings, topic } },
          ...(firstProblem === undefined ? [] : [startedEventForProblem(firstProblem)])
        ],
        measures: [{ kind: "prediction_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: predictionRatings, rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION, topic } }],
        nextStage: firstProblem?.stage ?? UnderstandingCalibrationStages.reflectionSurvey,
        stage: UnderstandingCalibrationStages.predictionSurvey
      })
    );
  };

  if (stage === UnderstandingCalibrationStages.preSurvey) {
    return (
      <StageFrame disabled={!ratingsComplete(preSurveyItems, preRatings) || preFreeResponse.trim().length === 0} primaryLabel="글 읽기로 이동" sessionTitle={props.session.assignment.title} stage={stage} subtitle={`${topic}에 대해 지금 떠오르는 생각을 먼저 남깁니다.`} title="시작 전 확인" onPrimary={savePreSurvey}>
        <LikertGroup items={preSurveyItemsForTopic} ratings={preRatings} onChange={(id, value) => setPreRatings((ratings) => updateRating(ratings, id, value))} />
        <label className="understanding-textarea"><span>{topic}에 대해 현재 알고 있는 내용을 자유롭게 써 보세요.</span><textarea value={preFreeResponse} onChange={(event) => setPreFreeResponse(event.currentTarget.value)} /></label>
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.reading) {
    return (
      <StageFrame primaryLabel="질문하러 가기" sessionTitle={props.session.assignment.title} stage={stage} subtitle="천천히 읽고 중요한 문장을 마음속으로 표시해 보세요." title={props.session.assignment.title} onPrimary={completeReading}>
        <article className="understanding-passage"><h2>지문</h2><p>{passage}</p></article>
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.chat) {
    const hasAssistantResponse = props.session.chatTurns.some((turn) => turn.role === "assistant");
    return (
      <StageFrame disabled={chatPending || !hasAssistantResponse} primaryLabel="다음 활동 전 확인" sessionTitle={props.session.assignment.title} stage={stage} subtitle="글을 읽고 더 확인하고 싶은 내용이 있으면 AI에게 자유롭게 질문해 보세요. 확인이 끝나면 다음 활동으로 이동하세요." title={topic} onPrimary={completeChat}>
        <ChatLog turns={props.session.chatTurns} />
        {chatError.length > 0 ? <WarningBanner>{chatError}</WarningBanner> : null}
        <ChatInput disabled={chatPending} value={chatInput} onChange={setChatInput} onSubmit={() => { void sendChat(); }} />
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.predictionSurvey) {
    return (
      <StageFrame disabled={!ratingsComplete(predictionSurveyItems, predictionRatings)} primaryLabel="문제 시작" sessionTitle={props.session.assignment.title} stage={stage} subtitle="다음 활동을 하기 전에 지금 느낌을 표시해 주세요." title="다음 활동 전 확인" onPrimary={savePrediction}>
        <LikertGroup items={predictionSurveyItemsForTopic} ratings={predictionRatings} onChange={(id, value) => setPredictionRatings((ratings) => updateRating(ratings, id, value))} />
      </StageFrame>
    );
  }

  if (stage !== UnderstandingCalibrationStages.completed) return <UnderstandingCalibrationProblemFlow problems={independentProblems} session={props.session} setSession={props.setSession} stage={stage} topic={topic} />;
  return <UnderstandingCalibrationCompletedStage sessionTitle={props.session.assignment.title} title={topic} />;
}
