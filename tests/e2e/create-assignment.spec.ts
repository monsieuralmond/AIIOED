import { expect, test } from "@playwright/test";
import { enterTeacher } from "./helpers";

const passage =
  "플라스틱은 가볍고 값이 싸서 일상에서 널리 쓰인다. 하지만 한 번 쓰고 버려지는 플라스틱은 분해되는 데 오랜 시간이 걸리며, 강과 바다로 흘러가 생태계에 피해를 줄 수 있다.";

test("researcher creates a Korean nonfiction assignment", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "새 과제 만들기" }).click();
  await page.getByLabel("과제 제목").fill("플라스틱 사용을 줄여야 할까?");
  await page.getByLabel("비문학 지문").fill(passage);
  await page.getByLabel("해결할 문제").fill("일회용 플라스틱 사용을 줄여야 하는지 주장하세요.");
  await page.getByLabel("학년 또는 난이도").selectOption("초등 고학년");
  await page.getByRole("button", { name: "저장" }).click();
  const createdAssignment = page.getByRole("article").filter({ hasText: "일회용 플라스틱 사용을 줄여야 하는지 주장하세요." });
  await expect(createdAssignment.getByRole("heading", { name: "플라스틱 사용을 줄여야 할까?" })).toBeVisible();
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/task-5-create.png", fullPage: true });
});
