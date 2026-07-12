import { createElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialPilotState, createSession } from "../session/session.js";
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

    const row = screen.getByRole("article", { name: `${sampleAssignment.title} 과제` });
    expect(within(row).getByRole("button", { name: "학생 화면 보기" })).not.toBeDisabled();
    expect(within(screen.getByLabelText("연구자 메뉴")).queryByRole("button", { name: "학생 화면 보기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "로그 보기" })).not.toBeInTheDocument();
    expect(screen.getByText("2명")).toBeInTheDocument();
  });

  it("enables student preview when an assignment has an existing student session", () => {
    const session = createSession({ ...sampleAssignment, assignedStudentIds: [] }, sampleStudents[0]);

    render(createElement(ResearcherList, {
      activeAssignment: session.assignment,
      state: {
        ...createInitialPilotState(),
        activeAssignmentId: session.assignment.id,
        assignments: [session.assignment],
        sessions: [session],
        students: sampleStudents
      },
      onAccounts: vi.fn(),
      onAssign: vi.fn(),
      onCreate: vi.fn(),
      onEditAssignment: vi.fn(),
      onReview: vi.fn(),
      onStudent: vi.fn()
    }));

    const row = screen.getByRole("article", { name: `${sampleAssignment.title} 과제` });
    expect(within(row).getByRole("button", { name: "학생 화면 보기" })).not.toBeDisabled();
    expect(screen.getByText("1명")).toBeInTheDocument();
  });

  it("opens the student preview for the selected assignment row", () => {
    const onStudent = vi.fn();
    const activeAssignment = { ...sampleAssignment, id: "assignment-active", title: "최근 과제" };
    const olderAssignment = { ...sampleAssignment, id: "assignment-older", title: "이전 과제" };

    render(createElement(ResearcherList, {
      activeAssignment,
      state: {
        ...createInitialPilotState(),
        activeAssignmentId: activeAssignment.id,
        assignments: [olderAssignment, activeAssignment],
        sessions: []
      },
      onAccounts: vi.fn(),
      onAssign: vi.fn(),
      onCreate: vi.fn(),
      onEditAssignment: vi.fn(),
      onReview: vi.fn(),
      onStudent
    }));

    const olderRow = screen.getByRole("article", { name: "이전 과제 과제" });
    fireEvent.click(within(olderRow).getByRole("button", { name: "학생 화면 보기" }));

    expect(onStudent).toHaveBeenCalledWith("assignment-older");
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

  it("keeps existing class assignments when assigning another class", () => {
    const onAssign = vi.fn();
    const firstClass = sampleClassGroups[0];
    const firstStudent = sampleStudents[0];
    if (firstClass === undefined || firstStudent === undefined) throw new Error("Missing sample fixture.");
    const secondClass = { id: "class-two", name: "2반", studentIds: ["student-s003"], teacherId: firstClass.teacherId };
    const secondStudent = {
      classGroupId: secondClass.id,
      displayName: "박서연",
      id: "student-s003",
      loginId: "s003",
      participantCode: "S003",
      password: "test",
      studentNumber: 3
    };
    const assignment = { ...sampleAssignment, assignedStudentIds: [firstStudent.id] };

    render(createElement(ResearcherList, {
      activeAssignment: assignment,
      state: {
        ...createInitialPilotState(),
        activeAssignmentId: assignment.id,
        assignments: [assignment],
        classGroups: [firstClass, secondClass],
        sessions: [],
        students: [firstStudent, secondStudent]
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
    fireEvent.change(within(dialog).getByLabelText("배정할 반"), { target: { value: secondClass.id } });
    fireEvent.click(within(dialog).getByLabelText("3번 박서연"));
    fireEvent.click(within(dialog).getByRole("button", { name: "배정 저장" }));

    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({
      assignedStudentIds: [firstStudent.id, secondStudent.id]
    }));
  });
});
