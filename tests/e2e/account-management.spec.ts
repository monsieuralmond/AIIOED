import { expect, test } from "@playwright/test";
import { enterStudentCredentials, enterTeacher, expectStudentWorkspace } from "./helpers.js";

test("teacher account manages classes and numbered students", async ({ page }) => {
  await enterTeacher(page);

  await page.getByRole("button", { name: "계정 관리" }).click();
  await expect(page.getByRole("heading", { name: "계정 관리" })).toBeVisible();
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("김민서");
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("1번");

  await page.getByLabel("새 반 이름").fill("3반");
  await page.getByRole("button", { name: "반 만들기" }).click();
  await expect(page.getByRole("table", { name: "반 목록" })).toContainText("3반");

  await page.getByLabel("학생 반").selectOption({ label: "3반" });
  await page.getByLabel("학생 이름", { exact: true }).fill("최하늘");
  await page.getByLabel("학생 번호").fill("7");
  await page.getByLabel("참여자 코드").fill("S-HANEUL");
  await page.getByRole("button", { name: "학생 만들기" }).click();
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("최하늘");
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("7번");
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("S-HANEUL");
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("s-haneul");

  await page.getByLabel("일괄 생성 반").selectOption({ label: "3반" });
  await page.getByLabel("시작 번호").fill("8");
  await page.getByLabel("생성 갯수").fill("3");
  await page.getByLabel("아이디 접두어").fill("class3-");
  await page.getByLabel("비밀번호 접두어").fill("pw-");
  await page.getByLabel("학생 이름 접두어").fill("연구학생");
  await page.getByRole("button", { name: "학생 일괄 만들기" }).click();
  await expect(page.getByText("학생 계정 3개를 만들었습니다.")).toBeVisible();
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("연구학생 8");
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("class3-08");
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).toContainText("pw-08");

  await page.getByRole("button", { name: "과제로 돌아가기" }).click();
  const sampleAssignment = page.getByRole("article", { name: "플라스틱 사용을 줄여야 할까? 과제" });
  await sampleAssignment.getByRole("button", { name: "배정", exact: true }).click();
  const sampleAssignmentDialog = page.getByRole("dialog", { name: "과제 배정" });
  await sampleAssignmentDialog.getByLabel("배정할 반").selectOption({ label: "3반" });
  await sampleAssignmentDialog.getByRole("button", { name: "전체 선택" }).click();
  await sampleAssignmentDialog.getByRole("button", { name: "배정 저장" }).click();
  await page.getByRole("button", { name: "학생 현황" }).click();
  await page.getByLabel("반 선택").selectOption({ label: "파일럿 반" });
  await expect(page.getByRole("heading", { name: "플라스틱 사용을 줄여야 할까?" })).toBeVisible();
  await expect(page.getByText("파일럿 반 · 2명 중 0명 제출")).toBeVisible();
  await expect(page.getByRole("article", { name: "김민서 상태" })).toBeVisible();
  await page.getByLabel("반 선택").selectOption({ label: "3반" });
  await expect(page.getByText("3반 · 4명 중 0명 제출")).toBeVisible();
  await expect(page.getByRole("article", { name: "연구학생 8 상태" })).toBeVisible();
  await page.getByRole("button", { name: "과제 목록" }).click();

  await page.getByRole("button", { name: "내 과제 만들기" }).click();
  await page.getByLabel("과제 제목").fill("3반 배정 과제");
  await page.getByLabel("배정할 반").selectOption({ label: "3반" });
  await page.getByLabel("비문학 지문").fill("3반 학생이 읽고 자신의 생각을 정리할 지문입니다.");
  await page.getByLabel("해결할 문제").fill("이 지문을 바탕으로 자신의 생각을 쓰세요.");
  await page.getByLabel("학생에게 보일 요구사항").fill("읽은 내용을 바탕으로 자신의 생각을 한 문단 이상 쓰세요.");
  await page.getByRole("button", { name: "과제 저장" }).click();
  const assignment = page.getByRole("article", { name: "3반 배정 과제 과제" });
  await expect(assignment).toBeVisible();
  await assignment.getByRole("button", { name: "배정", exact: true }).click();
  const assignmentDialog = page.getByRole("dialog", { name: "과제 배정" });
  await assignmentDialog.getByRole("button", { name: "전체 선택" }).click();
  await assignmentDialog.getByRole("button", { name: "배정 저장" }).click();

  await page.getByRole("button", { name: "학생 현황" }).click();
  await page.getByLabel("반 선택").selectOption({ label: "3반" });
  await expect(page.getByRole("heading", { name: "3반 배정 과제" })).toBeVisible();
  await expect(page.getByText("3반 · 4명 중 0명 제출")).toBeVisible();
  await expect(page.getByRole("article", { name: "최하늘 상태" })).toBeVisible();
  await expect(page.getByRole("article", { name: "연구학생 8 상태" })).toBeVisible();
  await expect(page.getByRole("article", { name: "김민서 상태" })).toHaveCount(0);

  await page.getByRole("button", { name: "역할 바꾸기" }).click();
  await enterStudentCredentials(page, { loginId: "class3-08", participantCode: "CLASS3-08", password: "pw-08" });
  await expectStudentWorkspace(page);
  await expect(page.getByRole("navigation")).toContainText("연구학생 8");
});

test("teacher deletes individual class and student rows", async ({ page }) => {
  await enterTeacher(page);

  await page.getByRole("button", { name: "계정 관리" }).click();
  await page.getByLabel("새 반 이름").fill("삭제반");
  await page.getByRole("button", { name: "반 만들기" }).click();
  await page.getByLabel("학생 반").selectOption({ label: "삭제반" });
  await page.getByLabel("학생 이름", { exact: true }).fill("삭제학생");
  await page.getByLabel("학생 번호").fill("11");
  await page.getByLabel("참여자 코드").fill("S-DELETE");
  await page.getByRole("button", { name: "학생 만들기" }).click();
  await page.getByRole("button", { name: "학생 삭제: 삭제학생" }).click();
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).not.toContainText("삭제학생");
  await page.getByRole("button", { name: "반 삭제: 삭제반" }).click();
  await expect(page.getByRole("table", { name: "반 목록" })).not.toContainText("삭제반");
});

test("account management remains usable on a 390px teacher screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterTeacher(page);

  await page.getByRole("button", { name: "계정 관리" }).click();

  await expect(page.getByRole("heading", { name: "계정 관리" })).toBeVisible();
  await expect(page.getByLabel("새 반 이름")).toBeVisible();
  await expect(page.getByLabel("학생 번호")).toBeVisible();
  await expect(page.getByLabel("생성 갯수")).toBeVisible();
  await expect(page.getByRole("button", { name: "학생 일괄 만들기" })).toBeVisible();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(horizontalOverflow).toBe(false);
});
