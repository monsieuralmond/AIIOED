import type { Assignment, ChatRole, CoachResponseType, FinalSubmission, LlmMode, Outline, PasteEvent, PilotEvent, PilotEventType, PilotSession, ReviewSuggestion, Stage, StudentAccount, TeacherReviewNote, TeacherReviewUpdate } from "../shared/types.js";
import { ResearchModes, UnderstandingCalibrationStages } from "../shared/research.js";
import { initialResearchSessionFields, normalizeAssignmentResearchMode } from "./research-session.js";

export { deleteClassGroup, deleteStudentAccount, deleteTeacherAccount } from "./pilot-delete.js";
export { activeSession, assignmentsForStudent, createClassGroup, createInitialPilotState, createStudentAccount, createTeacherAccount, PilotStateError, requireAssignment, saveAssignmentInState, selectActor, sessionForStudent, sessionStatus, startStudentSession, studentByCredentials, studentByParticipantCode, teacherByCredentials, updatePilotSession } from "./pilot-state.js";
export type { CreateClassGroupInput, CreateStudentInput, CreateTeacherInput } from "./pilot-state.js";
export { researchModeForAssignment } from "./research-session.js";

const APP_VERSION = "0.1.0";

const nowIso = (): string => new Date().toISOString();

const makeId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;

const event = (type: PilotEventType, stage: Stage, payload: Record<string, unknown> = {}): PilotEvent => ({
  id: makeId("event"),
  type,
  timestamp: nowIso(),
  stage,
  payload
});

const touchSession = (): Pick<PilotSession, "updatedAt"> => ({
  updatedAt: nowIso()
});

export const createSession = (assignment: Assignment, student?: StudentAccount): PilotSession => {
  const createdAt = nowIso();
  const normalizedAssignment = normalizeAssignmentResearchMode(assignment);
  const researchFields = initialResearchSessionFields(normalizedAssignment, createdAt);
  const sessionStudent: PilotSession["student"] =
    student === undefined ? { anonymousId: makeId("student") } : { anonymousId: student.id, accountId: student.id, displayName: student.displayName };
  return {
    sessionId: makeId("session"),
    assignment: normalizedAssignment,
    ...researchFields,
    student: sessionStudent,
    currentStage: researchFields.researchMode === ResearchModes.understandingCalibration ? UnderstandingCalibrationStages.preSurvey : "reading",
    events: [],
    chatTurns: [],
    outlineSnapshots: [],
    draftSnapshots: [],
    pasteEvents: [],
    finalSubmission: null,
    teacherReview: {
      note: "",
      status: "not_reviewed",
      updatedAt: createdAt,
      updatedByTeacherId: null
    },
    metadata: {
      appVersion: APP_VERSION,
      llmMode: "mock",
      model: "mock-writing-coach-v0",
      createdAt
    }
  };
};

export const enterStage = (session: PilotSession, stage: Stage): PilotSession => {
  const completion = session.currentStage === stage ? [] : [event("stage_completed", session.currentStage, { stage: session.currentStage })];
  return {
    ...session,
    currentStage: stage,
    ...touchSession(),
    events: [...session.events, ...completion, event("stage_entered", stage, { stage })]
  };
};

export const updateOutline = (session: PilotSession, outline: Outline): PilotSession => ({
  ...session,
  ...touchSession(),
  outlineSnapshots: [...session.outlineSnapshots, outline],
  events: [
    ...session.events,
    event("outline_edited", "thinking", { outline }),
    ...(outline.claim.trim().length > 0 ? [event("claim_revised", "thinking", { claim: outline.claim })] : []),
    ...(outline.evidence.filter((item) => item.trim().length > 0).length > 0 ? [event("evidence_added", "thinking", { evidence: outline.evidence })] : []),
    ...(outline.question.trim().length > 0 ? [event("source_added", "thinking", { source: outline.question })] : []),
    ...(outline.counterargument.trim().length > 0 ? [event("counterargument_added", "thinking", { counterargument: outline.counterargument })] : [])
  ]
});

export const outlineMissingFields = (outline: Outline): readonly string[] => {
  const missing: string[] = [];
  if (outline.claim.trim().length < 10) missing.push("claim");
  if (outline.evidence.filter((item) => item.trim().length > 0).length < 2) missing.push("evidence");
  if (outline.question.trim().length < 2) missing.push("source");
  if (outline.reasoning.trim().length < 20) missing.push("reasoning");
  if (outline.counterargument.trim().length === 0) missing.push("counterargument");
  return missing;
};

export const warnWeakOutline = (session: PilotSession, outline: Outline): PilotSession => ({
  ...session,
  ...touchSession(),
  events: [...session.events, event("outline_warning_shown", "thinking", { missing: outlineMissingFields(outline), stage: "thinking" })]
});

