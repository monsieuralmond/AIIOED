import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("writing stage keeps the student's outline visible without drafting for them", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오랫동안 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함도 중요하다는 반론이 있다.");

  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();

  await expect(page.getByRole("heading", { name: "초안 쓰기" })).toBeVisible();
  await expect(page.getByRole("region", { name: "초안 작성용 개요" })).toBeVisible();
  await expect(page.getByText("일회용 플라스틱은 줄여야 한다")).toBeVisible();
  await expect(page.getByText("분해가 오래 걸린다")).toBeVisible();
  await expect(page.getByText("생태계에 피해를 준다")).toBeVisible();
  await expect(page.getByText("플라스틱 분해와 생태계 피해 문장")).toBeVisible();
  await expect(page.getByText("위생과 편리함도 중요하다는 반론이 있다.")).toBeVisible();
  await expect(page.getByTestId("draft-editor")).toHaveValue("");
  await expect(page.getByRole("button", { name: /복사/ })).toHaveCount(0);
});
