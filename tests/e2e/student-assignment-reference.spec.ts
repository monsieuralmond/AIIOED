import { expect, test } from "@playwright/test";
import { enterStudent, enterStudentCredentials, expectStudentWorkspace, openTeacherExport } from "./helpers.js";

test("student starts from an assigned task and can reopen assignment details mid-task", async ({ page }) => {
  await page.goto("/");
  await enterStudentCredentials(page, { loginId: "s001", participantCode: "S001", password: "test" });
  await expectStudentWorkspace(page);
  await expect(page.getByRole("heading", { name: "플라스틱 사용을 줄여야 할까?" })).toBeVisible();

  await expect(page.getByTestId("top-stepper")).toContainText("과제 이해하기");
  await page.getByRole("button", { name: "과제 보기" }).click();
  await expect(page.getByRole("dialog", { name: "과제 내용" })).toContainText("근거와 반론");
  await expect(page.getByRole("dialog", { name: "과제 내용" })).toContainText("읽기 전에 확인");
});

test("assignment reference preserves outline and draft state while writing", async ({ page }) => {
  await enterStudent(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문 2문단");
  await page.getByLabel("설명 또는 연결 1").fill("편리함보다 환경 피해가 더 오래 남기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함도 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await page.getByLabel("최종 글쓰기").fill("일회용 플라스틱은 줄여야 한다. 지문에서 말한 긴 분해 시간 때문이다.");

  await page.getByRole("button", { name: "과제 보기" }).click();
  await expect(page.getByRole("dialog", { name: "과제 내용" })).toContainText("초안 쓰기 전에 확인");
  await page.getByRole("button", { name: "닫기" }).click();

  await expect(page.getByLabel("최종 글쓰기")).toHaveValue("일회용 플라스틱은 줄여야 한다. 지문에서 말한 긴 분해 시간 때문이다.");
  await page.getByRole("tab", { name: "개요" }).click();
  await expect(page.getByLabel("개요 요약")).toContainText("일회용 플라스틱은 줄여야 한다");
});

test("student can return to earlier writing stages without losing work", async ({ page }) => {
  await enterStudent(page);
  await expect(page.getByRole("button", { name: "이전 단계" })).toBeDisabled();

  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문 2문단");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오래 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("편리함이 중요하다는 의견도 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();

  const draft = "일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리고 생태계에 피해를 주기 때문이다.";
  await page.getByLabel("최종 글쓰기").fill(draft);
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await expect(page.getByTestId("work-pane").getByRole("heading", { name: "고쳐쓰기" })).toBeVisible();

  await page.getByRole("button", { name: "이전 단계" }).click();
  await expect(page.getByRole("heading", { name: "초안 쓰기" })).toBeVisible();
  await expect(page.getByLabel("최종 글쓰기")).toHaveValue(draft);

  await page.getByRole("button", { name: "이전 단계" }).click();
  await expect(page.getByRole("heading", { name: "개요 작성" })).toBeVisible();
  await expect(page.getByLabel("중심 생각")).toHaveValue("일회용 플라스틱은 줄여야 한다");
  await expect(page.getByLabel("근거 또는 예시 1")).toHaveValue("분해가 오래 걸린다");
  await expect(page.getByLabel("출처 메모")).toHaveValue("- 지문 2문단");

  await page.getByRole("button", { name: "이전 단계" }).click();
  await expect(page.getByRole("heading", { name: "과제 이해하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "이전 단계" })).toBeDisabled();
});

test("student home before starting keeps the assigned-task entry point", async ({ page }) => {
  await page.goto("/");
  await enterStudentCredentials(page, { loginId: "s001", participantCode: "S001", password: "test" });
  await page.getByRole("button", { name: "홈" }).click();
  await expect(page.getByRole("heading", { name: "배정된 과제" })).toBeVisible();

  await expectStudentWorkspace(page);
  await page.getByRole("button", { name: "이해했어요" }).click();
  await expect(page.getByRole("heading", { name: "개요 작성" })).toBeVisible();
});

test("direct student URL creates the session for the selected student", async ({ page }) => {
  await page.goto("/");
  await enterStudentCredentials(page, { loginId: "s002", participantCode: "S002", password: "test" });

  await page.goto("/student");
  await page.getByRole("button", { name: "이해했어요" }).click();
  await openTeacherExport(page);

  const raw = await page.getByTestId("export-json").textContent();
  const exported: unknown = JSON.parse(raw ?? "{}");
  expect(exported).toHaveProperty("sessions.0.student.accountId", "student-s002");
});
