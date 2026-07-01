import { expect, test } from "@playwright/test";

const expectNoHorizontalOverflow = async (page: import("@playwright/test").Page): Promise<void> => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
};

test("mobile participant and teacher gates remain usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("참여자 코드")).toBeVisible();
  await page.getByLabel("참여자 코드").fill("S-MINSEO");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await expect(page.getByRole("heading", { name: "배정된 과제" })).toBeVisible();
  await expect(page.getByRole("button", { name: "역할 바꾸기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "교사 화면" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/export");
  await expect(page.getByRole("heading", { name: "교사 확인" })).toBeVisible();
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await expect(page.getByRole("heading", { name: "연구 로그" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
