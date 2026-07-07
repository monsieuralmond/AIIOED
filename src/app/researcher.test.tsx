import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialPilotState } from "../session/session.js";
import { sampleAssignment, sampleClassGroups, sampleStudents } from "../shared/fixtures.js";
import { ResearcherList } from "./researcher.js";

describe("ResearcherList", () => {
  it("enables student preview from assigned students even when class studentIds are stale", () => {
    const classGroup = sampleClassGroups[0];
    if (classGroup === undefined) throw new Error("Missing sample class group.");
    const state = {
      ...createInitialPilotState(),
      activeAssignmentId: sampleAssignment.id,
      assignments: [sampleAssignment],
      classGroups: [{ ...classGroup, studentIds: [] }],
      sessions: [],
      students: sampleStudents
    };

    render(createElement(ResearcherList, {
      activeAssignment: sampleAssignment,
      state,
      onAccounts: vi.fn(),
      onAssign: vi.fn(),
      onCreate: vi.fn(),
      onEditAssignment: vi.fn(),
      onReview: vi.fn(),
      onStudent: vi.fn()
    }));

    expect(screen.getByRole("button", { name: "학생 화면 보기" })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "로그 보기" })).not.toBeInTheDocument();
    expect(screen.getByText("2명")).toBeInTheDocument();
  });

  it("saves an empty assignment roster when the teacher cancels assignment from a row", () => {
    const onAssign = vi.fn();

    render(createElement(ResearcherList, {
      activeAssignment: sampleAssignment,
      state: {
        ...createInitialPilotState(),
        activeAssignmentId: sampleAssignment.id,
        assignments: [sampleAssignment],
        sessions: []
      },
      onAccounts: vi.fn(),
      onAssign,
      onCreate: vi.fn(),
      onEditAssignment: vi.fn(),
      onReview: vi.fn(),
      onStudent: vi.fn()
    }));

    const row = screen.getByRole("article", { name: `${sampleAssignment.title} 과제` });
    fireEvent.click(within(row).getByRole("button", { name: "배정 취소" }));

    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ assignedStudentIds: [] }));
  });

  it("lets the teacher pick assigned students inside the assignment dialog", () => {
    const onAssign = vi.fn();
    const unassignedAssignment = { ...sampleAssignment, assignedStudentIds: [] };

    render(createElement(ResearcherList, {
      activeAssignment: unassignedAssignment,
      state: {
        ...createInitialPilotState(),
        activeAssignmentId: unassignedAssignment.id,
        assignments: [unassignedAssignment],
        sessions: []
      },
      onAccounts: vi.fn(),
      onAssign,
      onCreate: vi.fn(),
      onEditAssignment: vi.fn(),
      onReview: vi.fn(),
      onStudent: vi.fn()
    }));

    const row = screen.getByRole("article", { name: `${sampleAssignment.title} 과제` });
    fireEvent.click(within(row).getByRole("button", { name: "배정" }));
    const dialog = screen.getByRole("dialog", { name: "과제 배정" });
    fireEvent.click(within(dialog).getByLabelText("1번 김민서"));
    fireEvent.click(within(dialog).getByRole("button", { name: "배정 저장" }));

    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({
      assignedStudentIds: [sampleStudents[0]?.id]
    }));
  });
});
