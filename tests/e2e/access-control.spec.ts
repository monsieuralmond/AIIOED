import { expect, test } from "@playwright/test";

test("participant code login and teacher password protect role surfaces", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("참여자 코드").fill("BAD-CODE");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await expect(page.getByText("참여자 코드를 확인하세요")).toBeVisible();

  await page.getByLabel("참여자 코드").fill("S-MINSEO");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await expect(page.getByRole("main").getByText("김민서", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "역할 바꾸기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "교사 화면" })).toHaveCount(0);
  await page.getByRole("button", { name: "과제 시작" }).click();
  await expect(page.getByRole("button", { name: "과제 보기" })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByLabel("참여자 코드")).toBeVisible();

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "교사 확인" })).toBeVisible();
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("WRONG");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await expect(page.getByText("교사 아이디 또는 비밀번호가 맞지 않습니다")).toBeVisible();

  await page.goto("/export");
  await expect(page.getByRole("heading", { name: "교사 확인" })).toBeVisible();
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await expect(page.getByRole("heading", { name: "연구 로그" })).toBeVisible();
});
