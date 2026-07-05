import type { SelectedActor } from "../shared/types.js";

const BROWSER_ACTOR_KEY = "reading-coach-lab:browser-actor:v1";
const BROWSER_SESSION_KEY = "reading-coach-lab:browser-session:v1";
const BROWSER_SESSION_TOKEN_KEY = "reading-coach-lab:browser-session-token:v1";
const BROWSER_TEACHER_AUTH_KEY = "reading-coach-lab:browser-teacher-auth:v1";

export type BrowserActorIdentity = SelectedActor;

export type BrowserSessionIdentity = {
  readonly assignmentId: string;
  readonly classGroupId: string;
  readonly sessionId: string;
  readonly studentAnonymousId: string;
};

export type BrowserTeacherAuth = {
  readonly teacherId: string;
  readonly teacherToken: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isActorIdentity = (value: unknown): value is BrowserActorIdentity => {
  if (!isRecord(value)) return false;
  const role = value["role"];
  return (role === "teacher" || role === "student") && typeof value["accountId"] === "string";
};

const isIdentity = (value: unknown): value is BrowserSessionIdentity => {
  if (!isRecord(value)) return false;
  return typeof value["assignmentId"] === "string" && typeof value["classGroupId"] === "string" && typeof value["sessionId"] === "string" && typeof value["studentAnonymousId"] === "string";
};

const isTeacherAuth = (value: unknown): value is BrowserTeacherAuth =>
  isRecord(value) && typeof value["teacherId"] === "string" && typeof value["teacherToken"] === "string";

export const clearBrowserActorIdentity = (): void => {
  if (typeof window.sessionStorage?.removeItem !== "function") return;
  window.sessionStorage.removeItem(BROWSER_ACTOR_KEY);
};

export const clearBrowserSessionIdentity = (): void => {
  if (typeof window.localStorage?.removeItem !== "function") return;
  window.localStorage.removeItem(BROWSER_SESSION_KEY);
};

export const clearBrowserSessionToken = (): void => {
  if (typeof window.localStorage?.removeItem === "function") window.localStorage.removeItem(BROWSER_SESSION_TOKEN_KEY);
  if (typeof window.sessionStorage?.removeItem === "function") window.sessionStorage.removeItem(BROWSER_SESSION_TOKEN_KEY);
};

export const clearBrowserTeacherAuth = (): void => {
  if (typeof window.sessionStorage?.removeItem !== "function") return;
  window.sessionStorage.removeItem(BROWSER_TEACHER_AUTH_KEY);
};

export const loadBrowserActorIdentity = (): BrowserActorIdentity | null => {
  if (typeof window.sessionStorage?.getItem !== "function") return null;
  const raw = window.sessionStorage.getItem(BROWSER_ACTOR_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isActorIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

export const loadBrowserSessionToken = (): string | null => {
  if (typeof window.localStorage?.removeItem === "function") window.localStorage.removeItem(BROWSER_SESSION_TOKEN_KEY);
  const token = typeof window.sessionStorage?.getItem === "function" ? window.sessionStorage.getItem(BROWSER_SESSION_TOKEN_KEY) : null;
  return token === null || token.trim().length === 0 ? null : token;
};

export const loadBrowserTeacherAuth = (): BrowserTeacherAuth | null => {
  if (typeof window.sessionStorage?.getItem !== "function") return null;
  const raw = window.sessionStorage.getItem(BROWSER_TEACHER_AUTH_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTeacherAuth(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveBrowserSessionIdentity = (identity: BrowserSessionIdentity): void => {
  if (typeof window.localStorage?.setItem !== "function") return;
  window.localStorage.setItem(BROWSER_SESSION_KEY, JSON.stringify(identity));
};

export const saveBrowserActorIdentity = (identity: BrowserActorIdentity): void => {
  if (typeof window.sessionStorage?.setItem !== "function") return;
  window.sessionStorage.setItem(BROWSER_ACTOR_KEY, JSON.stringify(identity));
};

export const saveBrowserSessionToken = (token: string): void => {
  if (typeof window.localStorage?.removeItem === "function") window.localStorage.removeItem(BROWSER_SESSION_TOKEN_KEY);
  if (typeof window.sessionStorage?.setItem === "function") window.sessionStorage.setItem(BROWSER_SESSION_TOKEN_KEY, token);
};

export const saveBrowserTeacherAuth = (auth: BrowserTeacherAuth): void => {
  if (typeof window.sessionStorage?.setItem !== "function") return;
  window.sessionStorage.setItem(BROWSER_TEACHER_AUTH_KEY, JSON.stringify(auth));
};
