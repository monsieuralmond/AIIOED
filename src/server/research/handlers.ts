import type { JsonHandler } from "./http";
import { ApiError } from "./http";
import { completeResearchChat } from "./openai-chat";
import { researchServerEnv } from "./env";
import {
  artifactWriteSchema,
  chatSchema,
  deleteTestDataSchema,
  eventWriteSchema,
  exportSchema,
  measureWriteSchema,
  rosterUpsertSchema,
  sessionStartSchema,
  stageUpdateSchema
} from "./schemas";
import { participantCodeHash, serverId } from "./store";
import type { ResearchStore } from "./store";
import { createSupabaseResearchStore } from "./supabase-store";
import { SupabaseRestClient } from "./supabase-rest";

const maxChatTurns = (): number => {
  const raw = process.env["MAX_CHAT_TURNS"];
  if (raw === undefined) return 20;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
};

const storeFromEnv = (): ResearchStore => {
  const env = researchServerEnv();
  return createSupabaseResearchStore({
    serviceRoleKey: env.supabaseServiceRoleKey,
    url: env.supabaseUrl
  });
};

const chatWithinLimits = (sessionCreatedAt: string, maxChatMinutes: number | undefined): boolean => {
  if (maxChatMinutes === undefined) return true;
  const elapsedMs = Date.now() - new Date(sessionCreatedAt).getTime();
  return elapsedMs <= maxChatMinutes * 60_000;
};

export const createResearchApiHandlers = (storeFactory: () => ResearchStore = storeFromEnv): {
  readonly artifact: JsonHandler;
  readonly chat: JsonHandler;
  readonly deleteTestData: JsonHandler;
  readonly event: JsonHandler;
  readonly exportData: JsonHandler;
  readonly measure: JsonHandler;
  readonly rosterUpsert: JsonHandler;
  readonly sessionStart: JsonHandler;
  readonly updateStage: JsonHandler;
} => ({
  artifact: async (payload) => {
    const input = artifactWriteSchema.parse(payload);
    await storeFactory().insertArtifact({
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

  chat: async (payload) => {
    const input = chatSchema.parse(payload);
    const env = researchServerEnv();
    const store = storeFactory();
    const existing = await store.findAssistantTurnByRequestId(input.sessionId, input.requestId);
    if (existing !== null) {
      return {
        llmMode: env.aiMode,
        model: env.aiMode === "mock" ? "mock-understanding-calibration-v0" : env.openAiModel,
        requestTags: [],
        text: existing.text,
        type: "clarify"
      };
    }
    const { session } = await store.resumeSession(input.sessionId);
    const studentTurns = session.chatTurns.filter((turn) => turn.role === "student").length;
    if (studentTurns >= maxChatTurns()) throw new ApiError(429, "Chat turn limit reached.");
    if (!chatWithinLimits(session.createdAt, session.assignment.calibrationConfig?.maxChatMinutes)) throw new ApiError(429, "Chat time limit reached.");
    const timestamp = new Date().toISOString();
    await store.insertChatTurn({
      id: serverId("chat"),
      requestId: input.requestId,
      role: "student",
      sessionId: input.sessionId,
      stage: session.currentStage,
      text: input.message,
      timestamp
    });
    const response = await completeResearchChat({
      ...(session.assignment.calibrationConfig?.aiContext === undefined ? {} : { aiContext: session.assignment.calibrationConfig.aiContext }),
      apiKey: env.openAiApiKey,
      assignment: session.assignment,
      history: session.chatTurns,
      message: input.message,
      mode: env.aiMode,
      model: env.openAiModel,
      researchCondition: session.researchCondition
    });
    await store.insertChatTurn({
      id: serverId("chat"),
      requestId: input.requestId,
      responseType: response.type,
      role: "assistant",
      sessionId: input.sessionId,
      stage: session.currentStage,
      text: response.text,
      timestamp: new Date().toISOString()
    });
    return response;
  },

  deleteTestData: async (payload) => {
    const input = deleteTestDataSchema.parse(payload);
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

  event: async (payload) => {
    const input = eventWriteSchema.parse(payload);
    await storeFactory().insertEvent({
      id: input.id,
      payload: input.payload,
      sessionId: input.sessionId,
      stage: input.stage,
      ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp }),
      type: input.type
    });
    return { ok: true };
  },

  exportData: async (payload) => {
    const input = exportSchema.parse(payload);
    return storeFactory().exportData({
      anonymized: input.anonymized,
      completedOnly: input.completedOnly,
      ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId }),
      ...(input.classGroupId === undefined ? {} : { classGroupId: input.classGroupId }),
      ...(input.teacherId === undefined ? {} : { teacherId: input.teacherId })
    });
  },

  measure: async (payload) => {
    const input = measureWriteSchema.parse(payload);
    await storeFactory().insertMeasure({
      id: input.id,
      kind: input.kind,
      payload: input.payload,
      sessionId: input.sessionId,
      stage: input.stage,
      ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp })
    });
    return { ok: true };
  },

  rosterUpsert: async (payload) => {
    const input = rosterUpsertSchema.parse(payload);
    const env = researchServerEnv();
    const db = new SupabaseRestClient({ serviceRoleKey: env.supabaseServiceRoleKey, url: env.supabaseUrl });
    await Promise.all([
      input.classes.length === 0 ? Promise.resolve([]) : db.upsert("classes", input.classes.map((item) => ({
        id: item.id,
        name: item.name,
        teacher_id: item.teacherId
      })), "id"),
      input.assignments.length === 0 ? Promise.resolve([]) : db.upsert("assignments", input.assignments.map((item) => ({
        assignment: item.payload,
        class_group_id: item.classGroupId,
        created_by_teacher_id: item.createdByTeacherId,
        id: item.id,
        research_condition: item.researchCondition,
        research_mode: item.researchMode,
        title: item.title
      })), "id"),
      input.students.length === 0 ? Promise.resolve([]) : db.upsert("students", input.students.map((item) => ({
        class_group_id: item.classGroupId,
        display_label: item.displayLabel ?? null,
        id: item.id,
        participant_code_hash: participantCodeHash(item.participantCode),
        student_anonymous_id: item.studentAnonymousId
      })), "id")
    ]);
    return { counts: { assignments: input.assignments.length, classes: input.classes.length, students: input.students.length }, ok: true };
  },

  sessionStart: async (payload) => {
    const input = sessionStartSchema.parse(payload);
    const result = "sessionId" in input
      ? await storeFactory().resumeSession(input.sessionId)
      : await storeFactory().startSession({
        participantCode: input.participantCode,
        ...(input.assignmentId === undefined ? {} : { assignmentId: input.assignmentId })
      });
    return {
      assignment: result.assignment,
      classGroupId: result.context.classGroupId,
      session: result.session,
      sessionId: result.context.sessionId,
      studentAnonymousId: result.context.studentAnonymousId
    };
  },

  updateStage: async (payload) => {
    const input = stageUpdateSchema.parse(payload);
    return storeFactory().updateStage({
      currentStage: input.currentStage,
      sessionId: input.sessionId,
      ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
      ...(input.status === undefined ? {} : { status: input.status })
    });
  }
});
