import { expect, test } from "@playwright/test";
import { enterStudent, enterTeacher, openTeacherExport } from "./helpers.js";

test("export view exposes research JSON shape", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "로그 보기" }).click();
  const raw = await page.getByTestId("export-json").textContent();
  expect(raw).not.toBeNull();
  const exported: unknown = JSON.parse(raw ?? "{}");
  for (const key of ["teacher", "teachers", "students", "classGroups", "assignments", "sessions", "metadata", "schemaVersion"]) {
    expect(exported).toHaveProperty(key);
  }
  expect(exported).toHaveProperty("teacher.displayName", "연구 교사");
  expect(exported).toHaveProperty("teachers.0.loginId", "test");
  expect(exported).not.toHaveProperty("teacher.password");
  expect(exported).not.toHaveProperty("teachers.0.password");
  expect(exported).toHaveProperty("students.0.id", "student-s001");
  expect(exported).toHaveProperty("students.0.studentNumber", 1);
  expect(exported).toHaveProperty("students.0.loginId", "s001");
  expect(exported).toHaveProperty("students.0.participantCode", "S001");
  expect(exported).not.toHaveProperty("students.0.password");
  expect(JSON.stringify(exported)).not.toContain("MINSEO-2026");
  expect(exported).toHaveProperty("assignments.0.id", "assignment-plastic");
  expect(exported).toHaveProperty("exportMetadata.schemaId", "reading-coach-pilot-dataset.v1");
  expect(exported).toHaveProperty("exportMetadata.codebookId", "critical-thinking-cognitive-offloading-sycophancy.v1");
  await expect(page.getByText("라벨링 행 0개")).toBeVisible();
  await expect(page.getByRole("link", { name: "JSON 다운로드" })).toHaveAttribute("download", "reading-coach-pilot-dataset.json");
  await expect(page.getByRole("link", { name: "라벨링 CSV 다운로드" })).toHaveAttribute("download", "reading-coach-labeling-rows.csv");
  await expect(page.getByRole("link", { name: "이벤트 CSV 다운로드" })).toHaveAttribute("download", "research-events.csv");
  await expect(page.getByRole("link", { name: "산출물·측정값 CSV" })).toHaveAttribute("download", "research-artifacts-measures.csv");
  await expect(page.getByRole("link", { name: "JSON 스키마" })).toHaveAttribute("download", "pilot-dataset.schema.json");
  await expect(page.getByRole("link", { name: "라벨링 코드북" })).toHaveAttribute("download", "labeling-codebook.md");
  await expect(page.getByRole("link", { name: "데이터 딕셔너리" })).toHaveAttribute("download", "data-dictionary.md");
  await expect(page.getByText("연구 원자료")).toBeVisible();
});

test("export captures revision check attempts for later labeling", async ({ page }) => {
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
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await page.getByRole("button", { name: "내 수정 확인" }).click();
  await expect(page.getByText("개요에 쓴 자료나 예시 두 가지가 초안에 아직 모두 들어가지 않았어요.")).toBeVisible();

  await openTeacherExport(page);
  const raw = await page.getByTestId("export-json").textContent();
  const exported: unknown = JSON.parse(raw ?? "{}");

  expect(JSON.stringify(exported)).toContain("suggestion_checked");
  expect(JSON.stringify(exported)).toContain("개요에 쓴 자료나 예시 두 가지가 초안에 아직 모두 들어가지 않았어요.");
  await expect(page.getByText(/라벨링 행 [1-9]/u)).toBeVisible();
});
