import { expect, test } from "@playwright/test";

const completeStudentWriting = async (page: import("@playwright/test").Page): Promise<void> => {
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByPlaceholder("코치에게 물어보기").fill("근거를 어떻게 확인할까?");
  await page.getByRole("button", { name: "보내기" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오래 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함이 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "개요 점검" }).click();
  await expect(page.getByText("개요가 준비됐어요")).toBeVisible();
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await page.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리고 생태계에 피해를 주기 때문이다.");
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await page.getByRole("button", { name: "내 수정 확인" }).click();
  await expect(page.locator(".suggestion-check-result")).toBeVisible();
  await page.getByRole("button", { name: "제출" }).click();
};

test("teacher can assign, monitor, and review a student's process record", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await page.getByRole("button", { name: "미리보기 및 배정" }).click();
  await expect(page.getByRole("dialog", { name: "과제 미리보기" })).toContainText("플라스틱 사용을 줄여야 할까?");
  await expect(page.getByLabel("배정할 반")).toHaveValue("class-pilot");
  await expect(page.getByText("파일럿 반 학생 2명에게 보입니다.")).toBeVisible();
  await page.getByRole("button", { name: "선택한 반에 배정" }).click();
  await page.getByRole("button", { name: "학생 현황" }).click();
  await expect(page.getByRole("article", { name: "김민서 상태" })).toBeVisible();
  await expect(page.getByRole("article", { name: "김민서 상태" })).toContainText("시작 전");
  await expect(page.getByRole("article", { name: "김민서 과정 기록" })).toContainText("참여자 코드");
  await expect(page.getByRole("article", { name: "김민서 과정 기록" })).toContainText("과제를 시작하면 자동으로 모입니다");

  await page.getByRole("button", { name: "역할 바꾸기" }).click();
  await page.getByLabel("참여자 코드").fill("S-MINSEO");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await page.getByRole("button", { name: "과제 시작" }).click();
  await completeStudentWriting(page);
  await expect(page.getByText("제출 완료")).toBeVisible();
  await expect(page.getByRole("button", { name: "역할 바꾸기" })).toHaveCount(0);

  await page.goto("/review");
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await expect(page.getByRole("article", { name: "김민서 상태" }).getByText("제출 완료", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "제출 완료 1" }).click();
  await expect(page.getByRole("article", { name: "김민서 상태" })).toBeVisible();
  await expect(page.getByRole("article", { name: "이준 상태" })).toHaveCount(0);
  await page.getByLabel("학생 검색").fill("민서");
  await expect(page.getByRole("article", { name: "김민서 상태" })).toBeVisible();
  await page.getByRole("button", { name: "김민서 과정 보기" }).click();
  await expect(page.getByRole("heading", { name: "과정 점검 요약" })).toBeVisible();
  await expect(page.getByText("주장 있음")).toBeVisible();
  await expect(page.getByText("근거 2개")).toBeVisible();
  await expect(page.getByText("반론 있음")).toBeVisible();
  await expect(page.getByText("최종 제출됨")).toBeVisible();
  const signalPanel = page.locator(".process-signal-panel");
  await expect(signalPanel).toContainText("출처 메모");
  await expect(signalPanel).toContainText("개요 점검");
  await expect(signalPanel).toContainText("통과");
  await expect(signalPanel).toContainText("제안 보기");
  await expect(signalPanel).toContainText("수정 확인");
  await expect(signalPanel).toContainText("미해결");
  await expect(page.getByRole("heading", { name: "최종 글" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "대화 기록" })).toBeVisible();
  await expect(page.getByText("근거를 어떻게 확인할까?")).toBeVisible();
  await expect(page.getByRole("blockquote")).toContainText("일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리고 생태계에 피해를 주기 때문이다.");
  await expect(page.getByText("생각 정리 기록")).toBeVisible();
  await expect(page.getByText("초안 기록")).toBeVisible();
  await expect(page.getByRole("heading", { name: "교사 검토" })).toBeVisible();
  await page.getByLabel("검토 완료").check();
  await page.getByLabel("교사 메모").fill("근거 요청과 반론 작성이 확인됨.");
  await page.getByRole("button", { name: "검토 저장" }).click();
  await expect(page.getByText("검토 기록이 저장되었습니다.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("교사 메모")).toHaveValue("근거 요청과 반론 작성이 확인됨.");
  await expect(page.getByLabel("검토 완료")).toBeChecked();
  await page.getByRole("button", { name: "검토 완료 1" }).click();
  await expect(page.getByRole("article", { name: "김민서 상태" })).toBeVisible();
  await expect(page.getByRole("article", { name: "이준 상태" })).toHaveCount(0);
  await page.getByRole("button", { name: "추가 확인 필요 0" }).click();
  await expect(page.getByText("조건에 맞는 학생이 없습니다.")).toBeVisible();

  await page.getByRole("button", { name: "홈" }).click();
  await page.getByRole("button", { name: "로그 보기" }).click();
  const raw = await page.getByTestId("export-json").textContent();
  expect(raw).not.toBeNull();
  const exported: unknown = JSON.parse(raw ?? "{}");
  expect(exported).toHaveProperty("sessions.0.teacherReview.status", "reviewed");
  expect(exported).toHaveProperty("sessions.0.teacherReview.note", "근거 요청과 반론 작성이 확인됨.");
});

test("selected teacher role persists across reloads", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await expect(page.getByText("연구 교사")).toBeVisible();

  await page.reload();

  await expect(page.getByText("연구 교사")).toBeVisible();
  await expect(page.getByRole("button", { name: "새 과제 만들기" })).toBeVisible();
});
