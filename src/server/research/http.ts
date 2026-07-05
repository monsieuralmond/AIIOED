import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import { ZodError } from "zod";

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type JsonHandler = (payload: unknown, request: IncomingMessage) => Promise<unknown>;

const readBody = async (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const body = await readBody(request);
  if (body.trim().length === 0) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
};

const statusForError = (error: unknown): number => {
  if (error instanceof ApiError) return error.statusCode;
  if (error instanceof ZodError) return 400;
  return 500;
};

const messageForError = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof ZodError) return "Request payload does not match the API schema.";
  return error instanceof Error ? error.message : "Unexpected API error.";
};

export const sendJson = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
};

export const nodeJsonRoute =
  (handler: JsonHandler) =>
  (request: IncomingMessage, response: ServerResponse): void => {
    if (request.method !== "POST") {
      sendJson(response, 405, { message: "method not allowed", ok: false });
      return;
    }
    readJson(request)
      .then((payload) => handler(payload, request))
      .then((payload) => sendJson(response, 200, payload))
      .catch((error: unknown) => sendJson(response, statusForError(error), { message: messageForError(error), ok: false }));
  };

export const connectJsonRoute = (handler: JsonHandler): Connect.SimpleHandleFunction => {
  const route = nodeJsonRoute(handler);
  return (request, response) => route(request, response);
};
