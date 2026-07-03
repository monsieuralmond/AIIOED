import { beforeEach, describe, expect, it } from "vitest";
import { createInitialPilotState } from "./session.js";
import { loadBrowserSessionIdentity, saveBrowserSessionIdentity } from "./browser-session.js";
import { loadPersistedState, savePersistedState } from "./storage.js";

describe("browser storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not persist class-level pilot state in localStorage", () => {
    const state = createInitialPilotState();

    savePersistedState(state);

    expect(window.localStorage.getItem("reading-coach-lab:v1")).toBeNull();
    expect(loadPersistedState()).toBeNull();
  });

  it("ignores malformed stored state", () => {
    window.localStorage.setItem("reading-coach-lab:v1", "{\"assignment\":null}");

    expect(loadPersistedState()).toBeNull();
  });

  it("removes legacy class-level state instead of migrating it", () => {
    const state = createInitialPilotState();
    window.localStorage.setItem("reading-coach-lab:v1", JSON.stringify(state));

    expect(loadPersistedState()).toBeNull();
    expect(window.localStorage.getItem("reading-coach-lab:v1")).toBeNull();
  });

  it("stores only the browser session identity needed to resume", () => {
    saveBrowserSessionIdentity({
      assignmentId: "assignment-a",
      classGroupId: "class-a",
      sessionId: "session-a",
      studentAnonymousId: "student-anon-a"
    });

    expect(loadBrowserSessionIdentity()).toEqual({
      assignmentId: "assignment-a",
      classGroupId: "class-a",
      sessionId: "session-a",
      studentAnonymousId: "student-anon-a"
    });
    expect(window.localStorage.getItem("reading-coach-lab:v1")).toBeNull();
  });

  it("does not migrate a legacy single-session value into an unrelated user", () => {
    window.localStorage.setItem("reading-coach-lab:v1", JSON.stringify({ assignment: { id: "legacy" }, session: { id: "legacy" } }));

    expect(loadPersistedState()).toBeNull();
  });
});