export const addChatTurn = (session: PilotSession, role: ChatRole, text: string): PilotSession => ({
  ...session,
  ...touchSession(),
  chatTurns: [...session.chatTurns, { id: makeId("chat"), role, text, timestamp: nowIso() }],
  events: [...session.events, event(role === "student" ? "student_message" : "assistant_message", session.currentStage, { text })]
});

export const addAssistantCoachTurn = (session: PilotSession, text: string, responseType: CoachResponseType): PilotSession => ({
  ...session,
  ...touchSession(),
  chatTurns: [...session.chatTurns, { id: makeId("chat"), responseType, role: "assistant", text, timestamp: nowIso() }],
  events: [...session.events, event("assistant_message", session.currentStage, { responseType, text })]
});

export const updateSessionLlmMetadata = (session: PilotSession, llmMode: LlmMode, model: string): PilotSession => ({
  ...session,
  ...touchSession(),
  metadata: {
    ...session.metadata,
    llmMode,
    model
  }
});

export const updateDraft = (session: PilotSession, text: string): PilotSession => ({
  ...session,
  ...touchSession(),
  draftSnapshots: [...session.draftSnapshots, { id: makeId("draft"), timestamp: nowIso(), text }],
  events: [...session.events, event("draft_edited", "writing", { length: text.length })]
});

export const recordPaste = (session: PilotSession, text: string): PilotSession => {
  const paste: PasteEvent = {
    id: makeId("paste"),
    timestamp: nowIso(),
    stage: "writing",
    target: "draft",
    textLength: text.length,
    lineCount: text.split(/\r?\n/).length,
    textPreviewFirst80: text.slice(0, 80),
    fromClipboard: true
  };
  return { ...session, ...touchSession(), pasteEvents: [...session.pasteEvents, paste], events: [...session.events, event("paste_detected", "writing", paste)] };
};

export const recordFeedbackGenerated = (session: PilotSession, suggestions: readonly ReviewSuggestion[]): PilotSession => ({
  ...session,
  ...touchSession(),
  events: [
    ...session.events,
    event("feedback_generated", "review", { suggestions: suggestions.map(reviewSuggestionPayload), suggestionIds: suggestions.map((suggestion) => suggestion.id), count: suggestions.length }),
    event("feedback_viewed", "review", { suggestions: suggestions.map(reviewSuggestionPayload), suggestionIds: suggestions.map((suggestion) => suggestion.id), count: suggestions.length })
  ]
});

const reviewSuggestionPayload = (suggestion: ReviewSuggestion): Record<string, unknown> => ({
  id: suggestion.id,
  category: suggestion.category,
  text: suggestion.text,
  focusLabel: suggestion.focusLabel,
  resolved: suggestion.resolved
});

export const resolveSuggestion = (session: PilotSession, suggestion: ReviewSuggestion): PilotSession => ({
  ...session,
  ...touchSession(),
  events: [...session.events, event("suggestion_resolved", "review", { suggestionId: suggestion.id, category: suggestion.category })]
});

export const recordSuggestionCheck = (session: PilotSession, suggestion: ReviewSuggestion, result: { readonly message: string; readonly resolved: boolean }): PilotSession => ({
  ...session,
  ...touchSession(),
  events: [
    ...session.events,
    event("suggestion_checked", "review", {
      category: suggestion.category,
      message: result.message,
      resolved: result.resolved,
      suggestionId: suggestion.id
    })
  ]
});

export const updateTeacherReview = (session: PilotSession, teacherId: string, input: TeacherReviewUpdate): PilotSession => {
  const teacherReview: TeacherReviewNote = {
    note: input.note.trim(),
    status: input.status,
    updatedAt: nowIso(),
    updatedByTeacherId: teacherId
  };
  return {
    ...session,
    teacherReview,
    ...touchSession(),
    events: [...session.events, event("teacher_review_updated", "review", teacherReview)]
  };
};

export const submitFinal = (session: PilotSession, text: string): PilotSession => {
  const finalSubmission: FinalSubmission = { text, submittedAt: nowIso() };
  return {
    ...session,
    completedAt: finalSubmission.submittedAt,
    finalSubmission,
    status: "submitted",
    updatedAt: finalSubmission.submittedAt,
    events: [...session.events, event("stage_completed", "review", { stage: "review" }), event("submission_created", "review", { submittedAt: finalSubmission.submittedAt })]
  };
};

export const latestDraft = (session: PilotSession): string => session.draftSnapshots.at(-1)?.text ?? "";

export const latestOutline = (session: PilotSession): Outline | null => session.outlineSnapshots.at(-1) ?? null;
