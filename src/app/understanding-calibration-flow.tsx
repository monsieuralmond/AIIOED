import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { requestSessionCalibrationChat } from "../session/research-api-client.js";
import { loadBrowserSessionIdentity } from "../session/browser-session.js";
import { UnderstandingCalibrationStages } from "../shared/research.js";
import type { CalibrationChatRequest } from "../shared/calibration-ai.js";
import type { PilotSession } from "../shared/types.js";
import { updateSessionLlmMetadata } from "../session/session.js";
import { WarningBanner } from "./ui.js";
import { ChatInput, ChatLog, StageFrame, SurveyResponseGroup } from "./understanding-calibration-components.js";
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
import { appendCalibrationRecords, makeCalibrationChatTurn } from "./understanding-calibration-session.js";
import { UnderstandingCalibrationCompletedStage } from "./understanding-calibration-completed-stage.js";

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

  const savePreSurvey = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [{ kind: "pre_survey_text_responses", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, textResponses: preTextResponses, topic } }],
        events: [
          { type: "calibration_pre_survey_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: preRatings, textResponses: preTextResponses, topic } },
          { type: "calibration_reading_started", payload: { topic } }
        ],
        measures: [{ kind: "pre_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: preRatings, textResponses: preTextResponses, topic } }],
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
      const previewRequest = previewChatRequest(message);
      const response = await requestSessionCalibrationChat({
        message,
        ...(previewRequest === undefined ? {} : { previewRequest }),
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
      setChatInput(message);
      const messageForStudent = error instanceof Error && error.message.trim().length > 0
        ? `AI 응답을 받지 못했습니다. 잠시 후 다시 보내 주세요. (${error.message})`
        : "AI 응답을 받지 못했습니다. 잠시 후 다시 보내 주세요.";
      setChatError(messageForStudent);
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
        artifacts: [{ kind: "prediction_survey_text_responses", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, textResponses: predictionTextResponses, topic } }],
        events: [
          { type: "calibration_prediction_survey_submitted", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: predictionRatings, textResponses: predictionTextResponses, topic } },
          ...(firstProblem === undefined ? [] : [startedEventForProblem(firstProblem)])
        ],
        measures: [{ kind: "prediction_self_report", payload: { promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION, ratings: predictionRatings, rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION, textResponses: predictionTextResponses, topic } }],
        nextStage: firstProblem?.stage ?? UnderstandingCalibrationStages.reflectionSurvey,
        stage: UnderstandingCalibrationStages.predictionSurvey
      })
    );
  };

  if (stage === UnderstandingCalibrationStages.preSurvey) {
    return (
      <StageFrame disabled={!surveyResponsesComplete(preSurveyItems, preRatings, preTextResponses)} primaryLabel="글 읽기로 이동" sessionTitle={props.session.assignment.title} stage={stage} subtitle={`${topic}에 대해 지금 떠오르는 생각을 먼저 남깁니다.`} title="시작 전 확인" onPrimary={savePreSurvey}>
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
      <StageFrame disabled={chatPending || !hasAssistantResponse} layout="split" primaryLabel="다음 활동 전 확인" sessionTitle={props.session.assignment.title} stage={stage} subtitle="글을 읽고 더 확인하고 싶은 내용이 있으면 AI에게 자유롭게 질문해 보세요. 확인이 끝나면 다음 활동으로 이동하세요." title={topic} onPrimary={completeChat}>
        <div className="calibration-study-layout">
          <article className="understanding-passage calibration-study-passage"><h2>지문</h2><p>{passage}</p></article>
          <section aria-label="AI와 대화" className="calibration-chat-panel">
            <header>
              <span>AI에게 질문하기</span>
              <h2>궁금한 점을 물어보세요</h2>
            </header>
            <ChatLog turns={props.session.chatTurns} />
            {chatError.length > 0 ? <WarningBanner>{chatError}</WarningBanner> : null}
            <ChatInput disabled={chatPending} value={chatInput} onChange={setChatInput} onSubmit={() => { void sendChat(); }} />
          </section>
        </div>
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.predictionSurvey) {
    return (
      <StageFrame disabled={!surveyResponsesComplete(predictionSurveyItems, predictionRatings, predictionTextResponses)} primaryLabel="문제 시작" sessionTitle={props.session.assignment.title} stage={stage} subtitle="다음 활동을 하기 전에 지금 느낌을 표시해 주세요." title="다음 활동 전 확인" onPrimary={savePrediction}>
        <SurveyResponseGroup
          items={predictionSurveyItemsForTopic}
          ratings={predictionRatings}
          textResponses={predictionTextResponses}
          onRatingChange={(id, value) => setPredictionRatings((ratings) => updateRating(ratings, id, value))}
          onTextChange={(id, value) => setPredictionTextResponses((responses) => updateTextResponse(responses, id, value))}
        />
      </StageFrame>
    );
  }

  if (stage !== UnderstandingCalibrationStages.completed) return <UnderstandingCalibrationProblemFlow problems={independentProblems} session={props.session} setSession={props.setSession} stage={stage} topic={topic} />;
  return <UnderstandingCalibrationCompletedStage sessionTitle={props.session.assignment.title} title={topic} />;
}
