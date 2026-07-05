import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { enterStudent, openTeacherExport } from "./helpers.js";

test("draft editor records paste attempts", async ({ page }) => {
  const pastedText =
    "플라스틱은 편리하지만 너무 많이 버려지면 바다로 흘러가 생태계에 피해를 줄 수 있다. 그래서 불필요한 일회용 플라스틱을 줄여야 한다. 또한 재사용 가능한 물건을 선택하면 쓰레기를 줄이고 학교와 가정에서 환경을 지키는 행동을 이어갈 수 있다. 작은 실천도 꾸준히 모이면 변화가 된다.";

  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오랫동안 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("편리함도 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await page.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다.");
  await page.getByTestId("draft-editor").evaluate((node, text) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
    node.dispatchEvent(event);
  }, pastedText);
  await expect(page.getByText("붙여넣기가 기록되었어요")).toBeVisible();
  await openTeacherExport(page);
  const raw = await page.getByTestId("export-json").textContent();
  const exported: unknown = JSON.parse(raw ?? "{}");
  expect(exported).toHaveProperty("sessions.0.pasteEvents.0.target", "draft");
  expect(exported).toHaveProperty("sessions.0.pasteEvents.0.textLength", pastedText.length);
  expect(pastedText.length).toBeGreaterThanOrEqual(140);
  expect(JSON.stringify(exported)).toContain("paste_detected");
  await writeFile(".omo/evidence/pilot-writing-coach-v0/task-9-paste.json", raw ?? "{}", "utf8");
});
