import { createUnifiedAiJsonHandler } from "./ai-unified-route.js";
import { createAiServerConfig } from "./ai-server-config.js";
import type { JsonHandler } from "./research/http.js";
import { ApiError } from "./research/http.js";
import { createResearchApiHandlers } from "./research/handlers.js";
import { authenticateAdmin } from "./research/admin-auth.js";
import { authenticateStudent } from "./research/student-auth.js";
import { authenticateTeacher } from "./research/teacher-auth.js";

const apiRoutePaths = [
  "admin/delete-test-data",
  "admin/health",
  "admin/roster",
  "admin/upsert-roster",
  "admin/upsert-roster-delta",
  "ai",
  "artifact",
  "auth/admin",
  "auth/student",
  "auth/teacher",
  "chat",
  "chat-turn",
  "event",
  "export",
  "measure",
  "session/list",
  "session/start",
  "session/update-stage"
] as const;

type ApiRoutePath = (typeof apiRoutePaths)[number];

export const isApiRoutePath = (value: string): value is ApiRoutePath =>
  apiRoutePaths.some((routePath) => routePath === value);

const trimmedRoutePath = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const apiRoutePathFromUrl = (requestUrl: string | undefined): string => {
  const url = new URL(requestUrl ?? "/api", "http://localhost");
  const rewrittenPath = url.searchParams.get("path");
  if (rewrittenPath !== null) return trimmedRoutePath(rewrittenPath);
  return trimmedRoutePath(url.pathname.replace(/^\/api\/?/, ""));
};

export const createVercelApiJsonHandler = (): JsonHandler => {
  const aiHandler = createUnifiedAiJsonHandler(createAiServerConfig(process.env));
  const researchHandlers = createResearchApiHandlers();
  const routeHandlers = {
    "admin/delete-test-data": researchHandlers.deleteTestData,
    "admin/health": researchHandlers.health,
    "admin/roster": researchHandlers.rosterLoad,
    "admin/upsert-roster": researchHandlers.rosterUpsert,
    "admin/upsert-roster-delta": researchHandlers.rosterUpsertDelta,
    ai: aiHandler,
    artifact: researchHandlers.artifact,
    "auth/admin": (payload) => authenticateAdmin(payload),
    "auth/student": (payload) => authenticateStudent(payload),
    "auth/teacher": (payload) => authenticateTeacher(payload),
    chat: researchHandlers.chat,
    "chat-turn": researchHandlers.chatTurn,
    event: researchHandlers.event,
    export: researchHandlers.exportData,
    measure: researchHandlers.measure,
    "session/list": researchHandlers.sessionList,
    "session/start": researchHandlers.sessionStart,
    "session/update-stage": researchHandlers.updateStage
  } satisfies Record<ApiRoutePath, JsonHandler>;

  return async (payload, request) => {
    const routePath = apiRoutePathFromUrl(request.url);
    if (!isApiRoutePath(routePath)) throw new ApiError(404, "Unknown API route.");
    return routeHandlers[routePath](payload, request);
  };
};
