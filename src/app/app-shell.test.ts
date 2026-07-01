import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App shell", () => {
  it("renders the Khan-style shell when the app starts", () => {
    render(createElement(App));

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByText("Reading Coach Lab")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "수업 계정으로 시작하세요" })).toBeInTheDocument();
    expect(screen.getByLabelText("참여자 코드")).toBeInTheDocument();
    expect(screen.getByLabelText("학생 아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("학생 비밀번호")).toBeInTheDocument();
    expect(screen.getByLabelText("교사 아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("교사 비밀번호")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "교사로 시작" })).toBeInTheDocument();
  });
});
