import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const screensDir = resolve(".omo/evidence/pilot-writing-coach-100/screens");
await mkdir(screensDir, { recursive: true });

const settle = async (page) => {
  await page.waitForTimeout(260);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1728, height: 930 } });
  const enterTeacher = async () => {
    await page.getByLabel("교사 아이디").fill("teacher");
    await page.getByLabel("교사 비밀번호").fill("TEACHER-PILOT-2026");
    await page.getByRole("button", { name: "교사로 시작" }).click();
  };
  const enterStudent = async () => {
    await page.getByLabel("참여자 코드").fill("S-MINSEO");
    await page.getByRole("button", { name: "학생으로 시작" }).click();
  };

  await page.goto("http://127.0.0.1:5173/");
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "role-entry.png") });

  await enterTeacher();
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "teacher-list.png") });
  await page.getByRole("button", { name: "계정 관리" }).click();
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "teacher-account-management.png") });
  await page.getByRole("button", { name: "홈" }).click();

  await page.getByRole("button", { name: "미리보기 및 배정" }).click();
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "assignment-preview.png") });
  await page.getByRole("button", { name: "닫기" }).last().click();

  await page.goto("http://127.0.0.1:5173/assignments/new");
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "create-assignment-form.png") });

  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "역할 바꾸기" }).click();
  await enterStudent();
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "student-assigned-task.png") });

  await page.getByRole("button", { name: "과제 시작" }).click();
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "student-reading.png") });

  await page.getByRole("button", { name: "과제 보기" }).click();
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "student-assignment-reference.png") });
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "이해했어요" }).click();
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "student-thinking.png") });
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "student-warning.png") });

  await page.getByPlaceholder("코치에게 물어보기").fill("근거를 어떻게 확인할까?");
  await page.getByRole("button", { name: "보내기" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByLabel("설명 또는 연결 1").fill("편리함보다 환경 피해가 더 오래 남기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함도 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await page.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리고 생태계에 피해를 주기 때문이다.");
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "student-writing.png") });

  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await settle(page);
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "student-review.png") });
  await page.getByRole("button", { name: "제출" }).click();

  await page.goto("http://127.0.0.1:5173/review");
  await enterTeacher();
  await page.screenshot({ fullPage: true, path: resolve(screensDir, "teacher-review.png") });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  await mobile.goto("http://127.0.0.1:5173/");
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-role-entry.png") });
  await mobile.getByLabel("참여자 코드").fill("S-MINSEO");
  await mobile.getByRole("button", { name: "학생으로 시작" }).click();
  await settle(mobile);
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-student-assigned-task.png") });
  await mobile.getByRole("button", { name: "과제 시작" }).click();
  await settle(mobile);
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-student-reading.png") });
  await mobile.getByRole("button", { name: "이해했어요" }).click();
  await mobile.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await mobile.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await mobile.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await mobile.getByLabel("설명 또는 연결 1").fill("환경 피해가 오래 이어지기 때문이다.");
  await mobile.getByLabel("반대 의견").fill("편리함이 중요하다는 반론이 있다.");
  await mobile.getByRole("button", { name: "초안 쓰기 시작" }).click();
  await mobile.getByTestId("draft-editor").fill("일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리기 때문이다.");
  await mobile.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await settle(mobile);
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-student-review.png") });
  await mobile.getByRole("button", { name: "제출" }).click();
  await mobile.goto("http://127.0.0.1:5173/export");
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-teacher-gate.png") });
  await mobile.getByLabel("교사 아이디").fill("teacher");
  await mobile.getByLabel("교사 비밀번호").fill("TEACHER-PILOT-2026");
  await mobile.getByRole("button", { name: "교사로 시작" }).click();
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-export.png") });
  await mobile.goto("http://127.0.0.1:5173/review");
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-teacher-review.png") });
  await mobile.getByRole("button", { name: "홈" }).click();
  await mobile.getByRole("button", { name: "계정 관리" }).click();
  await mobile.screenshot({ fullPage: true, path: resolve(screensDir, "mobile-account-management.png") });
} finally {
  await browser.close();
}
