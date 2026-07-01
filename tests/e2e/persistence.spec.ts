import { expect, test } from "@playwright/test";
import { enterTeacher } from "./helpers";

test("assignment persists through browser reload", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "새 과제 만들기" }).click();
  await page.getByLabel("과제 제목").fill("저장되는 비문학 과제");
  await page.getByLabel("비문학 지문").fill("지문은 학생이 읽고 자신의 생각을 정리할 수 있을 만큼 충분히 길게 제공된다.");
  await page.getByLabel("해결할 문제").fill("이 지문을 바탕으로 자신의 주장을 쓰세요.");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장되는 비문학 과제")).toBeVisible();

  await page.reload();

  await expect(page.getByText("저장되는 비문학 과제")).toBeVisible();
});
