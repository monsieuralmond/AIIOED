import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createSession } from "../session/session.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";
import { TeacherUnderstandingRecord } from "./teacher-understanding-record.js";

describe("TeacherUnderstandingRecord", () => {
  it("shows student questions and keeps AI responses collapsed for teachers", () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("Sample student missing.");
    const session = createSession({
      ...sampleAssignment,
      researchMode: ResearchModes.understandingCalibration
    }, student);

    render(<TeacherUnderstandingRecord session={{
      ...session,
      chatTurns: [
        {
          id: "chat-student-1",
          role: "student",
          text: "양자컴퓨터가 왜 빠른지 궁금해요.",
          timestamp: "2026-07-05T00:00:00.000Z"
        },
        {
          id: "chat-assistant-1",
          role: "assistant",
          text: "양자컴퓨터는 큐비트의 성질을 이용해 특정한 종류의 계산을 다르게 처리할 수 있습니다.",
          timestamp: "2026-07-05T00:00:01.000Z"
        }
      ]
    }} />);

    expect(screen.getByRole("heading", { name: "AI 대화 기록" })).toBeInTheDocument();
    expect(screen.getByText("학생 질문 1")).toBeInTheDocument();
    expect(screen.getByText("양자컴퓨터가 왜 빠른지 궁금해요.")).toBeVisible();
    expect(screen.queryByText(/관리자 로그/)).not.toBeInTheDocument();

    const assistantText = screen.getByText("양자컴퓨터는 큐비트의 성질을 이용해 특정한 종류의 계산을 다르게 처리할 수 있습니다.");
    expect(assistantText).not.toBeVisible();

    fireEvent.click(screen.getByText("AI 응답 1 보기"));

    expect(assistantText).toBeVisible();
  });

  it("summarizes AI response failures without exposing raw log details to teachers", () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("Sample student missing.");
    const session = createSession({
      ...sampleAssignment,
      researchMode: ResearchModes.understandingCalibration
    }, student);

    render(<TeacherUnderstandingRecord session={{
      ...session,
      events: [{
        id: "event-ai-failed",
        payload: {
          reason: "Gemini request timed out.",
          requestId: "request-timeout"
        },
        stage: "calibration_chat",
        timestamp: "2026-07-05T00:00:00.000Z",
        type: "calibration_chat_failed"
      }]
    }} />);

    expect(screen.getByRole("heading", { name: "AI 응답 상태" })).toBeInTheDocument();
    expect(screen.getByText("AI 응답 실패가 1회 기록되었습니다. 상세 로그는 관리자 export에서 확인합니다.")).toBeInTheDocument();
    expect(screen.queryByText("request-timeout")).not.toBeInTheDocument();
    expect(screen.queryByText("Gemini request timed out.")).not.toBeInTheDocument();
  });
});
