import type { PilotSession } from "../shared/types.js";
import type { UnderstandingCalibrationStage } from "../shared/research.js";
import { UNDERSTANDING_CALIBRATION_PROMPT_VERSION } from "./understanding-calibration-data.js";
import type { IndependentProblem } from "./understanding-calibration-data.js";
import { durationSince } from "./understanding-calibration-events.js";

export const startedEventForProblem = (problem: IndependentProblem): {
  readonly payload: Record<string, unknown>;
  readonly stage: UnderstandingCalibrationStage;
  readonly type: "question_started";
} => ({
  payload: {
    problemKey: problem.answerArtifactKind,
    prompt: problem.prompt,
    promptVersion: UNDERSTANDING_CALIBRATION_PROMPT_VERSION,
    questionNumber: problem.number,
    title: problem.title
  },
  stage: problem.stage,
  type: "question_started"
});

export const firstProblemStartedEvent = (problems: readonly IndependentProblem[]): ReturnType<typeof startedEventForProblem> => {
  const firstProblem = problems[0];
  if (firstProblem === undefined) throw new Error("Independent problem list is empty.");
  return startedEventForProblem(firstProblem);
};

const startedAtForProblem = (session: PilotSession, problem: IndependentProblem): string | null => {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event?.type === "question_started" && event.payload["questionNumber"] === problem.number) return event.timestamp;
  }
  return null;
};

export const durationForProblemAnswer = (session: PilotSession, problem: IndependentProblem): number | null =>
  durationSince(startedAtForProblem(session, problem));
