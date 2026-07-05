import type { JsonHandler } from "./http.js";
import { ApiError } from "./http.js";
import { researchServerEnv } from "./env.js";
import {
  artifactWriteSchema,
  chatTurnWriteSchema,
  deleteTestDataSchema,
  eventWriteSchema,
  exportSchema,
  measureWriteSchema,
  rosterLoadSchema,
  rosterUpsertSchema,
  sessionStartSchema,
  stageUpdateSchema
} from "./schemas.js";
import type { ResearchStore } from "./store.js";
import { createSupabaseResearchStore } from "./supabase-store.js";
import { loadRoster, upsertRoster } from "./roster-handlers.js";
import { issueSessionToken, requireSessionAuth, requireTeacherAuth, teacherAuthFromRequest } from "./auth.js";
import { researchDeploymentHealth } from "./health.js";
import { createChatHandler } from "./chat-handler.js";

const storeFromEnv = (): ResearchStore => {
  const env = researchServerEnv();
  return createSupabaseResearchStore({
    serviceRoleKey: env.supabaseServiceRoleKey,
    url: env.supabaseUrl
  });
};

export const createResearchApiHandlers = (storeFactory: () => ResearchStore = storeFromEnv): {
  readonly artifact: JsonHandler;
  readonly chat: JsonHandler;
  readonly chatTurn: JsonHandler;
  readonly deleteTestData: JsonHandler;
  readonly event: JsonHandler;
  readonly exportData: JsonHandler;
  readonly health: JsonHandler;
  readonly measure: JsonHandler;
  readonly rosterLoad: JsonHandler;
  readonly rosterUpsert: JsonHandler;
  readonly sessionList: JsonHandler;
  readonly sessionStart: JsonHandler;
  readonly updateStage: JsonHandler;
} => ({
  artifact: async (payload, request) => {
    const input = artifactWriteSchema.parse(payload);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    await store.insertArtifact({
      id: input.id,
      kind: input.kind,
      payload: input.payload,
      sessionId: input.sessionId,
      stage: input.stage,
      ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp }),
      ...(input.updatedAt === undefined ? {} : { updatedAt: input.updatedAt })
    });
    return { ok: true };
  },

  chat: createChatHandler(storeFactory),

  chatTurn: async (payload, request) => {
    const input = chatTurnWriteSchema.parse(payload);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    await store.insertChatTurn({
      id: input.id,
      role: input.role,
      sessionId: input.sessionId,
      stage: input.stage,
      text: input.text,
      timestamp: input.timestamp ?? new Date().toISOString(),
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      ...(input.responseType === undefined ? {} : { responseType: input.responseType })
    });
    return { ok: true };
  },

  deleteTestData: async (payload, request) => {
    const input = deleteTestDataSchema.parse(payload);
    const auth = teacherAuthFromRequest(request);
    const teacherId = input.teacherId ?? auth?.teacherId;
    if (teacherId === undefined) throw new ApiError(401, "Teacher authorization is required.");
    requireTeacherAuth(request, teacherId);
    return storeFactory().deleteTestData({
      confirmExported: input.confirmExported,
      scope: input.scope,
      ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
      ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(input.studentAnonymousId === undefined ? {} : { studentAnonymousId: input.studentAnonymousId }),
      teacherId
    });
  },

  event: async (payload, request) => {
    const input = eventWriteSchema.parse(payload);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    await store.insertEvent({
      id: input.id,
      payload: input.payload,
      sessionId: input.sessionId,
      stage: input.stage,
      ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp }),
      type: input.type
    });
    return { ok: true };
  },

  exportData: async (payload, request) => {
    const input = exportSchema.parse(payload);
    const auth = teacherAuthFromRequest(request);
    const teacherId = input.teacherId ?? auth?.teacherId;
    if (teacherId === undefined) throw new ApiError(401, "Teacher authorization is required.");
    requireTeacherAuth(request, teacherId);
    return storeFactory().exportData({
      anonymized: input.anonymized,
      completedOnly: input.completedOnly,
      ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
      ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
      teacherId
    });
  },

  health: async (_payload, request) => {
    const auth = teacherAuthFromRequest(request);
    if (auth === null) throw new ApiError(401, "Teacher authorization is required.");
    requireTeacherAuth(request, auth.teacherId);
    return researchDeploymentHealth();
  },

  measure: async (payload, request) => {
    const input = measureWriteSchema.parse(payload);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    await store.insertMeasure({
      id: input.id,
      kind: input.kind,
      payload: input.payload,
      sessionId: input.sessionId,
      stage: input.stage,
      ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp })
    });
    return { ok: true };
  },

  rosterLoad: async (payload, request) => {
    const input = rosterLoadSchema.parse(payload);
    const auth = teacherAuthFromRequest(request);
    const teacherId = input.teacherId ?? auth?.teacherId;
    if (teacherId === undefined) throw new ApiError(401, "Teacher authorization is required.");
    requireTeacherAuth(request, teacherId);
    return loadRoster({ teacherId }, request);
  },

  rosterUpsert: async (payload, request) => {
    const input = rosterUpsertSchema.parse(payload);
    const auth = teacherAuthFromRequest(request);
    const teacherId = input.teacherId ?? auth?.teacherId;
    if (teacherId === undefined) throw new ApiError(401, "Teacher authorization is required.");
    requireTeacherAuth(request, teacherId);
    return upsertRoster({ ...input, teacherId }, request);
  },

  sessionList: async (payload, request) => {
    const input = exportSchema.parse(payload);
    if (input.teacherId !== undefined) requireTeacherAuth(request, input.teacherId);
    const auth = teacherAuthFromRequest(request);
    const teacherId = input.teacherId ?? auth?.teacherId;
    if (teacherId === undefined) throw new ApiError(401, "Teacher authorization is required.");
    requireTeacherAuth(request, teacherId);
    return storeFactory().listSessions({
      ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
      ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
      teacherId
    });
  },

  sessionStart: async (payload, request) => {
    const input = sessionStartSchema.parse(payload);
    const store = storeFactory();
    const teacherAuth = "sessionId" in input ? null : teacherAuthFromRequest(request);
    if (teacherAuth !== null) requireTeacherAuth(request, teacherAuth.teacherId);
    const result = "sessionId" in input
      ? await store.resumeSession(input.sessionId)
      : await store.startSession({
        ...(input.loginId === undefined ? {} : { loginId: input.loginId }),
        participantCode: input.participantCode,
        ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
        ...(input.password === undefined ? {} : { password: input.password }),
        ...(teacherAuth === null ? {} : { teacherId: teacherAuth.teacherId })
      });
    if ("sessionId" in input) requireSessionAuth(request, result.context);
    return {
      assignment: result.assignment,
      classGroupId: result.context.classGroupId,
      session: result.session,
      sessionId: result.context.sessionId,
      sessionToken: issueSessionToken(result.context),
      studentAnonymousId: result.context.studentAnonymousId
    };
  },

  updateStage: async (payload, request) => {
    const input = stageUpdateSchema.parse(payload);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    return store.updateStage({
      currentStage: input.currentStage,
      sessionId: input.sessionId,
      ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
      ...(input.status === undefined ? {} : { status: input.status })
    });
  }
});
