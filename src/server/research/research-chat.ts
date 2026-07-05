import { assistantReplyForCalibration, requestTagsForMessage, understandingCalibrationSystemPromptForCondition } from "../../shared/calibration-ai.js";
import type { CalibrationChatResponse } from "../../shared/calibration-ai.js";
import type { ResearchCondition } from "../../shared/research.js";
import type { Assignment, ChatTurn, LlmMode } from "../../shared/types.js";
import { callGeminiText } from "../gemini-client.js";
import type { GeminiContent } from "../gemini-client.js";

type ResearchChatInput = {
  readonly aiContext?: string;
  readonly apiKey: string | undefined;
  readonly assignment: Assignment;
  readonly history: readonly ChatTurn[];
  readonly message: string;
  readonly mode: LlmMode;
  readonly model: string;
  readonly researchCondition: ResearchCondition;
};

const recentHistory = (history: readonly ChatTurn[]): readonly GeminiContent[] =>
  history.slice(-10).map((turn) => ({
    parts: [{ text: turn.text }],
    role: turn.role === "assistant" ? "model" : "user"
  }));

const historyTranscript = (history: readonly ChatTurn[]): string =>
  history
    .slice(-12)
    .map((turn) => `${turn.role === "assistant" ? "AI" : "학생"}: ${turn.text}`)
    .join("\n");

const userContext = (input: ResearchChatInput): string =>
  [
    `주제: ${input.assignment.title}`,
    `지문: ${input.assignment.passage}`,
    input.aiContext === undefined || input.aiContext.trim().length === 0 ? "" : `보조자료: ${input.aiContext.trim()}`,
    input.history.length === 0 ? "" : `이전 대화:\n${historyTranscript(input.history)}`,
    input.history.length === 0 ? "" : "학생이 '방금', '아까', '그거', '그 부분'처럼 이전 대화를 가리키면 위 이전 대화의 맥락을 이어서 답한다.",
    `현재 학생 질문: ${input.message}`
  ]
    .filter((line) => line.length > 0)
    .join("\n\n");

export const completeResearchChat = async (input: ResearchChatInput): Promise<CalibrationChatResponse> => {
  const requestTags = requestTagsForMessage(input.message);
  if (input.mode === "mock") {
    return {
      llmMode: "mock",
      model: "mock-understanding-calibration-v0",
      requestTags,
      text: assistantReplyForCalibration({
        ...(input.aiContext === undefined ? {} : { aiContext: input.aiContext }),
        history: input.history.map((turn) => ({ role: turn.role, text: turn.text })),
        message: input.message,
        passage: input.assignment.passage,
        topic: input.assignment.title
      }),
      type: "clarify"
    };
  }
  const text = await callGeminiText(
    {
      apiKey: input.apiKey,
      mode: input.mode,
      model: input.model
    },
    {
      contents: [
        ...recentHistory(input.history),
        { parts: [{ text: userContext(input) }], role: "user" }
      ],
      maxOutputTokens: 600,
      systemInstruction: understandingCalibrationSystemPromptForCondition(input.researchCondition),
      temperature: 0.35
    }
  );
  return { llmMode: "real", model: input.model, requestTags, text, type: "clarify" };
};
