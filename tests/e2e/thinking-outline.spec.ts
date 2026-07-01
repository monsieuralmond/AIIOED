import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("thinking outline warns when weak and proceeds when complete", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByRole("button", { name: "다음 단계" }).click();
  await expect(page.getByText("생각 정리가 아직 부족해요")).toBeVisible();
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await expect(page.getByText("생각 정리가 아직 부족해요")).toBeVisible();
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/task-8-warning.png", fullPage: true });
  await expect(page.getByText("출처 메모를 남겨보세요")).toBeVisible();

  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByRole("button", { name: "출처 추가" }).click();
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("편리함보다 환경 피해가 더 오래 남기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함도 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await expect(page.getByRole("heading", { name: "초안 쓰기" })).toBeVisible();
  await expect(page.getByText("생각 정리가 아직 부족해요")).not.toBeVisible();
});

test("thinking outline lets students delete evidence and source rows", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByRole("button", { name: "다음 단계" }).click();

  await expect(page.getByRole("button", { name: "1번 근거 삭제" })).toBeVisible();
  await page.getByRole("button", { name: "근거 추가" }).click();
  await page.getByLabel("근거 또는 예시 3").fill("학교 급식에서 남는 플라스틱 용기가 많다.");
  await page.getByRole("button", { name: "3번 근거 삭제" }).click();
  await expect(page.getByLabel("근거 또는 예시 3")).toHaveCount(0);

  await expect(page.getByRole("button", { name: "1번 출처 삭제" })).toBeDisabled();
  await page.getByRole("button", { name: "출처 추가" }).click();
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해 시간이 길다는 문장");
  await page.getByRole("button", { name: "출처 추가" }).click();
  await page.getByLabel("출처 메모 2").fill("- 환경부 자료: 일회용품 사용량 통계");
  await page.getByRole("button", { name: "2번 출처 삭제" }).click();
  await expect(page.getByLabel("출처 메모 2")).toHaveCount(0);
  await expect(page.getByLabel("출처 메모")).toHaveValue("- 지문: 플라스틱 분해 시간이 길다는 문장");
});

test("thinking outline guides the next visible writing step", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();

  await expect(page.getByRole("heading", { name: "지금 할 일" })).toBeVisible();
  await expect(page.getByText("중심 생각부터 정해요")).toBeVisible();

  await page.getByRole("button", { name: "작성 위치로 이동" }).click();
  await expect(page.getByLabel("중심 생각")).toBeFocused();

  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await expect(page.getByText("근거를 두 개 고르세요")).toBeVisible();

  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await expect(page.getByText("출처를 남겨요")).toBeVisible();

  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("편리함보다 환경 피해가 더 오래 남기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함도 중요하다는 반론이 있다.");
  await expect(page.getByText("초안으로 옮길 준비가 되었어요")).toBeVisible();
});
