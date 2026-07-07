import { afterEach, describe, expect, it, vi } from "vitest";
import { callGeminiText } from "./gemini-client.js";

describe("Gemini client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["GEMINI_RETRY_DELAY_MS"];
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

    const text = await callGeminiText(
      { apiKey: "gemini-key-test", mode: "real", model: "gemini-2.5-flash-lite" },
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
