import { beforeEach, describe, expect, it } from "vitest";
import { createInitialPilotState } from "./session";
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

  it("does not migrate a legacy single-session value into an unrelated user", () => {
    window.localStorage.setItem("reading-coach-lab:v1", JSON.stringify({ assignment: { id: "legacy" }, session: { id: "legacy" } }));

    expect(loadPersistedState()).toBeNull();
  });
});
