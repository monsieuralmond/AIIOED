import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

test("student workspace follows the video-like writing coach stage model", async ({ page }) => {
  await enterStudent(page);

  await expect(page.getByTestId("top-stepper")).toContainText("과제 이해하기");
  await expect(page.getByTestId("top-stepper")).toContainText("개요 작성");
  await expect(page.getByTestId("top-stepper")).toContainText("초안 쓰기");
  await expect(page.getByTestId("top-stepper")).toContainText("고쳐쓰기");
  await expect(page.getByRole("heading", { name: "과제 이해하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "과제 설명해줘" })).toBeVisible();
  await expect(page.getByRole("button", { name: "요구사항 확인" })).toBeVisible();
  await expect(page.getByText("연구 파일럿")).toHaveCount(0);
  await expect(page.getByText("비문학 글쓰기 연습")).toHaveCount(0);

  await page.getByRole("button", { name: "이해했어요" }).click();
  await expect(page.getByRole("heading", { name: "개요 작성" })).toBeVisible();
  await expect(page.getByLabel("중심 생각")).toBeVisible();
  await expect(page.getByLabel("근거 또는 예시 1")).toBeVisible();
  await expect(page.getByLabel("출처 메모")).toBeVisible();
  await expect(page.getByRole("button", { name: "출처 추가" })).toBeVisible();
  await expect(page.getByLabel("설명 또는 연결 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "근거 추가" })).toBeVisible();
  await expect(page.getByRole("button", { name: "개요 점검" })).toBeVisible();
});

test("right panel has animated tabs for chat, outline, and feedback", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("오래 남는 쓰레기는 환경 피해를 키운다.");
  await page.getByLabel("반대 의견").fill("편리함이 중요하다는 의견도 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();

  await expect(page.getByRole("tab", { name: "코치" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "개요" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "과제" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "과제 보기" })).toBeVisible();
  await page.getByRole("tab", { name: "개요" }).click();
  await expect(page.getByTestId("coach-panel")).toHaveAttribute("data-active-tab", "outline");

  const transition = await page.locator(".coach-panel-content").evaluate((node) => getComputedStyle(node).transitionProperty);
  expect(transition).toContain("opacity");
  expect(transition).toContain("transform");

  const coachCopyPrevented = await page.getByTestId("coach-panel").evaluate((element) => {
    const event = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
    return !element.dispatchEvent(event);
  });
  expect(coachCopyPrevented).toBe(true);
});

test("revision stage exposes category-based suggestions with resolution controls", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오래 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("편리함이 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await page.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리기 때문이다.");
  let reviewApiCalls = 0;
  await page.route("**/api/review/check", async (route) => {
    reviewApiCalls += 1;
    await route.continue();
  });
  await page.route("**/api/review/suggestions", async (route) => {
    reviewApiCalls += 1;
    await route.continue();
  });
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();

  await expect(page.getByRole("tab", { name: "피드백" })).toBeVisible();
  await expect(page.getByText("1. 주장과 초점")).toBeVisible();
  await expect(page.getByText("2. 근거와 설명")).toBeVisible();
  await expect(page.getByText("3. 구조와 흐름")).toBeVisible();
  await expect(page.getByText("4. 문장 표현")).toBeVisible();
  await expect(page.getByLabel("고쳐쓰기 진행 상황")).toContainText("남은 제안");
  await expect(page.getByLabel("해결한 제안 0개")).toBeVisible();
  await page.getByRole("button", { name: "제안 보기" }).first().click();
  await expect(page.getByTestId("draft-highlighted-span")).toContainText("분해가 오래 걸리기 때문이다.");
  await expect(page.getByLabel("현재 볼 곳")).toContainText("근거가 들어가야 할 문장");
  await expect(page.getByRole("button", { name: "내 수정 확인" })).toBeVisible();
  await page.getByRole("button", { name: "내 수정 확인" }).click();
  await expect(page.getByText("개요에 쓴 근거 두 가지가 초안에 아직 모두 들어가지 않았어요.")).toBeVisible();
  await page.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다. 지문에서는 플라스틱이 분해가 오래 걸린다고 했다. 또 강과 바다로 흘러가 생태계에 피해를 준다고 설명했다. 위생과 편리함이 중요하다는 의견도 있다. 하지만 한 번 쓰고 버리는 물건이 계속 늘어나면 피해가 오래 남는다. 그래서 학교와 집에서는 재사용 가능한 물건을 더 쓰고 불필요한 포장을 줄여야 한다.");
  await page.getByRole("button", { name: "내 수정 확인" }).click();
  await expect(page.getByText("수정이 확인됐어요. 이 제안을 해결로 표시했어요.")).toBeVisible();
  await expect(page.getByLabel("해결한 제안 1개")).toBeVisible();
  await expect(page.getByRole("button", { name: "확인됨" })).toBeVisible();
  await expect(page.getByRole("button", { name: "해결 표시" })).toBeVisible();
  await expect(page.locator(".feedback-category.active")).toContainText("2. 근거와 설명");
  await expect(page.getByText("지금 볼 곳")).toBeVisible();
  await expect(page.getByTestId("work-pane").getByText("근거가 들어가야 할 문장")).toBeVisible();
  await expect(page.getByTestId("draft-highlighted-span")).toContainText("지문에서는 플라스틱이 분해가 오래 걸린다고 했다.");
  expect(reviewApiCalls).toBe(0);
});
