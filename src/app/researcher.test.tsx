import { createElement } from "react";
import { render, screen } from "@testing-library/react";
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
});
