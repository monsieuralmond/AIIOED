import { AiRouteError } from "../gemini-client.js";
import { researchServerEnv } from "./env.js";
import type { JsonHandler } from "./http.js";
import { ApiError } from "./http.js";
import { completeResearchChat } from "./research-chat.js";
import { chatSchema } from "./schemas.js";
import { chatLimitMessage } from "./chat-limits.js";
import { reserveChatRequestSlot } from "./chat-request-slots.js";
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
    throw new ApiError(409, "같은 질문 요청을 아직 처리하고 있습니다. 잠시 후 다시 시도해 주세요.");
  }
  const requestLimitMessage = reserveChatRequestSlot(input.sessionId);
  if (requestLimitMessage !== null) throw new ApiError(429, requestLimitMessage);
  try {
    const response = await completeResearchChat({
      ...(session.assignment.calibrationConfig?.aiContext === undefined ? {} : { aiContext: session.assignment.calibrationConfig.aiContext }),
      apiKey: env.geminiApiKey,
      assignment: session.assignment,
      history: session.chatTurns,
      message: input.message,
      mode: env.aiMode,
      model: env.geminiModel,
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
  } catch (error) {
    if (error instanceof AiRouteError) {
      await store.insertEvent({
        id: serverId("event"),
        payload: {
          messageLength: input.message.length,
          requestId: input.requestId,
          reason: error.message
        },
        sessionId: input.sessionId,
        stage: session.currentStage,
        timestamp: new Date().toISOString(),
        type: "calibration_chat_failed"
      });
      throw new ApiError(503, "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw error;
  }
};
