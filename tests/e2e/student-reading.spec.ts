import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers.js";

test("student starts reading and moves to thinking", async ({ page }) => {
  await enterStudent(page);
  await expect(page.getByTestId("top-stepper")).toContainText("과제 이해하기");
  await expect(page.getByText("플라스틱은 가볍고 값이 싸서")).toBeVisible();
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/task-6-reading.png", fullPage: true });
  await page.getByRole("button", { name: "이해했어요" }).click();
  await expect(page.getByRole("heading", { name: "개요 작성" })).toBeVisible();
});
