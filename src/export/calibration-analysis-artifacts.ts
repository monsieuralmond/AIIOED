import {
  UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
  UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
  independentProblemsForModule
} from "../app/understanding-calibration-data.js";
import type { IndependentProblem } from "../app/understanding-calibration-data.js";
import type { CalibrationAnalysisArtifacts, CalibrationAnalysisProblemArtifact, CalibrationProblemKey, CalibrationQuestionNumber, PilotEvent, PilotSession } from "../shared/types.js";

const payloadNumber = (payload: Readonly<Record<string, unknown>>, key: string): number | null => {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const payloadString = (payload: Readonly<Record<string, unknown>> | undefined, key: string): string => {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
};

const durationBetween = (startedAt: string | null, endedAt: string | null): number | null => {
  if (startedAt === null || endedAt === null) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
};

const eventForQuestion = (session: PilotSession, type: "question_started" | "question_submitted", questionNumber: CalibrationQuestionNumber): PilotEvent | undefined =>
  session.events.find((event) => event.type === type && payloadNumber(event.payload, "questionNumber") === questionNumber);

const problemDurationMs = (session: PilotSession, questionNumber: CalibrationQuestionNumber, artifactPayload: Readonly<Record<string, unknown>> | undefined): number | null => {
  if (artifactPayload !== undefined) {
    const storedDuration = payloadNumber(artifactPayload, "durationMs");
    if (storedDuration !== null) return storedDuration;
  }
  const submitted = eventForQuestion(session, "question_submitted", questionNumber);
  const submittedDuration = submitted === undefined ? null : payloadNumber(submitted.payload, "durationMs");
  if (submittedDuration !== null) return submittedDuration;
  const started = eventForQuestion(session, "question_started", questionNumber);
  return durationBetween(started?.timestamp ?? null, submitted?.timestamp ?? null);
};

export const chatDurationMs = (session: PilotSession): number | null => {
  const completed = session.events.find((event) => event.type === "calibration_chat_completed");
  if (completed !== undefined) {
    const storedDuration = payloadNumber(completed.payload, "durationMs");
    if (storedDuration !== null) return storedDuration;
  }
  const started = session.events.find((event) => event.type === "calibration_chat_started");
  return durationBetween(started?.timestamp ?? null, completed?.timestamp ?? null);
};

const problemKeyByNumber: Readonly<Record<CalibrationQuestionNumber, CalibrationProblemKey>> = {
  1: "problem1",
  2: "problem2",
  3: "problem3",
  4: "problem4"
};

const questionNumberByProblemKey: Readonly<Record<CalibrationProblemKey, CalibrationQuestionNumber>> = {
  problem1: 1,
  problem2: 2,
  problem3: 3,
  problem4: 4
};

const problemKeyForNumber = (questionNumber: CalibrationQuestionNumber): CalibrationProblemKey => problemKeyByNumber[questionNumber];

const questionNumberForKey = (problemKey: CalibrationProblemKey): CalibrationQuestionNumber => questionNumberByProblemKey[problemKey];

const defaultProblemArtifact = (session: PilotSession, problemKey: CalibrationProblemKey): CalibrationAnalysisProblemArtifact => {
  const questionNumber = questionNumberForKey(problemKey);
  const problem = independentProblemsForModule(session.modules.understandingCalibration).find((item) => item.number === questionNumber);
  return {
    answer: "",
    answerLength: 0,
    problemDurationMs: null,
    promptText: problem?.prompt ?? "",
    promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
    questionNumber,
    rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
    submittedAt: "",
    title: problem?.title ?? "",
    topic: session.modules.understandingCalibration?.topic ?? session.assignment.title
  };
};

export const analysisArtifactsForSession = (session: PilotSession): CalibrationAnalysisArtifacts => {
  const entries = independentProblemsForModule(session.modules.understandingCalibration).map((problem): readonly [CalibrationProblemKey, CalibrationAnalysisProblemArtifact] => {
    const artifact = session.artifacts.find((item) => item.kind === problem.answerArtifactKind);
    const answer = payloadString(artifact?.payload, "answer");
    return [
      problemKeyForNumber(problem.number),
      {
        answer,
        answerLength: answer.length,
        problemDurationMs: problemDurationMs(session, problem.number, artifact?.payload),
        promptText: payloadString(artifact?.payload, "prompt") || problem.prompt,
        promptVersion: payloadString(artifact?.payload, "promptVersion") || UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
        questionNumber: problem.number,
        rubricVersion: payloadString(artifact?.payload, "rubricVersion") || UNDERSTANDING_CALIBRATION_RUBRIC_VERSION,
        submittedAt: artifact?.createdAt ?? "",
        title: payloadString(artifact?.payload, "title") || problem.title,
        topic: payloadString(artifact?.payload, "topic") || session.modules.understandingCalibration?.topic || session.assignment.title
      }
    ];
  });
  const [first, second, third, fourth] = entries;
  return {
    problem1: first?.[1] ?? defaultProblemArtifact(session, "problem1"),
    problem2: second?.[1] ?? defaultProblemArtifact(session, "problem2"),
    problem3: third?.[1] ?? defaultProblemArtifact(session, "problem3"),
    problem4: fourth?.[1] ?? defaultProblemArtifact(session, "problem4")
  };
};

export const confidenceForProblem = (session: PilotSession, problem: IndependentProblem): number | null => {
  const measure = session.measures.find((item) => item.kind === problem.confidenceMeasureKind);
  return measure === undefined ? null : payloadNumber(measure.payload, "confidence");
};
