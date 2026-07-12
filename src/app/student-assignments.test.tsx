import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialPilotState, createSession, submitFinal } from "../session/session.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";
import { StudentAssignments } from "./student-assignments.js";

const sampleStudent = () => {
  const student = sampleStudents[0];
  if (student === undefined) throw new Error("Missing sample student.");
  return student;
};

const longPassage =
  "양자컴퓨터는 일반 컴퓨터와 다른 방식으로 정보를 다룹니다. ".repeat(24);

describe("StudentAssignments", () => {
  it("keeps the handoff screen compact without empty target or output cards", () => {
    const assignment = {
      ...sampleAssignment,
      passage: longPassage,
      targetLength: ""
    };

    render(
      <StudentAssignments
        assignments={[assignment]}
        state={{ ...createInitialPilotState(), assignments: [assignment] }}
        student={sampleStudent()}
        onStart={vi.fn()}
      />
    );

    const assignedTask = screen.getByRole("article", { name: `${assignment.title} 과제` });
    expect(within(assignedTask).queryByText("목표")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("내가 제출할 글")).not.toBeInTheDocument();

    const passagePreview = screen.getByLabelText("지문 미리보기");
    const previewParagraphs = passagePreview.querySelectorAll("p");
    const previewText = previewParagraphs[1]?.textContent ?? "";
    expect(previewText.endsWith("...")).toBe(true);
  });

  it("disables the start button when an understanding-calibration task has already been submitted", () => {
    const student = sampleStudent();
    const assignment = { ...sampleAssignment, researchMode: ResearchModes.understandingCalibration };
    const submittedSession = submitFinal(createSession(assignment, student), "제출한 글입니다.");
    const onStart = vi.fn();

    render(
      <StudentAssignments
        assignments={[assignment]}
        state={{ ...createInitialPilotState(), sessions: [submittedSession] }}
        student={student}
        onStart={onStart}
      />
    );

    expect(screen.getByRole("button", { name: "제출 완료" })).toBeDisabled();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("lets students reopen a submitted writing-coach task", () => {
    const student = sampleStudent();
    const assignment = { ...sampleAssignment, researchMode: ResearchModes.writingCoach };
    const submittedSession = submitFinal(createSession(assignment, student), "제출한 글입니다.");
    const onStart = vi.fn();

    render(
      <StudentAssignments
        assignments={[assignment]}
        state={{ ...createInitialPilotState(), sessions: [submittedSession] }}
        student={student}
        onStart={onStart}
      />
    );

    const reopenButton = screen.getByRole("button", { name: "다시 열기" });
    expect(reopenButton).toBeEnabled();
    fireEvent.click(reopenButton);
    expect(onStart).toHaveBeenCalledWith(assignment.id);
  });
});
