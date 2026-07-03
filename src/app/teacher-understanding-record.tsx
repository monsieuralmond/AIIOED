import type { ReactElement } from "react";
import type { PilotSession } from "../shared/types";
import { independentProblemsForModule, predictionSurveyItemsForModule, preSurveyItemsForModule, reflectionSurveyItemsForModule, surveyItemsForTopic } from "./understanding-calibration-data";
import type { IndependentProblem, LikertItem } from "./understanding-calibration-data";

type ProblemResponse = {
  readonly answer: string;
  readonly confidence: number | null;
  readonly problem: IndependentProblem;
};

type RatingRow = {
  readonly label: string;
  readonly value: number;
};

const roleLabels = {
  assistant: "AI",
  student: "학생"
} as const;

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
  return items.flatMap((item) => {
    const value = ratings[item.id];
    return isNumber(value) ? [{ label: item.label, value }] : [];
  });
};

export const understandingAnswerCount = (session: PilotSession): number =>
  problemResponsesForSession(session).filter((response) => response.answer.length > 0).length;

export const understandingConfidenceCount = (session: PilotSession): number =>
  problemResponsesForSession(session).filter((response) => response.confidence !== null).length;

export const hasUnderstandingReflection = (session: PilotSession): boolean =>
  payloadString(artifactPayload(session, "final_reflection"), "text").length > 0 ||
  ratingsForMeasure(session, "reflection_self_report", reflectionSurveyItemsForModule(session.modules.understandingCalibration)).length > 0;

function RatingGroup(props: { readonly items: readonly RatingRow[]; readonly title: string }): ReactElement {
  return (
    <section className="understanding-rating-group" aria-label={props.title}>
      <h4>{props.title}</h4>
      {props.items.length === 0 ? <p>아직 기록이 없습니다.</p> : (
        <dl>
          {props.items.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value} / 5</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function TeacherUnderstandingRecord(props: { readonly session: PilotSession }): ReactElement {
  const responses = problemResponsesForSession(props.session);
  const module = props.session.modules.understandingCalibration;
  const topic = props.session.modules.understandingCalibration?.topic ?? props.session.assignment.title;
  const preRatings = ratingsForMeasure(props.session, "pre_self_report", surveyItemsForTopic(preSurveyItemsForModule(module), topic));
  const predictionRatings = ratingsForMeasure(props.session, "prediction_self_report", surveyItemsForTopic(predictionSurveyItemsForModule(module), topic));
  const reflectionRatings = ratingsForMeasure(props.session, "reflection_self_report", reflectionSurveyItemsForModule(module));
  const finalReflection = payloadString(artifactPayload(props.session, "final_reflection"), "text");

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
          <RatingGroup items={preRatings} title="시작 전 확인" />
          <RatingGroup items={predictionRatings} title="수행 예측" />
          <RatingGroup items={reflectionRatings} title="활동 돌아보기" />
        </div>
      </section>
      <section aria-label="AI 대화 기록" className="understanding-chat-section teacher-chat-log-section">
        <h3>AI 대화 기록</h3>
        {props.session.chatTurns.length === 0 ? <p>아직 대화가 없습니다.</p> : (
          <ol className="turn-list">
            {props.session.chatTurns.map((turn) => <li key={turn.id}><strong>{roleLabels[turn.role]}</strong><p>{turn.text}</p></li>)}
          </ol>
        )}
      </section>
      <section aria-label="마무리 생각" className="understanding-final-reflection">
        <h3>마무리 생각</h3>
        <blockquote>{finalReflection.length === 0 ? "아직 기록이 없습니다." : finalReflection}</blockquote>
      </section>
    </>
  );
}
