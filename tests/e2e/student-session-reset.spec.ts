import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("student chat starts fresh after reload and re-entry", async ({ page }) => {
  const message = "세션 초기화 확인 질문";

  await enterStudent(page);
  await page.getByPlaceholder("코치에게 물어보기").fill(message);
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText(message)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "과제 보기" })).toBeVisible();
  await expect(page.getByText(message)).toHaveCount(0);

  await page.getByPlaceholder("코치에게 물어보기").fill(message);
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText(message)).toBeVisible();
  await page.getByRole("button", { name: "로그아웃" }).click();

  await page.getByLabel("참여자 코드").fill("S-JOON");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await page.getByRole("button", { name: "과제 시작" }).click();
  await expect(page.getByRole("button", { name: "과제 보기" })).toBeVisible();
  await expect(page.getByText(message)).toHaveCount(0);
  await page.getByRole("button", { name: "로그아웃" }).click();

  await page.getByLabel("참여자 코드").fill("S-MINSEO");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await page.getByRole("button", { name: "과제 시작" }).click();
  await expect(page.getByRole("button", { name: "과제 보기" })).toBeVisible();
  await expect(page.getByText(message)).toHaveCount(0);
});
