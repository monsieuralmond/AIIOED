import type { ReactElement } from "react";
import type { PilotSession } from "../shared/types.js";
import { finalReflectionSurveyItemsForModule, independentProblemsForModule, predictionSurveyItemsForModule, preSurveyItemsForModule, reflectionSurveyItemsForModule, surveyItemsForTopic, surveyResponseType } from "./understanding-calibration-data.js";
import type { IndependentProblem, LikertItem } from "./understanding-calibration-data.js";

type ProblemResponse = {
  readonly answer: string;
  readonly confidence: number | null;
  readonly problem: IndependentProblem;
};

type RatingRow = {
  readonly label: string;
  readonly value: number;
};

type TextResponseRow = {
  readonly label: string;
  readonly value: string;
};

type SurveyResponseRows = {
  readonly ratings: readonly RatingRow[];
  readonly texts: readonly TextResponseRow[];
};

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const artifactPayload = (session: PilotSession, kind: string): Record<string, unknown> | null =>
  session.artifacts.find((artifact) => artifact.kind === kind)?.payload ?? null;

const measurePayload = (session: PilotSession, kind: string): Record<string, unknown> | null =>
  session.measures.find((measure) => measure.kind === kind)?.payload ?? null;

const payloadString = (payload: Record<string, unknown> | null, key: string): string => {
  const value = payload?.[key];
  return isString(value) ? value.trim() : "";
};

const payloadNumber = (payload: Record<string, unknown> | null, key: string): number | null => {
  const value = payload?.[key];
  return isNumber(value) ? value : null;
};

const problemResponsesForSession = (session: PilotSession): readonly ProblemResponse[] =>
  independentProblemsForModule(session.modules.understandingCalibration).map((problem) => ({
    answer: payloadString(artifactPayload(session, problem.answerArtifactKind), "answer"),
    confidence: payloadNumber(measurePayload(session, problem.confidenceMeasureKind), "confidence"),
    problem
  }));

const ratingsForMeasure = (session: PilotSession, kind: string, items: readonly LikertItem[]): readonly RatingRow[] => {
  const ratings = measurePayload(session, kind)?.["ratings"];
  if (!isRecord(ratings)) return [];
  return items.filter((item) => surveyResponseType(item) === "likert").flatMap((item) => {
    const value = ratings[item.id];
    return isNumber(value) ? [{ label: item.label, value }] : [];
  });
};

const textResponsesForMeasure = (session: PilotSession, kind: string, items: readonly LikertItem[]): readonly TextResponseRow[] => {
  const textResponses = measurePayload(session, kind)?.["textResponses"];
  if (!isRecord(textResponses)) return [];
  return items.filter((item) => surveyResponseType(item) === "text").flatMap((item) => {
    const value = textResponses[item.id];
    return isString(value) && value.trim().length > 0 ? [{ label: item.label, value: value.trim() }] : [];
  });
};

const surveyResponsesForMeasure = (session: PilotSession, kind: string, items: readonly LikertItem[]): SurveyResponseRows => ({
  ratings: ratingsForMeasure(session, kind, items),
  texts: textResponsesForMeasure(session, kind, items)
});

const aiFailureCountForSession = (session: PilotSession): number =>
  session.events.filter((event) => event.type === "calibration_chat_failed").length;

export const understandingAnswerCount = (session: PilotSession): number =>
  problemResponsesForSession(session).filter((response) => response.answer.length > 0).length;

export const understandingConfidenceCount = (session: PilotSession): number =>
  problemResponsesForSession(session).filter((response) => response.confidence !== null).length;

export const hasUnderstandingReflection = (session: PilotSession): boolean =>
  payloadString(artifactPayload(session, "final_reflection"), "text").length > 0 ||
  ratingsForMeasure(session, "reflection_self_report", reflectionSurveyItemsForModule(session.modules.understandingCalibration)).length > 0 ||
  textResponsesForMeasure(session, "reflection_self_report", reflectionSurveyItemsForModule(session.modules.understandingCalibration)).length > 0 ||
  ratingsForMeasure(session, "final_reflection_self_report", finalReflectionSurveyItemsForModule(session.modules.understandingCalibration)).length > 0 ||
  textResponsesForMeasure(session, "final_reflection_self_report", finalReflectionSurveyItemsForModule(session.modules.understandingCalibration)).length > 0;

