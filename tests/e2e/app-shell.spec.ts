import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers.js";

test("app shell renders core Khan-style surfaces", async ({ page }) => {
  await enterStudent(page);
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("top-stepper")).toContainText("과제 이해하기");
  await expect(page.getByTestId("work-pane")).toBeVisible();
  await expect(page.getByTestId("coach-panel")).toBeVisible();
});
