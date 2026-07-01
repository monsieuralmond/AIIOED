import { expect, test } from "@playwright/test";
import { enterTeacher } from "./helpers";

test("teacher account manages classes, numbered students, and teacher accounts", async ({ page }) => {
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

  await page.getByLabel("교사 이름").fill("박교사");
  await page.getByLabel("교사 아이디 만들기").fill("park");
  await page.getByLabel("교사 비밀번호 만들기").fill("park-pass");
  await page.getByRole("button", { name: "교사 만들기" }).click();
  await expect(page.getByRole("table", { name: "교사 계정 목록" })).toContainText("박교사");
  await expect(page.getByRole("table", { name: "교사 계정 목록" })).toContainText("park");
  await expect(page.getByRole("table", { name: "교사 계정 목록" })).toContainText("park-pass");

  await page.getByRole("button", { name: "역할 바꾸기" }).click();
  await page.getByLabel("교사 아이디").fill("park");
  await page.getByLabel("교사 비밀번호").fill("park-pass");
  await page.getByRole("button", { name: "교사로 시작" }).click();
  await expect(page.getByText("박교사")).toBeVisible();

  await page.getByRole("button", { name: "역할 바꾸기" }).click();
  await page.getByLabel("학생 아이디").fill("class3-08");
  await page.getByLabel("학생 비밀번호").fill("pw-08");
  await page.getByRole("button", { name: "아이디로 시작" }).click();
  await expect(page.getByRole("main")).toContainText("연구학생 8");
});

test("teacher deletes individual class, student, and teacher rows", async ({ page }) => {
  await enterTeacher(page);

  await page.getByRole("button", { name: "계정 관리" }).click();
  await page.getByLabel("새 반 이름").fill("삭제반");
  await page.getByRole("button", { name: "반 만들기" }).click();
  await page.getByLabel("학생 반").selectOption({ label: "삭제반" });
  await page.getByLabel("학생 이름", { exact: true }).fill("삭제학생");
  await page.getByLabel("학생 번호").fill("11");
  await page.getByLabel("참여자 코드").fill("S-DELETE");
  await page.getByRole("button", { name: "학생 만들기" }).click();
  await page.getByLabel("교사 이름").fill("삭제교사");
  await page.getByLabel("교사 아이디 만들기").fill("delete-teacher");
  await page.getByLabel("교사 비밀번호 만들기").fill("delete-pass");
  await page.getByRole("button", { name: "교사 만들기" }).click();

  await page.getByRole("button", { name: "학생 삭제: 삭제학생" }).click();
  await expect(page.getByRole("table", { name: "학생 계정 목록" })).not.toContainText("삭제학생");
  await page.getByRole("button", { name: "반 삭제: 삭제반" }).click();
  await expect(page.getByRole("table", { name: "반 목록" })).not.toContainText("삭제반");
  await page.getByRole("button", { name: "교사 삭제: 삭제교사" }).click();
  await expect(page.getByRole("table", { name: "교사 계정 목록" })).not.toContainText("삭제교사");
});

test("account management remains usable on a 390px teacher screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterTeacher(page);

  await page.getByRole("button", { name: "계정 관리" }).click();

  await expect(page.getByRole("heading", { name: "계정 관리" })).toBeVisible();
  await expect(page.getByLabel("새 반 이름")).toBeVisible();
  await expect(page.getByLabel("학생 번호")).toBeVisible();
  await expect(page.getByLabel("생성 갯수")).toBeVisible();
  await expect(page.getByLabel("교사 아이디 만들기")).toBeVisible();
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(horizontalOverflow).toBe(false);
});
