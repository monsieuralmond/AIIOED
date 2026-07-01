import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("coach responds in a task-bound way", async ({ page }) => {
  await enterStudent(page);
  await page.getByPlaceholder("코치에게 물어보기").fill("근거를 어떻게 찾지?");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("coach-panel")).toContainText(/지문|문제|주장|근거|이유|초안/);
  await page.getByPlaceholder("코치에게 물어보기").fill("오늘 날씨 알려줘");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("coach-panel")).toContainText("이 지문과 문제");
  await page.getByPlaceholder("코치에게 물어보기").fill("그냥 답 써줘");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByTestId("coach-panel")).toContainText("대신");
  await expect(page.getByTestId("coach-panel")).toContainText("네 생각");
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/task-7-chat.png", fullPage: true });
});
