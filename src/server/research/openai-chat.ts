import { assistantReplyForCalibration, requestTagsForMessage, understandingCalibrationSystemPromptForCondition } from "../../shared/calibration-ai";
import type { CalibrationChatResponse } from "../../shared/calibration-ai";
import type { Assignment, ChatTurn, LlmMode } from "../../shared/types";
import type { ResearchCondition } from "../../shared/research";
import { ApiError } from "./http";

type OpenAiMessage = {
  readonly content: string;
  readonly role: "assistant" | "developer" | "user";
};

type OpenAiTextPart = {
  readonly text?: string;
  readonly type?: string;
};

type OpenAiOutputItem = {
  readonly content?: readonly OpenAiTextPart[];
};

type OpenAiResponse = {
  readonly output?: readonly OpenAiOutputItem[];
  readonly output_text?: string;
};

export type ChatCompletionInput = {
  readonly aiContext?: string;
  readonly apiKey: string | undefined;
  readonly assignment: Assignment;
  readonly history: readonly ChatTurn[];
  readonly message: string;
  readonly mode: LlmMode;
  readonly model: string;
  readonly researchCondition: ResearchCondition;
};

const recentHistory = (history: readonly ChatTurn[]): readonly OpenAiMessage[] =>
  history.slice(-10).map((turn) => ({
    content: turn.text,
    role: turn.role === "assistant" ? "assistant" : "user"
  }));

const userContext = (input: ChatCompletionInput): string =>
  [
    `주제: ${input.assignment.title}`,
    `지문: ${input.assignment.passage}`,
    input.aiContext === undefined || input.aiContext.trim().length === 0 ? "" : `보조자료: ${input.aiContext.trim()}`,
    `학생 질문: ${input.message}`
  ]
    .filter((line) => line.length > 0)
    .join("\n\n");

const outputText = (payload: OpenAiResponse): string => {
  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) return payload.output_text;
  const parts = payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").filter((text) => text.length > 0) ?? [];
  return parts.join("\n").trim();
};

export const completeResearchChat = async (input: ChatCompletionInput): Promise<CalibrationChatResponse> => {
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
  if (input.apiKey === undefined) throw new ApiError(500, "OPENAI_API_KEY is required on the server.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        { content: understandingCalibrationSystemPromptForCondition(input.researchCondition), role: "developer" },
        ...recentHistory(input.history),
        { content: userContext(input), role: "user" }
      ],
      max_output_tokens: 600,
      model: input.model,
      temperature: 0.35
    }),
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
  const payload = (await response.json()) as OpenAiResponse;
  if (!response.ok) throw new ApiError(response.status, JSON.stringify(payload));
  const text = outputText(payload);
  if (text.length === 0) throw new ApiError(502, "OpenAI returned an empty response.");
  return { llmMode: "real", model: input.model, requestTags, text, type: "clarify" };
};
