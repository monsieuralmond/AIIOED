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

const maxBodyBytes = (): number => {
  const raw = process.env["MAX_JSON_BODY_BYTES"];
  if (raw === undefined) return 2_000_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2_000_000;
};

const readBody = async (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    request.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.byteLength;
      if (bytes > maxBodyBytes()) {
        settled = true;
        request.resume();
        reject(new ApiError(413, "Request body is too large."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
    request.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
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
  return "Unexpected API error.";
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
