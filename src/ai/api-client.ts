import type { CoachRequest, CoachResponse, ReviewSuggestion, ReviewSuggestionCheckResponse, ReviewSuggestionsResponse } from "../shared/types.js";
import { calibrationRequestTags } from "../shared/calibration-ai.js";
import type { CalibrationChatRequest, CalibrationChatResponse, CalibrationRequestTag } from "../shared/calibration-ai.js";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonPayload = (text: string): unknown => {
  if (text.trim().length === 0) return null;
  return JSON.parse(text) as unknown;
};

const postJson = async (path: string, body: unknown): Promise<unknown> => {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = parseJsonPayload(text);
  } catch (error: unknown) {
    if (!response.ok) throw new Error("AI 요청에 실패했습니다.");
    if (error instanceof Error) throw new Error("AI 응답 형식이 올바르지 않습니다.");
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload["message"] === "string" ? payload["message"] : "AI 요청에 실패했습니다.";
    throw new Error(message);
  }
  if (payload === null) throw new Error("AI 서버가 빈 응답을 반환했습니다.");
  return payload;
};

const postAiJson = async (kind: "calibrationChat" | "coach" | "reviewCheck" | "reviewSuggestions", payload: unknown): Promise<unknown> =>
  postJson("/api/ai", { kind, payload });

const isCoachResponse = (value: unknown): value is CoachResponse => {
  if (!isRecord(value)) return false;
  return typeof value["text"] === "string" && value["text"].trim().length > 0 && typeof value["type"] === "string";
};

const isSuggestionCategory = (value: unknown): value is ReviewSuggestion["category"] =>
  value === "내용과 초점" || value === "자료와 설명" || value === "구조와 흐름" || value === "문장 표현" || value === "좋은 점검";

const isReviewSuggestion = (value: unknown): value is ReviewSuggestion => {
  if (!isRecord(value)) return false;
  return typeof value["id"] === "string" && isSuggestionCategory(value["category"]) && typeof value["text"] === "string" && typeof value["focusLabel"] === "string" && typeof value["resolved"] === "boolean";
};

const isReviewSuggestionsResponse = (value: unknown): value is ReviewSuggestionsResponse => {
  if (!isRecord(value) || !Array.isArray(value["suggestions"])) return false;
  return value["suggestions"].every(isReviewSuggestion);
};

const isReviewSuggestionCheckResponse = (value: unknown): value is ReviewSuggestionCheckResponse => {
  if (!isRecord(value)) return false;
  return typeof value["message"] === "string" && typeof value["resolved"] === "boolean" && typeof value["suggestionId"] === "string";
};

const isCalibrationRequestTag = (value: unknown): value is CalibrationRequestTag => calibrationRequestTags.some((tag) => tag === value);

const isCalibrationChatResponse = (value: unknown): value is CalibrationChatResponse => {
  if (!isRecord(value) || !Array.isArray(value["requestTags"])) return false;
  return typeof value["text"] === "string" && value["type"] === "clarify" && value["requestTags"].every(isCalibrationRequestTag);
};

export const requestCoachResponse = async (request: CoachRequest): Promise<CoachResponse> => {
  const payload = await postAiJson("coach", request);
  if (!isCoachResponse(payload)) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const requestReviewSuggestions = async (request: { readonly draft: string; readonly outline: CoachRequest["outline"] }): Promise<ReviewSuggestionsResponse> => {
  const payload = await postAiJson("reviewSuggestions", request);
  if (!isReviewSuggestionsResponse(payload)) throw new Error("AI 피드백 형식이 올바르지 않습니다.");
  return payload;
};

export const requestSuggestionCheck = async (request: { readonly draft: string; readonly outline: CoachRequest["outline"]; readonly suggestion: ReviewSuggestion }): Promise<ReviewSuggestionCheckResponse> => {
  const payload = await postAiJson("reviewCheck", request);
  if (!isReviewSuggestionCheckResponse(payload)) throw new Error("AI 수정 확인 형식이 올바르지 않습니다.");
  return payload;
};

export const requestCalibrationChatResponse = async (request: CalibrationChatRequest): Promise<CalibrationChatResponse> => {
  const payload = await postAiJson("calibrationChat", request);
  if (!isCalibrationChatResponse(payload)) throw new Error("AI 이해 보정 응답 형식이 올바르지 않습니다.");
  return payload;
};
