import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, enterStage } from "../session/session.js";
import { requestSessionCalibrationChat } from "../session/research-api-client.js";
import type { CalibrationChatResponse } from "../shared/calibration-ai.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import { ResearchModes, UnderstandingCalibrationStages } from "../shared/research.js";
import type { Assignment, PilotSession, StudentAccount } from "../shared/types.js";
import { UnderstandingCalibrationFlow } from "./understanding-calibration-flow.js";

vi.mock("../session/research-api-client.js", () => ({
  requestSessionCalibrationChat: vi.fn()
}));

const firstStudent = (): StudentAccount => {
  const student = sampleStudents[0];
  if (student === undefined) throw new Error("Missing sample student.");
  return student;
};

const calibrationAssignment = (): Assignment => ({
  ...sampleAssignment,
  researchMode: ResearchModes.understandingCalibration,
  title: "양자컴퓨터"
});

const deferredResponse = (): {
  readonly promise: Promise<CalibrationChatResponse>;
  readonly resolve: (value: CalibrationChatResponse) => void;
} => {
  let resolveDeferred: (value: CalibrationChatResponse) => void = () => {
    throw new Error("Deferred response was resolved before initialization.");
  };
  const promise = new Promise<CalibrationChatResponse>((resolve) => {
    resolveDeferred = resolve;
  });
  return { promise, resolve: resolveDeferred };
};

function FlowHarness(): ReactElement {
  const [session, setSession] = useState<PilotSession>(() =>
    enterStage(createSession(calibrationAssignment(), firstStudent()), UnderstandingCalibrationStages.chat)
  );
  return <UnderstandingCalibrationFlow session={session} setSession={(updater) => setSession((currentSession) => updater(currentSession))} />;
}

describe("UnderstandingCalibrationFlow chat", () => {
  beforeEach(() => {
    vi.mocked(requestSessionCalibrationChat).mockReset();
  });

  it("shows the student question before the AI response resolves", async () => {
    const pendingResponse = deferredResponse();
    vi.mocked(requestSessionCalibrationChat).mockReturnValueOnce(pendingResponse.promise);

    render(<FlowHarness />);

    fireEvent.change(screen.getByLabelText("질문"), { target: { value: "큐비트가 뭐예요?" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(screen.getByText("큐비트가 뭐예요?")).toBeInTheDocument());
    expect(screen.queryByText("큐비트는 양자컴퓨터가 정보를 다루는 기본 단위입니다.")).not.toBeInTheDocument();

    pendingResponse.resolve({
      requestTags: ["definition_request"],
      text: "큐비트는 양자컴퓨터가 정보를 다루는 기본 단위입니다.",
      type: "clarify"
    });

    await waitFor(() => expect(screen.getByText("큐비트는 양자컴퓨터가 정보를 다루는 기본 단위입니다.")).toBeInTheDocument());
  });

  it("lets students resend the same failed AI question without duplicating their message", async () => {
    vi.mocked(requestSessionCalibrationChat)
      .mockRejectedValueOnce(new Error("temporary provider failure"))
      .mockResolvedValueOnce({
        requestTags: ["definition_request"],
        text: "큐비트는 양자컴퓨터가 정보를 다루는 기본 단위입니다.",
        type: "clarify"
      });

    render(<FlowHarness />);

    fireEvent.change(screen.getByLabelText("질문"), { target: { value: "큐비트가 뭐예요?" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "같은 질문 다시 보내기" })).toBeInTheDocument());
    const firstRequest = vi.mocked(requestSessionCalibrationChat).mock.calls[0]?.[0];
    if (firstRequest === undefined) throw new Error("first chat request was not captured.");

    fireEvent.click(screen.getByRole("button", { name: "같은 질문 다시 보내기" }));

    await waitFor(() => expect(screen.getByText("큐비트는 양자컴퓨터가 정보를 다루는 기본 단위입니다.")).toBeInTheDocument());
    const secondRequest = vi.mocked(requestSessionCalibrationChat).mock.calls[1]?.[0];
    if (secondRequest === undefined) throw new Error("second chat request was not captured.");
    expect(secondRequest.requestId).toBe(firstRequest.requestId);
    expect(screen.getAllByText("큐비트가 뭐예요?")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "같은 질문 다시 보내기" })).not.toBeInTheDocument();
  });
});
