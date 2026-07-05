import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createSession } from "../session/session.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";
import { TeacherUnderstandingRecord } from "./teacher-understanding-record.js";

describe("TeacherUnderstandingRecord", () => {
  it("surfaces AI response failure events for teacher review", () => {
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

    expect(screen.getByRole("heading", { name: "AI 응답 실패 기록" })).toBeInTheDocument();
    expect(screen.getByText("request-timeout")).toBeInTheDocument();
    expect(screen.getByText("Gemini request timed out.")).toBeInTheDocument();
  });
});
