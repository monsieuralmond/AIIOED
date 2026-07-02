import type { IncomingMessage, ServerResponse } from "node:http";

export type RequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

const readJson = async (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const sendJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
};

export const handle = (handler: (payload: unknown) => Promise<unknown>): RequestHandler => {
  return (request, response): void => {
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "method not allowed" });
      return;
    }
    readJson(request)
      .then(handler)
      .then((body) => sendJson(response, 200, body))
      .catch((error: unknown) => sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "AI request failed" }));
  };
};
