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
  sessionResetSchema,
  sessionStartSchema,
  sessionDeltaSchema,
  stageUpdateSchema
} from "./schemas.js";
import { assertSessionWritable } from "./store.js";
import type { ResearchStore } from "./store.js";
import { createSupabaseResearchStore } from "./supabase-store.js";
import { loadRoster, upsertRoster, upsertRosterDelta } from "./roster-handlers.js";
import { adminAuthFromRequest, issueSessionToken, requireAdminAuth, requireSessionAuth, requireSessionIdAuth, requireTeacherAuth, teacherAuthFromRequest } from "./auth.js";
import { researchDeploymentHealth } from "./health.js";
import { createChatHandler } from "./chat-handler.js";

const storeFromEnv = (): ResearchStore => {
  const env = researchServerEnv();
  return createSupabaseResearchStore({
    serviceRoleKey: env.supabaseServiceRoleKey,
    url: env.supabaseUrl
  });
};

const transientStatusCodes = new Set([503, 504]);

const retryTransientSessionStart = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof ApiError) || !transientStatusCodes.has(error.statusCode)) throw error;
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    return operation();
  }
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
  readonly rosterUpsertDelta: JsonHandler;
  readonly rosterUpsert: JsonHandler;
  readonly sessionList: JsonHandler;
  readonly sessionReset: JsonHandler;
  readonly sessionStart: JsonHandler;
  readonly sessionSync: JsonHandler;
  readonly updateStage: JsonHandler;
} => ({
  artifact: async (payload, request) => {
    const input = artifactWriteSchema.parse(payload);
    requireSessionIdAuth(request, input.sessionId);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    assertSessionWritable(context);
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
    requireSessionIdAuth(request, input.sessionId);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    assertSessionWritable(context);
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
    requireAdminAuth(request);
    return storeFactory().deleteTestData({
      confirmExported: input.confirmExported,
      scope: input.scope,
      ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
      ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(input.studentAnonymousId === undefined ? {} : { studentAnonymousId: input.studentAnonymousId }),
      ...(input.teacherId === undefined ? {} : { teacherId: input.teacherId })
    });
  },

  event: async (payload, request) => {
    const input = eventWriteSchema.parse(payload);
    requireSessionIdAuth(request, input.sessionId);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    assertSessionWritable(context);
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
    requireAdminAuth(request);
    return storeFactory().exportData({
      anonymized: input.anonymized,
      completedOnly: input.completedOnly,
      ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
      ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
      ...(input.teacherId === undefined ? {} : { teacherId: input.teacherId })
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
    requireSessionIdAuth(request, input.sessionId);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    assertSessionWritable(context);
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
    rosterLoadSchema.parse(payload);
    return loadRoster(payload, request);
  },

  rosterUpsert: async (payload, request) => {
    rosterUpsertSchema.parse(payload);
    return upsertRoster(payload, request);
  },

  rosterUpsertDelta: async (payload, request) => {
    rosterUpsertSchema.parse(payload);
    return upsertRosterDelta(payload, request);
  },

  sessionList: async (payload, request) => {
    const input = exportSchema.parse(payload);
    const adminAuth = adminAuthFromRequest(request);
    if (adminAuth !== null) {
      requireAdminAuth(request);
      return storeFactory().listSessions({
        ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
        ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
        ...(input.teacherId === undefined ? {} : { teacherId: input.teacherId })
      });
    }
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

  sessionReset: async (payload, request) => {
    const input = sessionResetSchema.parse(payload);
    const auth = teacherAuthFromRequest(request);
    if (auth === null) throw new ApiError(401, "Teacher authorization is required.");
    requireTeacherAuth(request, auth.teacherId);
    return storeFactory().resetStudentSession({
      sessionId: input.sessionId,
      teacherId: auth.teacherId
    });
  },

  sessionStart: async (payload, request) => {
    const input = sessionStartSchema.parse(payload);
    const store = storeFactory();
    const teacherAuth = "sessionId" in input ? null : teacherAuthFromRequest(request);
    if (teacherAuth !== null) requireTeacherAuth(request, teacherAuth.teacherId);
    if ("sessionId" in input) requireSessionIdAuth(request, input.sessionId);
    const result = "sessionId" in input
      ? await store.resumeSession(input.sessionId)
      : await retryTransientSessionStart(() => store.startSession({
        ...(input.loginId === undefined ? {} : { loginId: input.loginId }),
        ...(input.participantCode === undefined ? {} : { participantCode: input.participantCode }),
        ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
        ...(input.password === undefined ? {} : { password: input.password }),
        ...(teacherAuth === null ? {} : { teacherId: teacherAuth.teacherId })
      }));
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

  sessionSync: async (payload, request) => {
    const input = sessionDeltaSchema.parse(payload);
    requireSessionIdAuth(request, input.sessionId);
    const store = storeFactory();
    if (store.syncSessionDelta !== undefined) {
      await store.syncSessionDelta(input);
      return { ok: true };
    }
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    assertSessionWritable(context);
    for (const turn of input.chatTurns) {
      await store.insertChatTurn({
        id: turn.id,
        ...(turn.requestId === undefined ? {} : { requestId: turn.requestId }),
        ...(turn.responseType === undefined ? {} : { responseType: turn.responseType }),
        role: turn.role,
        sessionId: input.sessionId,
        stage: context.currentStage,
        text: turn.text,
        timestamp: turn.timestamp
      });
    }
    for (const event of input.events) await store.insertEvent({ ...event, sessionId: input.sessionId });
    for (const artifact of input.artifacts) await store.insertArtifact({
      id: artifact.id,
      kind: artifact.kind,
      payload: artifact.payload,
      sessionId: input.sessionId,
      stage: artifact.stage,
      timestamp: artifact.createdAt,
      ...(artifact.updatedAt === undefined ? {} : { updatedAt: artifact.updatedAt })
    });
    for (const measure of input.measures) await store.insertMeasure({
      id: measure.id,
      kind: measure.kind,
      payload: measure.payload,
      sessionId: input.sessionId,
      stage: measure.stage,
      timestamp: measure.collectedAt
    });
    await store.updateStage({
      currentStage: input.currentStage,
      sessionId: input.sessionId,
      ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
      status: input.status
    });
    return { ok: true };
  },

  updateStage: async (payload, request) => {
    const input = stageUpdateSchema.parse(payload);
    requireSessionIdAuth(request, input.sessionId);
    const store = storeFactory();
    const { context } = await store.resumeSession(input.sessionId);
    requireSessionAuth(request, context);
    assertSessionWritable(context);
    return store.updateStage({
      currentStage: input.currentStage,
      sessionId: input.sessionId,
      ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
      ...(input.status === undefined ? {} : { status: input.status })
    });
  }
});
