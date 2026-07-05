import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialPilotState } from "../session/session.js";
import { sampleAssignment } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";
import { CreateAssignment } from "./create-assignment.js";

describe("CreateAssignment", () => {
  it("shows the available writing and research modes", () => {
    render(
      <CreateAssignment
        assignment={sampleAssignment}
        mode="edit"
        state={createInitialPilotState()}
        onBack={vi.fn()}
        onDelete={vi.fn(() => null)}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("글쓰기 코치")).toBeInTheDocument();
    expect(screen.getByText("단계형 글쓰기")).toBeInTheDocument();
    expect(screen.getByText("AI 기반 이해 보정 연구")).toBeInTheDocument();
    expect(screen.queryByText("기존 글쓰기 코치")).not.toBeInTheDocument();
    expect(screen.queryByText("전체 글쓰기 과정")).not.toBeInTheDocument();
    expect(screen.queryByText("초안 피드백과 수정")).not.toBeInTheDocument();
  });

  it("saves writing coach assignments with the default full writing flow", () => {
    const onSave = vi.fn();

    render(
      <CreateAssignment
        assignment={{ ...sampleAssignment, assignmentMode: "revision_feedback" }}
        mode="edit"
        state={createInitialPilotState()}
        onBack={vi.fn()}
        onDelete={vi.fn(() => null)}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ assignmentMode: "full_process" }));
  });

  it("saves a guided writing assignment with planning requirements", () => {
    const onSave = vi.fn();

    render(
      <CreateAssignment
        assignment={sampleAssignment}
        mode="create"
        state={createInitialPilotState()}
        onBack={vi.fn()}
        onDelete={vi.fn(() => null)}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByText("단계형 글쓰기"));
    fireEvent.change(screen.getByLabelText("과제 제목"), { target: { value: "내가 고른 주제로 글쓰기" } });
    fireEvent.change(screen.getByLabelText("활동 안내 또는 참고 자료"), { target: { value: "소재를 정하고 주제를 좁힌 뒤 글을 씁니다." } });
    fireEvent.click(screen.getByRole("button", { name: "과제 저장" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      essayType: "단계형 글쓰기",
      researchMode: ResearchModes.guidedWriting,
      requirements: expect.arrayContaining(["소재 정하기", "AI 도움을 받아 글쓰기"])
    }));
  });

  it("shows create examples as light placeholder text instead of prefilled values", () => {
    render(
      <CreateAssignment
        assignment={sampleAssignment}
        mode="create"
        state={createInitialPilotState()}
        onBack={vi.fn()}
        onDelete={vi.fn(() => null)}
        onSave={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText("과제 제목");
    const passageInput = screen.getByLabelText("비문학 지문");
    const questionInput = screen.getByLabelText("해결할 문제");
    const requirementsInput = screen.getByLabelText("학생에게 보일 요구사항");
    const sourceGuidanceInput = screen.getByLabelText("근거와 출처 안내");

    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", expect.stringMatching(/^예:/));
    expect(passageInput).toHaveValue("");
    expect(passageInput).toHaveAttribute("placeholder", expect.stringMatching(/^예:/));
    expect(questionInput).toHaveValue("");
    expect(questionInput).toHaveAttribute("placeholder", expect.stringMatching(/^예:/));
    expect(requirementsInput).toHaveValue("");
    expect(requirementsInput).toHaveAttribute("placeholder", expect.stringMatching(/^예:/));
    expect(sourceGuidanceInput).toHaveValue("");
    expect(sourceGuidanceInput).toHaveAttribute("placeholder", expect.stringMatching(/^예:/));
  });

  it("asks for confirmation before deleting an edited assignment", () => {
    const onBack = vi.fn();
    const onDelete = vi.fn(() => null);
    const onSave = vi.fn();

    render(
      <CreateAssignment
        assignment={sampleAssignment}
        mode="edit"
        state={createInitialPilotState()}
        onBack={onBack}
        onDelete={onDelete}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "과제 삭제" }));

    expect(screen.getByRole("dialog", { name: "과제 삭제 확인" })).toBeInTheDocument();
    expect(screen.getByText("정말 삭제하시겠습니까?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "아니오" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "과제 삭제 확인" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "과제 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "예" }));

    expect(onDelete).toHaveBeenCalledWith(sampleAssignment.id);
  });
});
