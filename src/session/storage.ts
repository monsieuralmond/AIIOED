import type { PilotState } from "../shared/types";

const LEGACY_STORAGE_KEY = "reading-coach-lab:v1";

const clearLegacyStorage = (): void => {
  if (typeof window.localStorage?.removeItem !== "function") return;
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
};

export const loadPersistedState = (): PilotState | null => {
  clearLegacyStorage();
  return null;
};

export const savePersistedState = (state: PilotState): void => {
  void state;
  clearLegacyStorage();
};
