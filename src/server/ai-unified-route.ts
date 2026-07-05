import type { AiServerConfig } from "./gemini-client.js";
import { createAiPayloadHandlers } from "./gemini-routes.js";
import { ApiError } from "./research/http.js";
import type { JsonHandler } from "./research/http.js";

const aiRouteKinds = ["calibrationChat", "coach", "reviewCheck", "reviewSuggestions"] as const;
type AiRouteKind = (typeof aiRouteKinds)[number];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isAiRouteKind = (value: unknown): value is AiRouteKind => aiRouteKinds.some((kind) => kind === value);

export const createUnifiedAiJsonHandler = (config: AiServerConfig): JsonHandler => {
  const handlers = createAiPayloadHandlers(config);
  return async (payload) => {
    if (!isRecord(payload) || !isAiRouteKind(payload["kind"])) throw new ApiError(400, "Unknown AI route.");
    return handlers[payload["kind"]](payload["payload"]);
  };
};
