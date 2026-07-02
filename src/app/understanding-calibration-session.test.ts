import { describe, expect, it } from "vitest";
import { ResearchModes, UnderstandingCalibrationStages } from "../shared/research";
import { sampleAssignment } from "../shared/fixtures";
import { createInitialPilotState, saveAssignmentInState, startStudentSession } from "../session/session";
import { appendCalibrationRecords } from "./understanding-calibration-session";

describe("understanding calibration session records", () => {
  it("stores a submitted stage as events, artifacts, measures, and module stage records", () => {
    const initial = createInitialPilotState();
    const student = initial.students[0];
    if (student === undefined) throw new Error("fixture student missing");
    const assignment = {
      ...sampleAssignment,
      id: "assignment-calibration-records",
      researchMode: ResearchModes.understandingCalibration,
      title: "플라스틱 이해 확인"
    };
    const withAssignment = saveAssignmentInState(initial, assignment);
    const started = startStudentSession(withAssignment, student.id, assignment.id);

    const nextSession = appendCalibrationRecords(started.session, {
      artifacts: [{ kind: "pre_free_response", payload: { text: "조금 알고 있다." } }],
      events: [{ type: "calibration_pre_survey_submitted", payload: { ratings: { pre_heard: 4 } } }],
      measures: [{ kind: "pre_self_report", payload: { ratings: { pre_heard: 4 } } }],
      nextStage: UnderstandingCalibrationStages.reading,
      stage: UnderstandingCalibrationStages.preSurvey
    });

    expect(nextSession.currentStage).toBe(UnderstandingCalibrationStages.reading);
    expect(nextSession.events.at(-1)?.type).toBe("calibration_pre_survey_submitted");
    expect(nextSession.artifacts.at(-1)?.kind).toBe("pre_free_response");
    expect(nextSession.measures.at(-1)?.kind).toBe("pre_self_report");
    expect(nextSession.modules.understandingCalibration?.stageRecords?.["pre_survey"]?.artifactIds).toEqual([nextSession.artifacts.at(-1)?.id]);
    expect(nextSession.modules.understandingCalibration?.stageRecords?.["pre_survey"]?.measureIds).toEqual([nextSession.measures.at(-1)?.id]);
  });

  it("stores explicitly staged completion events in the completed module record", () => {
    const initial = createInitialPilotState();
    const student = initial.students[0];
    if (student === undefined) throw new Error("fixture student missing");
    const assignment = {
      ...sampleAssignment,
      id: "assignment-calibration-completed-record",
      researchMode: ResearchModes.understandingCalibration,
      title: "완료 기록 확인"
    };
    const withAssignment = saveAssignmentInState(initial, assignment);
    const started = startStudentSession(withAssignment, student.id, assignment.id);
    const completedAt = "2026-07-02T00:00:00.000Z";

    const nextSession = appendCalibrationRecords(started.session, {
      completedAt,
      events: [
        { type: "calibration_chat_review_submitted", payload: { topic: "완료 기록 확인" } },
        { type: "calibration_study_completed", payload: { completedAt }, stage: UnderstandingCalibrationStages.completed }
      ],
      nextStage: UnderstandingCalibrationStages.completed,
      stage: UnderstandingCalibrationStages.chatReview,
      status: "submitted"
    });

    const completedEvent = nextSession.events.find((event) => event.type === "calibration_study_completed");
    if (completedEvent === undefined) throw new Error("Expected completed event.");
    const completedRecord = nextSession.modules.understandingCalibration?.stageRecords?.["completed"];

    expect(nextSession.currentStage).toBe(UnderstandingCalibrationStages.completed);
    expect(nextSession.status).toBe("submitted");
    expect(completedEvent.stage).toBe(UnderstandingCalibrationStages.completed);
    expect(completedRecord?.completedAt).toBe(completedAt);
    expect(completedRecord?.eventIds).toEqual([completedEvent.id]);
  });
});