function SurveyGroup(props: { readonly responses: SurveyResponseRows; readonly title: string }): ReactElement {
  const empty = props.responses.ratings.length === 0 && props.responses.texts.length === 0;
  return (
    <section className="understanding-rating-group" aria-label={props.title}>
      <h4>{props.title}</h4>
      {empty ? <p>아직 기록이 없습니다.</p> : null}
      {props.responses.ratings.length === 0 ? null : (
        <dl>
          {props.responses.ratings.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value} / 5</dd>
            </div>
          ))}
        </dl>
      )}
      {props.responses.texts.length === 0 ? null : (
        <div className="understanding-text-response-list">
          {props.responses.texts.map((item) => (
            <article key={item.label}>
              <strong>{item.label}</strong>
              <p>{item.value}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function TeacherUnderstandingRecord(props: { readonly session: PilotSession }): ReactElement {
  const responses = problemResponsesForSession(props.session);
  const module = props.session.modules.understandingCalibration;
  const topic = props.session.modules.understandingCalibration?.topic ?? props.session.assignment.title;
  const preResponses = surveyResponsesForMeasure(props.session, "pre_self_report", surveyItemsForTopic(preSurveyItemsForModule(module), topic));
  const predictionResponses = surveyResponsesForMeasure(props.session, "prediction_self_report", surveyItemsForTopic(predictionSurveyItemsForModule(module), topic));
  const reflectionResponses = surveyResponsesForMeasure(props.session, "reflection_self_report", reflectionSurveyItemsForModule(module));
  const finalReflectionResponses = surveyResponsesForMeasure(props.session, "final_reflection_self_report", finalReflectionSurveyItemsForModule(module));
  const finalReflection = payloadString(artifactPayload(props.session, "final_reflection"), "text");
  const aiFailureCount = aiFailureCountForSession(props.session);

  return (
    <>
      <section aria-label="문제별 응답" className="understanding-response-section">
        <h3>문제별 응답</h3>
        <ol className="understanding-response-list">
          {responses.map((response) => (
            <li className="understanding-response-item" key={response.problem.answerArtifactKind}>
              <header>
                <div>
                  <span>문제 {response.problem.number}</span>
                  <strong>{response.problem.title}</strong>
                </div>
                <em>{response.confidence === null ? "확신도 미입력" : `확신도 ${response.confidence} / 5`}</em>
              </header>
              <p className="understanding-response-prompt">{response.problem.prompt}</p>
              <blockquote>{response.answer.length === 0 ? "아직 답변이 없습니다." : response.answer}</blockquote>
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="확인 문항 응답" className="understanding-survey-section">
        <h3>확인 문항 응답</h3>
        <div className="understanding-rating-grid">
          <SurveyGroup responses={preResponses} title="시작 전 확인" />
          <SurveyGroup responses={predictionResponses} title="수행 예측" />
          <SurveyGroup responses={reflectionResponses} title="활동 돌아보기" />
          <SurveyGroup responses={finalReflectionResponses} title="대화 다시 본 뒤" />
        </div>
      </section>
      <section aria-label="AI 대화 요약" className="understanding-chat-section teacher-chat-log-section">
        <h3>AI 대화 요약</h3>
        <p>{props.session.chatTurns.length === 0 ? "아직 대화가 없습니다." : `학생 질문과 AI 응답이 ${props.session.chatTurns.length}턴 기록되었습니다. 원문 대화는 관리자 로그에서만 확인합니다.`}</p>
      </section>
      <section aria-label="AI 응답 상태" className="understanding-ai-failure-section">
        <h3>AI 응답 상태</h3>
        <p>{aiFailureCount === 0 ? "AI 응답 실패 기록이 없습니다." : `AI 응답 실패가 ${aiFailureCount}회 기록되었습니다. 상세 로그는 관리자 export에서 확인합니다.`}</p>
      </section>
      <section aria-label="마무리 생각" className="understanding-final-reflection">
        <h3>마무리 생각</h3>
        <blockquote>{finalReflection.length === 0 ? "아직 기록이 없습니다." : finalReflection}</blockquote>
      </section>
    </>
  );
}
