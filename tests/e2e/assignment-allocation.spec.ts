import { expect, test } from "@playwright/test";
import { enterStudentCredentials, enterTeacher, expectStudentWorkspace } from "./helpers.js";

const newClassName = "새 배정반";
const newStudentCode = "S-ASSIGN-NEW";
const newAssignmentTitle = "새 학생 전용 과제";

test("student sees the assignment assigned to their own class", async ({ page }) => {
  await enterTeacher(page);

  await page.getByRole("button", { name: "계정 관리" }).click();
  await page.getByLabel("새 반 이름").fill(newClassName);
  await page.getByRole("button", { name: "반 만들기" }).click();
  await page.getByLabel("학생 반").selectOption({ label: newClassName });
  await page.getByLabel("학생 이름", { exact: true }).fill("새학생");
  await page.getByLabel("학생 번호").fill("12");
  await page.getByLabel("참여자 코드").fill(newStudentCode);
  await page.getByRole("button", { name: "학생 만들기" }).click();
  await page.getByRole("button", { name: "과제로 돌아가기" }).click();

  await page.getByRole("button", { name: "내 과제 만들기" }).click();
  await page.getByLabel("과제 제목").fill(newAssignmentTitle);
  await page.getByLabel("배정할 반").selectOption({ label: newClassName });
  await page.getByLabel("비문학 지문").fill("새 반 학생이 읽어야 하는 지문입니다. 새로운 자료를 비교하며 자신의 생각을 세우는 연습을 합니다.");
  await page.getByLabel("해결할 문제").fill("새 반 학생은 이 지문을 바탕으로 자신의 주장을 쓰세요.");
  await page.getByLabel("학생에게 보일 요구사항").fill("지문에서 찾은 내용과 자신의 생각을 함께 쓰세요.");
  await page.getByRole("button", { name: "과제 저장" }).click();
  const createdAssignment = page.getByRole("article", { name: `${newAssignmentTitle} 과제` });
  await createdAssignment.getByRole("button", { name: "배정", exact: true }).click();
  const assignmentDialog = page.getByRole("dialog", { name: "과제 배정" });
  await assignmentDialog.getByRole("checkbox", { name: "12번 새학생" }).check();
  await assignmentDialog.getByRole("button", { name: "배정 저장" }).click();
  await createdAssignment.getByRole("button", { name: "미리보기" }).click();
  await page.getByRole("button", { name: "미리보기 닫기" }).click();

  await page.getByRole("button", { name: "역할 바꾸기" }).click();
  await enterStudentCredentials(page, { loginId: newStudentCode.toLowerCase(), participantCode: newStudentCode, password: newStudentCode });

  await expectStudentWorkspace(page);
  await expect(page.getByRole("main")).toContainText(newAssignmentTitle);
  await expect(page.getByRole("main")).not.toContainText("플라스틱 사용을 줄여야 할까?");
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/assignment-allocation-student-home.png", fullPage: true });

  await expect(page.getByRole("button", { name: "과제 보기" })).toBeVisible();
  await page.getByRole("button", { name: "과제 보기" }).click();
  await expect(page.getByRole("dialog")).toContainText(newAssignmentTitle);
});
