import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviders, callAiText } from "./gemini-client.js";

describe("AI client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["OPENAI_RETRY_DELAY_MS"];
    delete process.env["GEMINI_RETRY_DELAY_MS"];
  });

  it("calls OpenAI Responses with the GPT-5 nano model by default-compatible config", async () => {
    let requestedUrl = "";
    let requestedBody = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      requestedUrl = input instanceof Request ? input.url : String(input);
      requestedBody = input instanceof Request ? await input.clone().text() : "";
      return Response.json({
        output_text: "양자컴퓨터는 큐비트로 정보를 처리합니다."
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = await callAiText(
      { apiKey: "openai-key-test", mode: "real", model: "gpt-5-nano", provider: AiProviders.openai },
      {
        contents: [{ parts: [{ text: "양자컴퓨터가 뭐야?" }], role: "user" }],
        maxOutputTokens: 100,
        systemInstruction: "한국어로 짧게 답하세요.",
        temperature: 0.2
      }
    );

    expect(text).toBe("양자컴퓨터는 큐비트로 정보를 처리합니다.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl).toBe("https://api.openai.com/v1/responses");
    expect(requestedBody).toContain("\"model\":\"gpt-5-nano\"");
    expect(requestedBody).toContain("\"reasoning\":{\"effort\":\"minimal\"}");
    expect(requestedBody).not.toContain("temperature");
  });

  it("retries transient high-demand responses before failing the chat turn", async () => {
    process.env["GEMINI_RETRY_DELAY_MS"] = "0";
    const fetchMock = vi.fn(async (): Promise<Response> => {
      if (fetchMock.mock.calls.length < 3) {
        return Response.json(
          { error: { message: "This model is currently experiencing high demand. Please try again later." } },
          { status: 503 }
        );
      }
      return Response.json({
        candidates: [{ content: { parts: [{ text: "양자컴퓨터는 양자역학 원리를 이용해 정보를 처리합니다." }] } }]
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = await callAiText(
      { apiKey: "gemini-key-test", mode: "real", model: "gemini-2.5-flash-lite", provider: AiProviders.gemini },
      {
        contents: [{ parts: [{ text: "양자컴퓨터가 뭐야?" }], role: "user" }],
        maxOutputTokens: 100,
        systemInstruction: "한국어로 짧게 답하세요.",
        temperature: 0.2
      }
    );

    expect(text).toBe("양자컴퓨터는 양자역학 원리를 이용해 정보를 처리합니다.");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
