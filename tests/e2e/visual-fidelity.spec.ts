import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("desktop and mobile layout respect clone constraints", async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 930 });
  await enterStudent(page);
  const topBar = await page.locator(".top-bar").boundingBox();
  const workPane = await page.getByTestId("work-pane").boundingBox();
  const coachPane = await page.getByTestId("coach-panel").boundingBox();
  expect(topBar?.height).toBeGreaterThanOrEqual(48);
  expect(topBar?.height).toBeLessThanOrEqual(56);
  expect(workPane?.width).toBeGreaterThan(820);
  expect(coachPane?.width).toBeGreaterThan(520);
  await expect(page.getByText("복사")).toHaveCount(0);
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/screens/student-reading.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("work-pane")).toBeVisible();
});
