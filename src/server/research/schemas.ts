import { z } from "zod";

export const sessionStartSchema = z.union([
  z.object({
    assignmentId: z.string().optional(),
    participantCode: z.string().min(1)
  }),
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

const rosterClassSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  teacherId: z.string().min(1)
});

const rosterAssignmentSchema = z.object({
  classGroupId: z.string().min(1),
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
  participantCode: z.string().min(1),
  studentAnonymousId: z.string().min(1)
});

export const rosterUpsertSchema = z.object({
  assignments: z.array(rosterAssignmentSchema).default([]),
  classes: z.array(rosterClassSchema).default([]),
  students: z.array(rosterStudentSchema).default([])
});

export type ArtifactWriteInput = z.infer<typeof artifactWriteSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
export type DeleteTestDataInput = z.infer<typeof deleteTestDataSchema>;
export type EventWriteInput = z.infer<typeof eventWriteSchema>;
export type ExportInput = z.infer<typeof exportSchema>;
export type MeasureWriteInput = z.infer<typeof measureWriteSchema>;
export type SessionStartInput = z.infer<typeof sessionStartSchema>;
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;
export type RosterUpsertInput = z.infer<typeof rosterUpsertSchema>;
