import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("right support pane keeps assignment details in the top task dialog", async ({ page }) => {
  await enterStudent(page);
  await expect(page.getByRole("tab", { name: "코치" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "과제" })).toHaveCount(0);
  await expect(page.getByText("Gemini 연결됨")).toHaveCount(0);
  await expect(page.getByText("gemini-2.5-flash-lite")).toHaveCount(0);
  await expect(page.getByText("single_group_baseline")).toHaveCount(0);
  await expect(page.getByText("evidence_check")).toHaveCount(0);
  await expect(page.getByText("challenge")).toHaveCount(0);
  await expect(page.getByText("explanation_rich")).toHaveCount(0);
  await expect(page.getByText("대신 쓰지 않고 질문으로 돕습니다")).toHaveCount(0);
  await expect(page.getByText("로컬 모의 코치")).toHaveCount(0);
  await expect(page.getByText("API 없이 규칙 기반으로만 응답합니다.")).toHaveCount(0);
  await page.getByRole("button", { name: "과제 보기" }).click();
  await expect(page.getByRole("dialog", { name: "과제 내용" })).toContainText("근거와 반론");
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "이해했어요" }).click();
  await expect(page.getByRole("button", { name: "개요 점검" })).toBeVisible();

  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("편리함보다 환경 피해가 더 오래 남기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함도 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await page.getByRole("tab", { name: "개요" }).click();
  await expect(page.getByLabel("개요 요약")).toContainText("일회용 플라스틱은 줄여야 한다");

  await page.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리고 생태계에 피해를 준다.");
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await expect(page.getByLabel("검토 제안")).toContainText("문장 표현");
});
