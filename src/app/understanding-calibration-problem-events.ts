import type { PilotSession } from "../shared/types";
import type { UnderstandingCalibrationStage } from "../shared/research";
import type { IndependentProblem } from "./understanding-calibration-data";
import { durationSince } from "./understanding-calibration-events";

export const startedEventForProblem = (problem: IndependentProblem): {
  readonly payload: Record<string, unknown>;
  readonly stage: UnderstandingCalibrationStage;
  readonly type: "question_started";
} => ({
  payload: { questionNumber: problem.number, title: problem.title },
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
