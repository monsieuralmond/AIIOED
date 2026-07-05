import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers.js";

test("review stage shows deterministic suggestions and submits", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오래 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함이 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await page.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리고 생태계에 피해를 주기 때문이다.");
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await expect(page.getByLabel("검토 제안").getByText("문장 표현")).toBeVisible();
  await page.getByRole("button", { name: "해결 표시" }).first().click();
  await expect(page.getByRole("button", { name: "확인됨" })).toBeVisible();
  await page.getByRole("button", { name: "제출" }).click();
  await expect(page.getByText("제출 완료")).toBeVisible();
});
