import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("writing stage checks whether the student's own draft reflects the outline", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오랫동안 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함도 중요하다는 반론이 있다.");

  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();

  const check = page.getByRole("region", { name: "초안 준비 점검" });
  await expect(check).toBeVisible();
  await expect(check.getByText("0/4")).toBeVisible();
  await expect(check.getByText("다시 보기")).toHaveCount(4);

  await page.getByTestId("draft-editor").fill([
    "일회용 플라스틱은 줄여야 한다.",
    "지문에서 플라스틱 분해와 생태계 피해를 확인할 수 있다.",
    "위생과 편리함도 중요하지만 환경 피해가 오래 남는다."
  ].join(" "));

  await expect(check.getByText("4/4")).toBeVisible();
  await expect(check.getByText("확인됨")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /복사/ })).toHaveCount(0);
});
