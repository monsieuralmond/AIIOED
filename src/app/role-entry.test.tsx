import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoleEntry } from "./role-entry.js";

describe("RoleEntry", () => {
  it("submits teacher login when Enter is pressed in the password field", async () => {
    const onTeacher = vi.fn(async () => true);

    render(createElement(RoleEntry, {
      mode: "teacher",
      onAdmin: vi.fn(),
      onStudentCredentials: vi.fn(),
      onTeacher
    }));

    const form = screen.getByRole("form", { name: "교사 로그인" });
    fireEvent.change(within(form).getByLabelText("아이디"), { target: { value: "teacher" } });
    fireEvent.change(within(form).getByLabelText("비밀번호"), { target: { value: "test" } });
    fireEvent.keyDown(within(form).getByLabelText("비밀번호"), { code: "Enter", key: "Enter" });

    await waitFor(() => expect(onTeacher).toHaveBeenCalledWith("teacher", "test"));
  });
});
