import { AiRouteError } from "../gemini-client.js";
import { researchServerEnv } from "./env.js";
import type { JsonHandler } from "./http.js";
import { ApiError } from "./http.js";
import { completeResearchChat } from "./research-chat.js";
import type { CalibrationChatResponse } from "../../shared/calibration-ai.js";
import { chatSchema } from "./schemas.js";
import { chatLimitMessage } from "./chat-limits.js";
import { requireSessionAuth } from "./auth.js";
import { serverId } from "./store.js";
import type { ResearchStore } from "./store.js";

export const createChatHandler = (storeFactory: () => ResearchStore): JsonHandler => async (payload, request) => {
  const input = chatSchema.parse(payload);
  const env = researchServerEnv();
  const store = storeFactory();
  const { context, session } = await store.resumeSession(input.sessionId);
  requireSessionAuth(request, context);
  const existing = await store.findAssistantTurnByRequestId(input.sessionId, input.requestId);
  if (existing !== null) {
    return {
      llmMode: env.aiMode,
      model: env.aiMode === "mock" ? "mock-understanding-calibration-v0" : env.geminiModel,
      requestTags: [],
      text: existing.text,
      type: "clarify"
    };
  }
  const limitMessage = chatLimitMessage(session);
  if (limitMessage !== null) throw new ApiError(429, limitMessage);
  const timestamp = new Date().toISOString();
  const studentTurnId = serverId("chat");
  const studentTurn = await store.insertChatTurn({
    id: studentTurnId,
    requestId: input.requestId,
    role: "student",
    sessionId: input.sessionId,
    stage: session.currentStage,
    text: input.message,
    timestamp
  });
  if (studentTurn.id !== studentTurnId) {
    const completedDuplicate = await store.findAssistantTurnByRequestId(input.sessionId, input.requestId);
    if (completedDuplicate !== null) {
      return {
        llmMode: env.aiMode,
        model: env.aiMode === "mock" ? "mock-understanding-calibration-v0" : env.geminiModel,
        requestTags: [],
        text: completedDuplicate.text,
        type: "clarify"
      };
    }
    if (await store.hasChatFailureForRequestId(input.sessionId, input.requestId)) {
      return completeAndPersistResearchChat({
        env,
        message: studentTurn.text,
        requestId: input.requestId,
        session,
        store
      });
    }
    throw new ApiError(409, "같은 질문 요청을 아직 처리하고 있습니다. 잠시 후 다시 시도해 주세요.");
  }
  return completeAndPersistResearchChat({
    env,
    message: input.message,
    requestId: input.requestId,
    session,
    store
  });
};

type CompleteAndPersistResearchChatInput = {
  readonly env: ReturnType<typeof researchServerEnv>;
  readonly message: string;
  readonly requestId: string;
  readonly session: Awaited<ReturnType<ResearchStore["resumeSession"]>>["session"];
  readonly store: ResearchStore;
};

const completeAndPersistResearchChat = async (input: CompleteAndPersistResearchChatInput): Promise<CalibrationChatResponse> => {
  try {
    const response = await completeResearchChat({
      ...(input.session.assignment.calibrationConfig?.aiContext === undefined ? {} : { aiContext: input.session.assignment.calibrationConfig.aiContext }),
      apiKey: input.env.geminiApiKey,
      assignment: input.session.assignment,
      history: input.session.chatTurns,
      message: input.message,
      mode: input.env.aiMode,
      model: input.env.geminiModel,
      researchCondition: input.session.researchCondition
    });
    await input.store.insertChatTurn({
      id: serverId("chat"),
      requestId: input.requestId,
      responseType: response.type,
      role: "assistant",
      sessionId: input.session.sessionId,
      stage: input.session.currentStage,
      text: response.text,
      timestamp: new Date().toISOString()
    });
    return response;
  } catch (error) {
    if (error instanceof AiRouteError) {
      await input.store.insertEvent({
        id: serverId("event"),
        payload: {
          messageLength: input.message.length,
          requestId: input.requestId,
          reason: error.message
        },
        sessionId: input.session.sessionId,
        stage: input.session.currentStage,
        timestamp: new Date().toISOString(),
        type: "calibration_chat_failed"
      });
      throw new ApiError(503, "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw error;
  }
};
