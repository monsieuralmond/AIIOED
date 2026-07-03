const BROWSER_SESSION_KEY = "reading-coach-lab:browser-session:v1";

export type BrowserSessionIdentity = {
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly sessionId: string;
  readonly studentAnonymousId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isIdentity = (value: unknown): value is BrowserSessionIdentity => {
  if (!isRecord(value)) return false;
  return typeof value["assignmentId"] === "string" && typeof value["classGroupId"] === "string" && typeof value["sessionId"] === "string" && typeof value["studentAnonymousId"] === "string";
};

export const clearBrowserSessionIdentity = (): void => {
  if (typeof window.localStorage?.removeItem !== "function") return;
  window.localStorage.removeItem(BROWSER_SESSION_KEY);
};

export const loadBrowserSessionIdentity = (): BrowserSessionIdentity | null => {
  if (typeof window.localStorage?.getItem !== "function") return null;
  const raw = window.localStorage.getItem(BROWSER_SESSION_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveBrowserSessionIdentity = (identity: BrowserSessionIdentity): void => {
  if (typeof window.localStorage?.setItem !== "function") return;
  window.localStorage.setItem(BROWSER_SESSION_KEY, JSON.stringify(identity));
};
