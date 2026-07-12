import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "../session/session.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";
import type { PilotSession, StudentAccount } from "../shared/types.js";
import { recordGuidedWritingTitle, submitGuidedWriting } from "./guided-writing-model.js";
import { GuidedWritingFlow } from "./guided-writing-flow.js";

const writingTitle = "양자컴퓨터는 왜 특별한 계산을 할 수 있을까?";
const draftText = "양자컴퓨터는 큐비트라는 특별한 정보 단위를 사용해 여러 가능성을 함께 다룰 수 있습니다.\n그래서 특정 계산에서는 일반 컴퓨터보다 훨씬 빠른 방법을 찾을 수 있지만, 모든 문제를 무조건 빠르게 푸는 것은 아닙니다.";

const sampleStudent = (): StudentAccount => {
  const student = sampleStudents.find((item) => item.id === "student-s001");
  if (student === undefined) throw new Error("Missing sample student");
  return student;
};

const completedGuidedSession = (): PilotSession => {
  const session = createSession({
    ...sampleAssignment,
    title: writingTitle,
    researchMode: ResearchModes.guidedWriting
  }, sampleStudent());
  const submitted = submitGuidedWriting(recordGuidedWritingTitle(session, writingTitle), draftText);
  return {
    ...submitted,
    completedAt: "2024-05-20T00:00:00.000Z",
    updatedAt: "2024-05-20T00:00:00.000Z"
  };
};

describe("GuidedWritingFlow completion", () => {
  it("presents the submitted essay as a framed finished text", () => {
    render(<GuidedWritingFlow session={completedGuidedSession()} setSession={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "글이 완성되었습니다" })).toBeInTheDocument();
    expect(screen.getByText("다른 문서 편집기나 디자인 도구에서 다시 다듬을 수 있도록 파일로 내보낼 수 있습니다.")).toBeInTheDocument();

    const artwork = screen.getByLabelText("완성된 글 미리보기");
    expect(within(artwork).getByRole("heading", { name: writingTitle })).toBeInTheDocument();
    expect(within(artwork).getByText(/큐비트라는 특별한 정보 단위/u)).toBeInTheDocument();
    expect(within(artwork).queryByText("김민서 • 2024년 작품")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 작품 내보내기 (Word)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "텍스트 파일" })).toBeInTheDocument();
  });

  it("does not show a fallback title inside the framed preview", () => {
    const submitted = submitGuidedWriting(createSession({
      ...sampleAssignment,
      researchMode: ResearchModes.guidedWriting
    }, sampleStudent()), draftText);

    render(<GuidedWritingFlow session={submitted} setSession={vi.fn()} />);

    const artwork = screen.getByLabelText("완성된 글 미리보기");
    expect(within(artwork).queryByRole("heading", { name: "최종 글" })).not.toBeInTheDocument();
    expect(within(artwork).getByText(/큐비트라는 특별한 정보 단위/u)).toBeInTheDocument();
  });

  it("lets students move back to earlier guided writing steps after submission", () => {
    function StatefulGuidedFlow(): ReactElement {
      const [session, setSession] = useState(() => completedGuidedSession());
      return <GuidedWritingFlow session={session} setSession={(updater) => setSession((current) => updater(current))} />;
    }

    render(<StatefulGuidedFlow />);

    expect(screen.getByRole("heading", { name: "글이 완성되었습니다" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1. 소재" }));

    expect(screen.getByRole("heading", { name: "소재 정하기" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "글이 완성되었습니다" })).not.toBeInTheDocument();
  });
});
