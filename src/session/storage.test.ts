import { beforeEach, describe, expect, it } from "vitest";
import { ResearchModes } from "../shared/research";
import { createInitialPilotState, startStudentSession } from "./session";
import { loadPersistedState, savePersistedState } from "./storage";

describe("browser storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the class-level pilot state through localStorage", () => {
    const state = createInitialPilotState();

    savePersistedState(state);

    expect(loadPersistedState()).toEqual(state);
  });

  it("ignores malformed stored state", () => {
    window.localStorage.setItem("reading-coach-lab:v1", "{\"assignment\":null}");

    expect(loadPersistedState()).toBeNull();
  });

  it("updates the stored default teacher credentials to the current easy login", () => {
    const state = createInitialPilotState();
    const legacyTeacher = { ...state.teacher, loginId: "teacher", password: "TEACHER-PILOT-2026" };
    window.localStorage.setItem("reading-coach-lab:v1", JSON.stringify({
      ...state,
      teacher: legacyTeacher,
      teachers: [legacyTeacher]
    }));

    const loaded = loadPersistedState();

    expect(loaded?.teacher).toEqual({ ...state.teacher, loginId: "test", password: "test" });
    expect(loaded?.teachers[0]).toEqual({ ...state.teacher, loginId: "test", password: "test" });
  });

  it("migrates stored sessions that predate research-mode fields", () => {
    const state = createInitialPilotState();
    const student = state.students[0];
    if (student === undefined) throw new Error("fixture student missing");
    const started = startStudentSession(state, student.id, state.assignments[0]?.id ?? "");
    const legacySessions = started.state.sessions.map((session) => ({
      assignment: session.assignment,
      chatTurns: session.chatTurns,
      currentStage: session.currentStage,
      draftSnapshots: session.draftSnapshots,
      events: session.events,
      finalSubmission: session.finalSubmission,
      metadata: session.metadata,
      outlineSnapshots: session.outlineSnapshots,
      pasteEvents: session.pasteEvents,
      sessionId: session.sessionId,
      student: session.student,
      teacherReview: session.teacherReview
    }));
    window.localStorage.setItem("reading-coach-lab:v1", JSON.stringify({
      ...started.state,
      sessions: legacySessions
    }));

    const loaded = loadPersistedState();

    expect(loaded?.sessions[0]?.researchMode).toBe(ResearchModes.writingCoach);
    expect(loaded?.sessions[0]?.assignment.researchMode).toBe(ResearchModes.writingCoach);
    expect(loaded?.sessions[0]?.status).toBe("in_progress");
    expect(loaded?.sessions[0]?.artifacts).toEqual([]);
    expect(loaded?.sessions[0]?.measures).toEqual([]);
    expect(loaded?.sessions[0]?.modules).toEqual({});
  });

  it("does not migrate a legacy single-session value into an unrelated user", () => {
    window.localStorage.setItem("reading-coach-lab:v1", JSON.stringify({ assignment: { id: "legacy" }, session: { id: "legacy" } }));

    expect(loadPersistedState()).toBeNull();
  });
});
