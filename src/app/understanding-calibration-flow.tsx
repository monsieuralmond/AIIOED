import { useState } from "react";
import type { ReactElement } from "react";
import { requestCalibrationChatResponse } from "../ai/api-client";
import { UnderstandingCalibrationStages } from "../shared/research";
import type { PilotSession } from "../shared/types";
import { updateSessionLlmMetadata } from "../session/session";
import { WarningBanner } from "./ui";
import { ChatInput, ChatLog, ChoiceGroup, LikertGroup, StageFrame } from "./understanding-calibration-components";
import { chatCompletedPayload, durationSince, lastEventTimestamp } from "./understanding-calibration-events";
import {
  chatReviewItems,
  defaultErrorStatement,
  defaultIndependentTasks,
  defaultTransferChoices,
  emptyRatings,
  isCalibrationStage,
  postTaskSurveyItems,
  predictionSurveyItems,
  preSurveyItems,
  ratingsComplete,
  updateRating
} from "./understanding-calibration-data";
import { appendCalibrationRecords, makeCalibrationChatTurn, makeChatReviewCompletionUpdate } from "./understanding-calibration-session";
import { UnderstandingCalibrationCompletedStage } from "./understanding-calibration-completed-stage";

export function UnderstandingCalibrationFlow(props: { readonly session: PilotSession; readonly setSession: (updater: (session: PilotSession) => PilotSession) => void }): ReactElement {
  const module = props.session.modules.understandingCalibration;
  const topic = module?.topic ?? props.session.assignment.title;
  const passage = module?.sourceText ?? props.session.assignment.passage;
  const errorStatement = module?.errorStatement ?? defaultErrorStatement;
  const transferChoices = module?.transferChoices ?? defaultTransferChoices;
  const independentTasks = module?.independentTasks ?? defaultIndependentTasks;
  const stage = isCalibrationStage(props.session.currentStage) ? props.session.currentStage : UnderstandingCalibrationStages.preSurvey;

  const [preRatings, setPreRatings] = useState(() => emptyRatings(preSurveyItems));
  const [preFreeResponse, setPreFreeResponse] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [predictionRatings, setPredictionRatings] = useState(() => emptyRatings(predictionSurveyItems));
  const [independentExplanation, setIndependentExplanation] = useState("");
  const [errorChoice, setErrorChoice] = useState("");
  const [errorReason, setErrorReason] = useState("");
  const [transferChoice, setTransferChoice] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [postRatings, setPostRatings] = useState(() => emptyRatings(postTaskSurveyItems));
  const [postHardestPart, setPostHardestPart] = useState("");
  const [reviewRatings, setReviewRatings] = useState(() => emptyRatings(chatReviewItems));
  const [reviewMostHelpful, setReviewMostHelpful] = useState("");
  const [reviewShouldCheck, setReviewShouldCheck] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState("");

  const savePreSurvey = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [{ kind: "pre_free_response", payload: { text: preFreeResponse.trim(), topic } }],
        events: [
          { type: "calibration_pre_survey_submitted", payload: { ratings: preRatings, textLength: preFreeResponse.trim().length, topic } },
          { type: "calibration_reading_started", payload: { topic } }
        ],
        measures: [{ kind: "pre_self_report", payload: { ratings: preRatings, topic } }],
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
    try {
      const response = await requestCalibrationChatResponse({
        ...(module?.aiContext === undefined ? {} : { aiContext: module.aiContext }),
        history: props.session.chatTurns.map((turn) => ({ role: turn.role, text: turn.text })),
        message,
        passage,
        topic
      });
      const studentTurn = makeCalibrationChatTurn("student", message);
      const assistantTurn = makeCalibrationChatTurn("assistant", response.text, response.type);
      setChatInput("");
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
        events: [
          {
            type: "calibration_chat_completed",
            payload: chatCompletedPayload(session, topic)
          }
        ],
        nextStage: UnderstandingCalibrationStages.predictionSurvey,
        stage: UnderstandingCalibrationStages.chat
      })
    );
  };

  const savePrediction = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        events: [{ type: "calibration_prediction_survey_submitted", payload: { ratings: predictionRatings, topic } }],
        measures: [{ kind: "prediction_self_report", payload: { ratings: predictionRatings, topic } }],
        nextStage: UnderstandingCalibrationStages.independentTasks,
        stage: UnderstandingCalibrationStages.predictionSurvey
      })
    );
  };

  const saveIndependentTasks = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [
          { kind: "independent_explanation", payload: { prompt: independentTasks[0] ?? defaultIndependentTasks[0], text: independentExplanation.trim(), topic } },
          { kind: "error_judgment_reason", payload: { choice: errorChoice, reason: errorReason.trim(), statement: errorStatement, topic } },
          { kind: "transfer_reason", payload: { choice: transferChoice, reason: transferReason.trim(), topic } }
        ],
        events: [{ type: "calibration_independent_tasks_submitted", payload: { errorChoice, explanationLength: independentExplanation.trim().length, transferChoice, topic } }],
        measures: [
          { kind: "error_judgment_choice", payload: { choice: errorChoice, statement: errorStatement, topic } },
          { kind: "transfer_choice", payload: { choice: transferChoice, topic } },
          { kind: "manual_evaluation_placeholder", payload: { boundary: null, demonstratedLevel: null, description: null, mechanism: null, raterId: null, raterNotes: "", recognition: null, transfer: null } }
        ],
        nextStage: UnderstandingCalibrationStages.postTaskSurvey,
        stage: UnderstandingCalibrationStages.independentTasks
      })
    );
  };

  const savePostTaskSurvey = (): void => {
    props.setSession((session) =>
      appendCalibrationRecords(session, {
        artifacts: [{ kind: "post_task_reflection", payload: { hardestPart: postHardestPart.trim(), topic } }],
        events: [{ type: "calibration_post_task_survey_submitted", payload: { hardestPartLength: postHardestPart.trim().length, ratings: postRatings, topic } }],
        measures: [{ kind: "post_task_self_report", payload: { ratings: postRatings, topic } }],
        nextStage: UnderstandingCalibrationStages.chatReview,
        stage: UnderstandingCalibrationStages.postTaskSurvey
      })
    );
  };

  const completeReview = (): void => {
    const completedAt = new Date().toISOString();
    props.setSession((session) =>
      appendCalibrationRecords(session, makeChatReviewCompletionUpdate({
        completedAt,
        mostHelpful: reviewMostHelpful.trim(),
        ratings: reviewRatings,
        shouldHaveChecked: reviewShouldCheck.trim(),
        topic
      }))
    );
  };

  if (stage === UnderstandingCalibrationStages.preSurvey) {
    return (
      <StageFrame disabled={!ratingsComplete(preSurveyItems, preRatings) || preFreeResponse.trim().length === 0} primaryLabel="글 읽기로 이동" sessionTitle={props.session.assignment.title} stage={stage} subtitle="지금 떠오르는 생각을 먼저 남깁니다." title={topic} onPrimary={savePreSurvey}>
        <LikertGroup items={preSurveyItems} ratings={preRatings} onChange={(id, value) => setPreRatings((ratings) => updateRating(ratings, id, value))} />
        <label className="understanding-textarea"><span>이 주제에 대해 현재 알고 있는 내용을 자유롭게 써 보세요.</span><textarea value={preFreeResponse} onChange={(event) => setPreFreeResponse(event.currentTarget.value)} /></label>
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
    return (
      <StageFrame disabled={props.session.chatTurns.length === 0} primaryLabel="다음 활동 전 확인" sessionTitle={props.session.assignment.title} stage={stage} subtitle="글을 읽고 더 확인하고 싶은 내용이 있으면 AI에게 자유롭게 질문해 보세요. 확인이 끝나면 다음 활동으로 이동하세요." title={topic} onPrimary={completeChat}>
        <ChatLog turns={props.session.chatTurns} />
        {chatError.length > 0 ? <WarningBanner>{chatError}</WarningBanner> : null}
        <ChatInput disabled={chatPending} value={chatInput} onChange={setChatInput} onSubmit={() => { void sendChat(); }} />
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.predictionSurvey) {
    return (
      <StageFrame disabled={!ratingsComplete(predictionSurveyItems, predictionRatings)} primaryLabel="활동하기" sessionTitle={props.session.assignment.title} stage={stage} subtitle="다음 활동을 하기 전에 지금 느낌을 표시해 주세요." title={topic} onPrimary={savePrediction}>
        <LikertGroup items={predictionSurveyItems} ratings={predictionRatings} onChange={(id, value) => setPredictionRatings((ratings) => updateRating(ratings, id, value))} />
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.independentTasks) {
    const ready = independentExplanation.trim().length > 0 && errorChoice.length > 0 && errorReason.trim().length > 0 && transferChoice.length > 0 && transferReason.trim().length > 0;
    return (
      <StageFrame disabled={!ready} primaryLabel="활동 후 확인" sessionTitle={props.session.assignment.title} stage={stage} subtitle="지금은 내 생각으로만 해 봅니다." title={topic} onPrimary={saveIndependentTasks}>
        <label className="understanding-textarea"><span>{independentTasks[0] ?? defaultIndependentTasks[0]}</span><textarea value={independentExplanation} onChange={(event) => setIndependentExplanation(event.currentTarget.value)} /></label>
        <ChoiceGroup choices={[{ id: "correct", label: "맞다", text: errorStatement }, { id: "incorrect", label: "틀리다", text: errorStatement }, { id: "unsure", label: "잘 모르겠다", text: errorStatement }]} label="문장 판단" value={errorChoice} onChange={setErrorChoice} />
        <label className="understanding-textarea compact"><span>그렇게 생각한 이유</span><textarea value={errorReason} onChange={(event) => setErrorReason(event.currentTarget.value)} /></label>
        <ChoiceGroup choices={transferChoices} label="새로운 상황에 적용하기" value={transferChoice} onChange={setTransferChoice} />
        <label className="understanding-textarea compact"><span>고른 이유</span><textarea value={transferReason} onChange={(event) => setTransferReason(event.currentTarget.value)} /></label>
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.postTaskSurvey) {
    return (
      <StageFrame disabled={!ratingsComplete(postTaskSurveyItems, postRatings) || postHardestPart.trim().length === 0} primaryLabel="대화 다시 보기" sessionTitle={props.session.assignment.title} stage={stage} subtitle="방금 활동을 하며 느낀 점을 표시해 주세요." title={topic} onPrimary={savePostTaskSurvey}>
        <LikertGroup items={postTaskSurveyItems} ratings={postRatings} onChange={(id, value) => setPostRatings((ratings) => updateRating(ratings, id, value))} />
        <label className="understanding-textarea"><span>가장 어려웠던 부분</span><textarea value={postHardestPart} onChange={(event) => setPostHardestPart(event.currentTarget.value)} /></label>
      </StageFrame>
    );
  }

  if (stage === UnderstandingCalibrationStages.chatReview) {
    return (
      <StageFrame disabled={!ratingsComplete(chatReviewItems, reviewRatings) || reviewMostHelpful.trim().length === 0 || reviewShouldCheck.trim().length === 0} primaryLabel="완료" sessionTitle={props.session.assignment.title} stage={stage} subtitle="이전에 나눈 대화를 다시 살펴봅니다." title={topic} onPrimary={completeReview}>
        <ChatLog readonlyMode turns={props.session.chatTurns} />
        <LikertGroup items={chatReviewItems} ratings={reviewRatings} onChange={(id, value) => setReviewRatings((ratings) => updateRating(ratings, id, value))} />
        <label className="understanding-textarea compact"><span>가장 도움이 된 부분</span><textarea value={reviewMostHelpful} onChange={(event) => setReviewMostHelpful(event.currentTarget.value)} /></label>
        <label className="understanding-textarea compact"><span>다시 확인했어야 할 부분</span><textarea value={reviewShouldCheck} onChange={(event) => setReviewShouldCheck(event.currentTarget.value)} /></label>
      </StageFrame>
    );
  }

  return <UnderstandingCalibrationCompletedStage sessionTitle={props.session.assignment.title} title={topic} />;
}
