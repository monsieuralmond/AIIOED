import { expect, type Page } from "@playwright/test";

export const enterTeacher = async (page: Page): Promise<void> => {
  await page.goto("/");
  await enterTeacherCredentials(page, { loginId: "test", password: "test" });
};

export const enterTeacherCredentials = async (
  page: Page,
  input: { readonly loginId: string; readonly password: string }
): Promise<void> => {
  const teacherRole = page.getByRole("button", { name: "교사 계정" });
  if (await teacherRole.count() > 0) await teacherRole.click();
  await page.getByLabel("아이디").fill(input.loginId);
  await page.getByLabel("비밀번호").fill(input.password);
  await page.getByRole("button", { name: "로그인" }).click();
};

export const enterStudent = async (page: Page): Promise<void> => {
  await page.goto("/");
  await enterStudentCredentials(page, { loginId: "s001", participantCode: "S001", password: "test" });
  await expectStudentWorkspace(page);
};

export const enterStudentCredentials = async (
  page: Page,
  input: { readonly loginId: string; readonly participantCode: string; readonly password: string }
): Promise<void> => {
  await page.getByRole("button", { name: "학생 계정" }).click();
  await page.getByLabel("참여자 코드").fill(input.participantCode);
  await page.getByLabel("아이디").fill(input.loginId);
  await page.getByLabel("비밀번호").fill(input.password);
  await page.getByRole("button", { name: "로그인" }).click();
};

export const expectStudentWorkspace = async (page: Page): Promise<void> => {
  const startButton = page.getByRole("button", { name: "과제 시작" });
  const taskButton = page.getByRole("button", { name: "과제 보기" });
  await taskButton.or(startButton).first().waitFor({ state: "visible" });
  if (await startButton.count() > 0) await startButton.first().click();
  await taskButton.waitFor({ state: "visible" });
};

export const openAdminExport = async (page: Page): Promise<void> => {
  const logoutButton = page.getByRole("button", { name: "로그아웃" });
  if (await logoutButton.count() > 0) {
    await logoutButton.click();
    await page.getByRole("button", { name: "관리자" }).waitFor({ state: "visible" });
  } else {
    const switchRoleButton = page.getByRole("button", { name: "역할 바꾸기" });
    if (await switchRoleButton.count() > 0) {
      await switchRoleButton.click();
      await page.getByRole("button", { name: "관리자" }).waitFor({ state: "visible" });
    }
  }
  const adminEntry = page.getByRole("button", { name: "관리자" });
  const adminLogin = page.getByRole("heading", { name: "관리자 로그인" });
  if (await adminEntry.count() > 0) {
    await adminEntry.click();
    await adminLogin.waitFor({ state: "visible" });
  } else {
    await page.goto("/export");
  }
  if (await adminLogin.count() > 0) {
    await page.getByLabel("아이디").fill("admin");
    await page.getByLabel("비밀번호").fill("test");
    await page.getByRole("button", { name: "로그인" }).click();
  }
  const logButton = page.getByRole("button", { name: "로그 보기" });
  if (await logButton.count() > 0) await logButton.click();
  else await page.goto("/export");
  await expect(page.getByRole("heading", { name: "연구 로그" })).toBeVisible();
};

export const switchToTeacher = async (page: Page): Promise<void> => {
  const logoutButton = page.getByRole("button", { name: "로그아웃" });
  if (await logoutButton.count() > 0) {
    await logoutButton.click();
    await enterTeacherCredentials(page, { loginId: "test", password: "test" });
    return;
  }
  const switchRoleButton = page.getByRole("button", { name: "역할 바꾸기" });
  if (await switchRoleButton.count() > 0) {
    await switchRoleButton.click();
    await enterTeacherCredentials(page, { loginId: "test", password: "test" });
  }
};
