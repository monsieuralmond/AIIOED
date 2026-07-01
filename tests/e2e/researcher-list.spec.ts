import { expect, test } from "@playwright/test";
import { enterTeacher } from "./helpers";

test("researcher list exposes create, preview, and log actions", async ({ page }) => {
  await enterTeacher(page);
  await expect(page.getByRole("button", { name: "홈" })).toBeVisible();
  await expect(page.getByText("비문학 글쓰기 과제")).toHaveCount(0);
  await expect(page.getByText("학생은 참여자 코드로 들어오고")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "새 과제 만들기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "미리보기 및 배정" })).toBeVisible();
  const rail = page.getByLabel("연구자 메뉴");
  await expect(rail.getByRole("button", { name: "학생 현황" })).toBeVisible();
  await expect(rail.getByRole("button", { name: "학생 화면 보기" })).toBeVisible();
  await expect(rail.getByRole("button", { name: "로그 보기" })).toBeVisible();
  await expect(page.getByText("학생 화면 열기")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "진행 현황" })).toHaveCount(0);
  await expect(page.getByLabel("활성 과제").getByRole("button", { name: "로그 보기" })).toHaveCount(0);
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/task-4-list.png", fullPage: true });
});

test("teacher chooses a class before assigning from preview", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "계정 관리" }).click();
  await page.getByLabel("새 반 이름").fill("실험 반");
  await page.getByRole("button", { name: "반 만들기" }).click();
  await page.getByRole("button", { name: "과제로 돌아가기" }).click();

  await page.getByRole("button", { name: "미리보기 및 배정" }).click();
  await page.getByLabel("배정할 반").selectOption({ label: "실험 반" });
  await expect(page.getByText("실험 반 학생 0명에게 보입니다.")).toBeVisible();
  await page.getByRole("button", { name: "선택한 반에 배정" }).click();
  await expect(page.getByLabel("활성 과제")).toContainText("실험 반");
  await expect(page.getByRole("article", { name: "플라스틱 사용을 줄여야 할까? 과제" }).getByLabel("문제별 진행 요약")).toContainText("0명");
});

test("teacher edits an existing assignment without creating a duplicate", async ({ page }) => {
  await enterTeacher(page);
  const assignmentList = page.getByLabel("활성 과제");
  await page.getByRole("article", { name: "플라스틱 사용을 줄여야 할까? 과제" }).getByRole("button", { name: "수정" }).click();

  await expect(page.getByRole("heading", { name: "과제 수정" })).toBeVisible();
  await expect(page.getByLabel("과제 제목")).toHaveValue("플라스틱 사용을 줄여야 할까?");
  await page.getByLabel("과제 제목").fill("수정된 플라스틱 과제");
  await page.getByLabel("해결할 문제").fill("수정된 문제를 바탕으로 자신의 주장을 쓰세요.");
  await page.getByRole("button", { name: "수정 저장" }).click();

  await expect(assignmentList.getByText("수정된 플라스틱 과제")).toBeVisible();
  await expect(assignmentList.getByText("플라스틱 사용을 줄여야 할까?")).toHaveCount(0);
  await expect(assignmentList.getByLabel("문제별 진행 요약")).toHaveCount(1);
});

test("teacher filters assignments by search, category, and grade level", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "내 과제 만들기" }).click();
  await page.getByLabel("과제 제목").fill("미디어 자료 비교");
  await page.getByLabel("학년 또는 난이도").selectOption({ label: "중학생" });
  await page.getByLabel("글 유형").selectOption({ label: "근거 비교" });
  await page.getByLabel("목표 분량").fill("600자");
  await page.getByLabel("최소 글자 수").fill("600");
  await page.getByLabel("비문학 지문").fill("청소년은 뉴스를 볼 때 제목, 자료 출처, 그래프의 기준을 함께 확인해야 한다. 같은 통계도 조사 대상과 기간이 다르면 다른 뜻으로 읽힐 수 있다.");
  await page.getByLabel("해결할 문제").fill("두 자료가 같은 결론을 말하는지 비교하고, 어떤 근거가 더 설득력 있는지 쓰세요.");
  await page.getByRole("button", { name: "과제 저장" }).click();

  const assignmentList = page.getByLabel("활성 과제");
  await expect(assignmentList.getByText("미디어 자료 비교")).toBeVisible();
  await expect(assignmentList.getByText("플라스틱 사용을 줄여야 할까?")).toBeVisible();
  await expect(assignmentList.getByLabel("문제별 진행 요약")).toHaveCount(2);

  await page.getByLabel("검색").fill("미디어");
  await expect(assignmentList.getByText("미디어 자료 비교")).toBeVisible();
  await expect(assignmentList.getByText("플라스틱 사용을 줄여야 할까?")).toHaveCount(0);

  await page.getByLabel("검색").fill("없는 과제");
  await expect(assignmentList.getByText("조건에 맞는 과제가 없습니다.")).toBeVisible();

  await page.getByLabel("검색").fill("");
  await page.getByRole("checkbox", { name: "근거 비교" }).check();
  await expect(assignmentList.getByText("미디어 자료 비교")).toBeVisible();
  await expect(assignmentList.getByText("플라스틱 사용을 줄여야 할까?")).toHaveCount(0);

  await page.getByRole("checkbox", { name: "근거 비교" }).uncheck();
  await page.getByRole("checkbox", { name: "주장 글쓰기" }).check();
  await expect(assignmentList.getByText("플라스틱 사용을 줄여야 할까?")).toBeVisible();
  await expect(assignmentList.getByText("미디어 자료 비교")).toHaveCount(0);

  await page.getByRole("checkbox", { name: "주장 글쓰기" }).uncheck();
  await page.getByLabel("학년", { exact: true }).selectOption({ label: "중학생" });
  await expect(assignmentList.getByText("미디어 자료 비교")).toBeVisible();
  await expect(assignmentList.getByText("플라스틱 사용을 줄여야 할까?")).toHaveCount(0);

  await page.getByLabel("학년", { exact: true }).selectOption({ label: "초등 고학년" });
  await expect(assignmentList.getByText("플라스틱 사용을 줄여야 할까?")).toBeVisible();
  await expect(assignmentList.getByText("미디어 자료 비교")).toHaveCount(0);
});

test("mobile teacher shell keeps primary actions visible without a collapsed menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterTeacher(page);

  await expect(page.getByRole("button", { name: "학생 현황" })).toBeVisible();
  await expect(page.getByRole("button", { name: "학생 화면 보기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그 보기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "내 과제 만들기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "역할 바꾸기" })).toBeVisible();
});
