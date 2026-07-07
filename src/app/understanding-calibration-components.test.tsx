import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./understanding-calibration-components.js";

describe("understanding calibration chat input", () => {
  it("submits with Enter when the question has text", () => {
    const onSubmit = vi.fn();

    render(<ChatInput value="양자컴퓨터가 왜 빠른가요?" onChange={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.queryByText("질문")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("궁금한 점을 적어보세요")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText("질문"), { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps Shift+Enter for multiline typing", () => {
    const onSubmit = vi.fn();

    render(<ChatInput value="첫 줄" onChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.keyDown(screen.getByLabelText("질문"), { key: "Enter", shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
