import { expect, test } from "@playwright/test";
import { expectStudentWorkspace } from "./helpers.js";

test("participant code login and teacher password protect role surfaces", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "학생 계정" }).click();
  await page.getByLabel("참여자 코드").fill("BAD-CODE");
  await page.getByLabel("아이디").fill("s001");
  await page.getByLabel("비밀번호").fill("test");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("참여자 코드 또는 학생 계정 정보가 맞지 않습니다")).toBeVisible();

  await page.getByLabel("참여자 코드").fill("S001");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("navigation").getByText("김민서", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "역할 바꾸기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "교사 화면" })).toHaveCount(0);
  await expectStudentWorkspace(page);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("button", { name: "학생 계정" })).toBeVisible();

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "교사 로그인" })).toBeVisible();
  await page.getByLabel("아이디").fill("test");
  await page.getByLabel("비밀번호").fill("WRONG");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("아이디 또는 비밀번호가 맞지 않습니다")).toBeVisible();

  await page.goto("/export");
  await expect(page.getByRole("heading", { name: "관리자 로그인" })).toBeVisible();
  await page.getByLabel("아이디").fill("admin");
  await page.getByLabel("비밀번호").fill("test");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("button", { name: "로그 보기" }).click();
  await expect(page.getByRole("heading", { name: "연구 로그" })).toBeVisible();
});
