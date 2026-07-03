import type { UnderstandingCalibrationEventType } from "./research.js";

type WritingCoachEventType =
  | "stage_entered"
  | "stage_completed"
  | "student_message"
  | "assistant_message"
  | "outline_edited"
  | "claim_revised"
  | "evidence_added"
  | "source_added"
  | "counterargument_added"
  | "draft_edited"
  | "paste_detected"
  | "outline_warning_shown"
  | "feedback_generated"
  | "feedback_viewed"
  | "suggestion_checked"
  | "suggestion_resolved"
  | "submission_created"
  | "teacher_review_updated";

export type PilotEventType = WritingCoachEventType | UnderstandingCalibrationEventType;
