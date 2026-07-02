import type { CoachRequest, CoachResponse, ReviewSuggestion, ReviewSuggestionCheckResponse, ReviewSuggestionsResponse } from "../shared/types";
import { calibrationRequestTags } from "../shared/calibration-ai";
import type { CalibrationChatRequest, CalibrationChatResponse, CalibrationRequestTag } from "../shared/calibration-ai";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const postJson = async (path: string, body: unknown): Promise<unknown> => {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload["message"] === "string" ? payload["message"] : "AI 요청에 실패했습니다.";
    throw new Error(message);
  }
  return payload;
};

const isCoachResponse = (value: unknown): value is CoachResponse => {
  if (!isRecord(value)) return false;
  return typeof value["text"] === "string" && typeof value["type"] === "string";
};

const isSuggestionCategory = (value: unknown): value is ReviewSuggestion["category"] =>
  value === "주장과 초점" || value === "근거와 설명" || value === "구조와 흐름" || value === "문장 표현" || value === "좋은 점검";

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
  const payload = await postJson("/api/coach/message", request);
  if (!isCoachResponse(payload)) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return payload;
};

export const requestReviewSuggestions = async (request: { readonly draft: string; readonly outline: CoachRequest["outline"] }): Promise<ReviewSuggestionsResponse> => {
  const payload = await postJson("/api/review/suggestions", request);
  if (!isReviewSuggestionsResponse(payload)) throw new Error("AI 피드백 형식이 올바르지 않습니다.");
  return payload;
};

export const requestSuggestionCheck = async (request: { readonly draft: string; readonly outline: CoachRequest["outline"]; readonly suggestion: ReviewSuggestion }): Promise<ReviewSuggestionCheckResponse> => {
  const payload = await postJson("/api/review/check", request);
  if (!isReviewSuggestionCheckResponse(payload)) throw new Error("AI 수정 확인 형식이 올바르지 않습니다.");
  return payload;
};

export const requestCalibrationChatResponse = async (request: CalibrationChatRequest): Promise<CalibrationChatResponse> => {
  const payload = await postJson("/api/calibration/chat", request);
  if (!isCalibrationChatResponse(payload)) throw new Error("AI 이해 보정 응답 형식이 올바르지 않습니다.");
  return payload;
};
