import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { z } from "zod";
import { ApiError } from "./http.js";
import type { SessionContext } from "./store.js";

const tokenPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    expiresAt: z.number().int().positive(),
    kind: z.literal("session"),
    assignmentId: z.string().min(1),
    classGroupId: z.string().min(1),
    sessionId: z.string().min(1),
    studentAnonymousId: z.string().min(1)
  }),
  z.object({
    expiresAt: z.number().int().positive(),
    kind: z.literal("teacher"),
    teacherId: z.string().min(1)
  }),
  z.object({
    adminId: z.string().min(1),
    expiresAt: z.number().int().positive(),
    kind: z.literal("admin")
  })
]);

type TokenPayload = z.infer<typeof tokenPayloadSchema>;

const sessionTokenHeader = "x-research-session-token";
const adminIdHeader = "x-research-admin-id";
const adminTokenHeader = "x-research-admin-token";
const teacherIdHeader = "x-research-teacher-id";
const teacherTokenHeader = "x-research-teacher-token";
const tokenTtlMs = 1000 * 60 * 60 * 12;

const secret = (): string => {
  const configured = process.env["SERVER_AUTH_SECRET"]?.trim();
  if (configured !== undefined && configured.length > 0) return configured;
  if (process.env["NODE_ENV"] === "production") throw new ApiError(500, "SERVER_AUTH_SECRET is required on the server.");
  return process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "reading-coach-local-dev-secret";
};

const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

const decode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");

const signature = (payload: string): string => createHmac("sha256", secret()).update(payload).digest("base64url");

const headerValue = (request: IncomingMessage, key: string): string | null => {
  const value = request.headers?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const signedToken = (payload: TokenPayload): string => {
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
};

const parseToken = (token: string): TokenPayload | null => {
  const [payload, signed] = token.split(".");
  if (payload === undefined || signed === undefined) return null;
  const expected = signature(payload);
  const receivedBuffer = Buffer.from(signed, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(decode(payload));
  } catch {
    return null;
  }
  const parsed = tokenPayloadSchema.safeParse(decoded);
  if (!parsed.success || parsed.data.expiresAt < Date.now()) return null;
  return parsed.data;
};

export const issueSessionToken = (context: Pick<SessionContext, "assignmentId" | "classGroupId" | "sessionId" | "studentAnonymousId">): string =>
  signedToken({
    assignmentId: context.assignmentId,
    classGroupId: context.classGroupId,
    expiresAt: Date.now() + tokenTtlMs,
    kind: "session",
    sessionId: context.sessionId,
    studentAnonymousId: context.studentAnonymousId
  });

export const issueTeacherToken = (teacherId: string): string =>
  signedToken({
    expiresAt: Date.now() + tokenTtlMs,
    kind: "teacher",
    teacherId
  });

export const issueAdminToken = (adminId: string): string =>
  signedToken({
    adminId,
    expiresAt: Date.now() + tokenTtlMs,
    kind: "admin"
  });

export const requireSessionAuth = (request: IncomingMessage, context: Pick<SessionContext, "assignmentId" | "classGroupId" | "sessionId" | "studentAnonymousId">): void => {
  const payload = parseToken(headerValue(request, sessionTokenHeader) ?? "");
  if (payload?.kind !== "session" ||
    payload.sessionId !== context.sessionId ||
    payload.assignmentId !== context.assignmentId ||
    payload.classGroupId !== context.classGroupId ||
    payload.studentAnonymousId !== context.studentAnonymousId) {
    throw new ApiError(401, "Session authorization is required.");
  }
};

export const teacherAuthFromRequest = (request: IncomingMessage): { readonly teacherId: string; readonly token: string } | null => {
  const teacherId = headerValue(request, teacherIdHeader);
  const token = headerValue(request, teacherTokenHeader);
  if (teacherId === null || token === null) return null;
  return { teacherId, token };
};

export const adminAuthFromRequest = (request: IncomingMessage): { readonly adminId: string; readonly token: string } | null => {
  const adminId = headerValue(request, adminIdHeader);
  const token = headerValue(request, adminTokenHeader);
  if (adminId === null || token === null) return null;
  return { adminId, token };
};

export const requireTeacherAuth = (request: IncomingMessage, teacherId: string): void => {
  const payload = parseToken(headerValue(request, teacherTokenHeader) ?? "");
  const requestTeacherId = headerValue(request, teacherIdHeader);
  if (requestTeacherId !== teacherId || payload?.kind !== "teacher" || payload.teacherId !== teacherId) {
    throw new ApiError(401, "Teacher authorization is required.");
  }
};

export const requireAdminAuth = (request: IncomingMessage): string => {
  const payload = parseToken(headerValue(request, adminTokenHeader) ?? "");
  const requestAdminId = headerValue(request, adminIdHeader);
  if (requestAdminId === null || payload?.kind !== "admin" || payload.adminId !== requestAdminId) {
    throw new ApiError(401, "Admin authorization is required.");
  }
  return requestAdminId;
};
