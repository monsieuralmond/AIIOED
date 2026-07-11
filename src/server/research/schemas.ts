import { z } from "zod";

const participantSessionStartSchema = z.object({
  assignmentId: z.string().optional(),
  loginId: z.string().min(1).optional(),
  participantCode: z.string().min(1).optional(),
  password: z.string().min(1).optional()
}).refine((input) => input.participantCode !== undefined || (input.loginId !== undefined && input.password !== undefined), {
  message: "Participant code or student credentials are required."
});

export const sessionStartSchema = z.union([
  participantSessionStartSchema,
  z.object({
    sessionId: z.string().min(1)
  })
]);

export const stageUpdateSchema = z.object({
  completedAt: z.string().optional(),
  currentStage: z.string().min(1),
  sessionId: z.string().min(1),
  status: z.string().min(1).optional()
});

const sessionDeltaChatTurnSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1).optional(),
  responseType: z.enum(["clarify", "question", "evidence_check", "redirect", "revision_guidance", "refusal"]).optional(),
  role: z.enum(["student", "assistant"]),
  text: z.string(),
  timestamp: z.string()
});

const sessionDeltaEventSchema = z.object({
  id: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  stage: z.string().min(1),
  timestamp: z.string(),
  type: z.string().min(1)
});

const sessionDeltaArtifactSchema = z.object({
  createdAt: z.string(),
  id: z.string().min(1),
  kind: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  stage: z.string().min(1),
  updatedAt: z.string().optional()
});

const sessionDeltaMeasureSchema = z.object({
  collectedAt: z.string(),
  id: z.string().min(1),
  kind: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  stage: z.string().min(1)
});

export const sessionDeltaSchema = z.object({
  artifacts: z.array(sessionDeltaArtifactSchema).default([]),
  chatTurns: z.array(sessionDeltaChatTurnSchema).default([]),
  completedAt: z.string().optional(),
  currentStage: z.string().min(1),
  events: z.array(sessionDeltaEventSchema).default([]),
  measures: z.array(sessionDeltaMeasureSchema).default([]),
  sessionId: z.string().min(1),
  status: z.string().min(1)
});

export const eventWriteSchema = z.object({
  id: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  sessionId: z.string().min(1),
  stage: z.string().min(1),
  timestamp: z.string().optional(),
  type: z.string().min(1)
});

export const artifactWriteSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  sessionId: z.string().min(1),
  stage: z.string().min(1),
  timestamp: z.string().optional(),
  updatedAt: z.string().optional()
});

export const measureWriteSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  sessionId: z.string().min(1),
  stage: z.string().min(1),
  timestamp: z.string().optional()
});

export const chatSchema = z.object({
  message: z.string().min(1),
  requestId: z.string().min(1),
  sessionId: z.string().min(1)
});

export const chatTurnWriteSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1).optional(),
  responseType: z.enum(["clarify", "question", "evidence_check", "redirect", "revision_guidance", "refusal"]).optional(),
  role: z.enum(["student", "assistant"]),
  sessionId: z.string().min(1),
  stage: z.string().min(1),
  text: z.string(),
  timestamp: z.string().optional()
});

export const exportSchema = z.object({
  anonymized: z.boolean().default(true),
  assignmentId: z.string().optional(),
  classGroupId: z.string().optional(),
  completedOnly: z.boolean().default(true),
  teacherId: z.string().optional()
});

export const deleteTestDataSchema = z.object({
  assignmentId: z.string().optional(),
  classGroupId: z.string().optional(),
  confirmExported: z.boolean().default(false),
  reason: z.string().optional(),
  scope: z.enum(["current_session", "student", "assignment", "all_test_data"]),
  sessionId: z.string().optional(),
  studentAnonymousId: z.string().optional(),
  teacherId: z.string().optional()
});

export const sessionResetSchema = z.object({
  sessionId: z.string().min(1)
});

const rosterClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  teacherId: z.string().min(1)
});

const rosterAssignmentSchema = z.object({
  classGroupId: z.string().min(1).optional(),
  createdByTeacherId: z.string().min(1),
  id: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  researchCondition: z.string().min(1),
  researchMode: z.string().min(1),
  title: z.string().min(1)
});

const rosterStudentSchema = z.object({
  classGroupId: z.string().min(1),
  displayLabel: z.string().optional(),
  id: z.string().min(1),
  loginId: z.string().min(1).optional(),
  participantCode: z.string().min(1),
  password: z.string().min(1).optional(),
  studentAnonymousId: z.string().min(1),
  studentNumber: z.number().int().positive().optional()
});

const rosterTeacherSchema = z.object({
  displayName: z.string().min(1),
  id: z.string().min(1),
  loginId: z.string().min(1),
  password: z.string().min(1).optional()
});

export const rosterUpsertSchema = z.object({
  assignments: z.array(rosterAssignmentSchema).default([]),
  classes: z.array(rosterClassSchema).default([]),
  deletedAssignmentIds: z.array(z.string().min(1)).default([]),
  deletedClassIds: z.array(z.string().min(1)).default([]),
  deletedStudentIds: z.array(z.string().min(1)).default([]),
  deletedTeacherIds: z.array(z.string().min(1)).default([]),
  expectedRosterRevision: z.string().min(1).optional(),
  students: z.array(rosterStudentSchema).default([]),
  teacherId: z.string().min(1).optional(),
  teachers: z.array(rosterTeacherSchema).default([])
});

export const rosterLoadSchema = z.object({
  teacherId: z.string().min(1).optional()
});

export type ArtifactWriteInput = z.infer<typeof artifactWriteSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
export type ChatTurnWriteInput = z.infer<typeof chatTurnWriteSchema>;
export type DeleteTestDataInput = z.infer<typeof deleteTestDataSchema>;
export type EventWriteInput = z.infer<typeof eventWriteSchema>;
export type ExportInput = z.infer<typeof exportSchema>;
export type MeasureWriteInput = z.infer<typeof measureWriteSchema>;
export type RosterLoadInput = z.infer<typeof rosterLoadSchema>;
export type SessionResetInput = z.infer<typeof sessionResetSchema>;
export type SessionStartInput = z.infer<typeof sessionStartSchema>;
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;
export type SessionDeltaInput = z.infer<typeof sessionDeltaSchema>;
export type RosterUpsertInput = z.infer<typeof rosterUpsertSchema>;
