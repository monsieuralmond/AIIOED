import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialPilotState, createSession, submitFinal } from "../session/session.js";
import { sampleAssignment, sampleStudents } from "../shared/fixtures.js";
import type { PilotState, TeacherReviewUpdate } from "../shared/types.js";
import { TeacherReview } from "./teacher-review.js";

const submittedReviewState = (): PilotState => {
  const student = sampleStudents[0];
  if (student === undefined) throw new Error("Missing sample student.");
  const submittedSession = submitFinal(createSession(sampleAssignment, student), "최종 제출 글입니다.");
  return {
    ...createInitialPilotState(),
    sessions: [submittedSession]
  };
};

function TeacherReviewHarness(props: { readonly onReset: (sessionId: string) => Promise<string | null> }): ReactElement {
  const [state, setState] = useState<PilotState>(submittedReviewState());
  const resetSession = async (sessionId: string): Promise<string | null> => {
    const error = await props.onReset(sessionId);
    if (error === null) {
      setState((current) => ({
        ...current,
        sessions: current.sessions.filter((session) => session.sessionId !== sessionId)
      }));
    }
    return error;
  };
  return <TeacherReview state={state} onBack={vi.fn()} onResetSession={resetSession} onUpdateReview={vi.fn<(sessionId: string, input: TeacherReviewUpdate) => void>()} />;
}

describe("TeacherReview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks before resetting a submitted student session", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const reset = vi.fn(async () => null);
    render(<TeacherReviewHarness onReset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "제출 기록 리셋" }));

    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("기록을 리셋할까요?"));
    expect(screen.getByText("기록을 리셋했습니다. 학생은 이 과제를 다시 시작할 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByText("과제를 시작하면 자동으로 모입니다")).toBeInTheDocument();
    expect(screen.getAllByText("시작 전").length).toBeGreaterThan(0);
  });

  it("keeps the submitted session when reset is canceled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const reset = vi.fn(async () => null);
    render(<TeacherReviewHarness onReset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "제출 기록 리셋" }));

    expect(reset).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "제출 기록 리셋" })).toBeInTheDocument();
  });

  it("filters student progress by class group", () => {
    const classTwo = { id: "class-two", name: "2반", studentIds: ["student-s003"], teacherId: "teacher-research" };
    const classTwoStudent = {
      classGroupId: classTwo.id,
      displayName: "박서연",
      id: "student-s003",
      loginId: "s003",
      participantCode: "S003",
      password: "test",
      studentNumber: 3
    };
    const classTwoAssignment = {
      ...sampleAssignment,
      assignedStudentIds: [classTwoStudent.id],
      classGroupId: classTwo.id,
      id: "assignment-class-two",
      title: "2반 과제"
    };
    const state: PilotState = {
      ...createInitialPilotState(),
      assignments: [sampleAssignment, classTwoAssignment],
      classGroups: [...createInitialPilotState().classGroups, classTwo],
      students: [...createInitialPilotState().students, classTwoStudent]
    };

    render(<TeacherReview state={state} onBack={vi.fn()} onResetSession={vi.fn(async () => null)} onUpdateReview={vi.fn<(sessionId: string, input: TeacherReviewUpdate) => void>()} />);

    fireEvent.change(screen.getByLabelText("반 선택"), { target: { value: classTwo.id } });

    expect(screen.getByRole("heading", { name: "2반 과제" })).toBeInTheDocument();
    expect(screen.getByText("2반 · 1명 중 0명 제출")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "박서연 상태" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "김민서 상태" })).not.toBeInTheDocument();
  });

  it("keeps unassigned students visible when they have a saved session for the selected assignment", () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("Missing sample student.");
    const session = submitFinal(createSession(sampleAssignment, student), "배정 취소 전에 제출한 글입니다.");
    const state: PilotState = {
      ...createInitialPilotState(),
      assignments: [{ ...sampleAssignment, assignedStudentIds: [] }],
      sessions: [session]
    };

    render(<TeacherReview state={state} onBack={vi.fn()} onResetSession={vi.fn(async () => null)} onUpdateReview={vi.fn<(sessionId: string, input: TeacherReviewUpdate) => void>()} />);

    expect(screen.getByText("전체 반 · 1명 중 1명 제출")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "김민서 상태" })).toBeInTheDocument();
    expect(screen.getByText("배정 취소됨")).toBeInTheDocument();
    expect(screen.getByText("배정 취소 전에 제출한 글입니다.")).toBeInTheDocument();
  });
});
