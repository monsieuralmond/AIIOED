import type { Page } from "@playwright/test";

export const enterTeacher = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
};

export const enterStudent = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByLabel("참여자 코드").fill("S-MINSEO");
  await page.getByRole("button", { name: "학생으로 시작" }).click();
  await page.getByRole("button", { name: "과제 시작" }).click();
};

export const openTeacherExport = async (page: Page): Promise<void> => {
  await page.goto("/export");
  await page.getByLabel("교사 아이디").fill("test");
  await page.getByLabel("교사 비밀번호").fill("test");
  await page.getByRole("button", { name: "교사로 시작" }).click();
};
