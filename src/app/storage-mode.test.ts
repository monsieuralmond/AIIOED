import { describe, expect, it } from "vitest";
import { localResearchStorageEnabled } from "./storage-mode.js";

describe("storage mode", () => {
  it("allows local research storage only during development", () => {
    expect(localResearchStorageEnabled({ DEV: true, VITE_USE_LOCAL_RESEARCH_STORAGE: "1" })).toBe(true);
    expect(localResearchStorageEnabled({ DEV: false, VITE_USE_LOCAL_RESEARCH_STORAGE: "1" })).toBe(false);
  });
});
