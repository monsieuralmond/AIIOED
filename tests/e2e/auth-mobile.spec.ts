import { expect, test } from "@playwright/test";
import { expectStudentWorkspace } from "./helpers.js";

const expectNoHorizontalOverflow = async (page: import("@playwright/test").Page): Promise<void> => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
};

test("mobile participant and teacher gates remain usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "학생 계정" }).click();
  await expect(page.getByLabel("참여코드")).toBeVisible();
  await page.getByLabel("참여코드").fill("S001");
  await page.getByLabel("학생 아이디").fill("s001");
  await page.getByLabel("학생 비밀번호").fill("test");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await expectStudentWorkspace(page);
  await expect(page.getByRole("button", { name: "역할 바꾸기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "교사 화면" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/export");
  await expect(page.getByRole("heading", { name: "교사 로그인" })).toBeVisible();
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await expect(page.getByRole("heading", { name: "연구 로그" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
