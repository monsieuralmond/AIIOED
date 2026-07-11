import { expect, test } from "@playwright/test";
import { enterTeacher } from "./helpers.js";

const passage =
  "플라스틱은 가볍고 값이 싸서 일상에서 널리 쓰인다. 하지만 한 번 쓰고 버려지는 플라스틱은 분해되는 데 오랜 시간이 걸리며, 강과 바다로 흘러가 생태계에 피해를 줄 수 있다.";

test("researcher creates a Korean nonfiction assignment", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "새 과제 만들기" }).click();
  await page.getByLabel("과제 제목").fill("새 플라스틱 토론 과제");
  await page.getByLabel("비문학 지문").fill(passage);
  await page.getByLabel("해결할 문제").fill("일회용 플라스틱 사용을 줄여야 하는지 주장하세요.");
  await page.getByLabel("학생에게 보일 요구사항").fill("자신의 주장과 이유를 분명히 쓰세요.");
  await page.getByLabel("학년 또는 난이도").selectOption("초등 고학년");
  await page.getByRole("button", { name: "과제 저장" }).click();
  await expect(page.getByRole("article", { name: "새 플라스틱 토론 과제 과제" })).toBeVisible();
  await page.screenshot({ path: ".omo/evidence/pilot-writing-coach-v0/task-5-create.png", fullPage: true });
});

test("researcher creates and assigns an understanding calibration assignment", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "새 과제 만들기" }).click();
  await page.getByLabel("AI 기반 이해 보정 연구").check();
  await page.getByLabel("과제 제목").fill("양자컴퓨터 이해 확인");
  await page.getByLabel("주제명").fill("양자컴퓨터");
  await page.getByLabel("비문학 지문").fill("양자컴퓨터는 양자 상태를 이용해 특정 계산을 다르게 처리할 수 있다. 하지만 모든 문제를 항상 빠르게 푸는 것은 아니다.");
  await page.getByLabel("AI 보조자료 또는 설명 자료").fill("학생에게 큐비트와 중첩은 쉬운 비유로 설명해도 된다.");
  await page.getByLabel("오류 판단 문장").fill("양자컴퓨터는 모든 문제를 일반 컴퓨터보다 빠르게 해결한다.");
  await page.getByRole("button", { name: "과제 저장" }).click();

  const createdAssignment = page.getByRole("article").filter({ hasText: "양자컴퓨터 이해 확인" });
  await expect(createdAssignment.getByText("이해 보정 연구").first()).toBeVisible();
  await createdAssignment.getByRole("button", { name: "수정" }).click();
  await expect(page.getByLabel("AI 기반 이해 보정 연구")).toBeChecked();
  await expect(page.getByLabel("주제명")).toHaveValue("양자컴퓨터");
  await page.getByLabel("오류 판단 문장").fill("양자컴퓨터는 모든 일을 사람보다 정확하게 처리한다.");
  await page.getByRole("button", { name: "수정 저장" }).click();
  await createdAssignment.getByRole("button", { name: "미리보기" }).click();
  await expect(page.getByRole("dialog", { name: "과제 미리보기" }).getByText("양자컴퓨터는 모든 일을 사람보다 정확하게 처리한다.")).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).last().click();
  await expect(createdAssignment.getByRole("definition").first()).toHaveText("0명");
  await createdAssignment.getByRole("button", { name: "배정", exact: true }).click();
  const assignmentDialog = page.getByRole("dialog", { name: "과제 배정" });
  await assignmentDialog.getByRole("button", { name: "전체 선택" }).click();
  await assignmentDialog.getByRole("button", { name: "배정 저장" }).click();
  await expect(createdAssignment.getByRole("definition").first()).toHaveText("2명");
  await page.getByRole("button", { name: "학생 화면 보기" }).click();
  await expect(page.getByTestId("understanding-calibration-flow")).toContainText("양자컴퓨터");
});

test("student completes the understanding calibration flow and stores research records", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "새 과제 만들기" }).click();
  await page.getByLabel("AI 기반 이해 보정 연구").check();
  await page.getByLabel("과제 제목").fill("플라스틱 이해 확인");
  await page.getByLabel("주제명").fill("일회용 플라스틱");
  await page.getByLabel("비문학 지문").fill(passage);
  await page.getByLabel("AI 보조자료 또는 설명 자료").fill("학생에게 생태계 피해와 분해 시간을 중심으로 안내한다.");
  await page.getByLabel("오류 판단 문장").fill("일회용 플라스틱은 버리면 바로 자연에서 사라진다.");
  await page.getByRole("button", { name: "과제 저장" }).click();
  const activeCalibrationAssignment = page.getByRole("article").filter({ hasText: "플라스틱 이해 확인" });
  await expect(activeCalibrationAssignment.getByRole("definition").first()).toHaveText("0명");
  await expect(activeCalibrationAssignment.getByRole("button", { name: "배정", exact: true })).toBeVisible();
  await activeCalibrationAssignment.getByRole("button", { name: "배정", exact: true }).click();
  const calibrationAssignmentDialog = page.getByRole("dialog", { name: "과제 배정" });
  await calibrationAssignmentDialog.getByRole("button", { name: "전체 선택" }).click();
  await calibrationAssignmentDialog.getByRole("button", { name: "배정 저장" }).click();
  await expect(activeCalibrationAssignment.getByRole("definition").first()).toHaveText("2명");
  await page.getByRole("button", { name: "학생 화면 보기" }).click();

  const chooseRating = async (label: string, value: string): Promise<void> => {
    await page.getByRole("group", { name: label }).getByRole("button", { name: `${label} ${value}점` }).click();
  };

  await chooseRating("나는 일회용 플라스틱에 대해 들어본 적이 있다.", "4");
  await chooseRating("나는 일회용 플라스틱의 개념을 설명할 수 있다.", "3");
  await chooseRating("나는 일회용 플라스틱의 원리나 이유를 설명할 수 있다.", "2");
  await chooseRating("나는 일회용 플라스틱의 한계를 설명할 수 있다.", "2");
  await page.getByRole("textbox", { name: /현재 알고 있는 내용을 써 보세요/ }).fill("플라스틱은 편하지만 버리면 오래 남는다고 알고 있다.");
  await page.getByRole("button", { name: "글 읽기로 이동" }).click();
  await expect(page.getByText("지문")).toBeVisible();
  await page.getByRole("button", { name: "질문하러 가기" }).click();
  await page.getByLabel("질문").fill("핵심을 글로 정리해줘");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.locator(".calibration-chat-log li.assistant")).toContainText("일회용 플라스틱");
  await page.getByRole("button", { name: "다음 활동 전 확인" }).click();

  await chooseRating("나는 일회용 플라스틱을 쉽게 설명할 수 있다.", "4");
  await chooseRating("나는 일회용 플라스틱의 작동 원리를 설명할 수 있다.", "3");
  await chooseRating("나는 일회용 플라스틱에 대한 잘못된 설명을 바로잡을 수 있다.", "3");
  await chooseRating("나는 일회용 플라스틱을 새로운 상황에 적용해 판단할 수 있다.", "2");
  await page.getByRole("button", { name: "문제 시작" }).click();
  await expect(page.getByRole("heading", { name: "지문" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "질문" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /이전/ })).toHaveCount(0);

  const answerProblem = async (heading: string, label: string, answer: string, confidence: string, nextButton: string): Promise<void> => {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await page.getByLabel(label).fill(answer);
    await page.getByRole("button", { name: "제출" }).click();
    await chooseRating("방금 답변에 얼마나 확신하나요?", confidence);
    await page.getByRole("button", { name: nextButton }).click();
  };

  await answerProblem("자유 설명", "자유 설명 답변", "양자컴퓨터는 아주 작은 세계의 성질을 이용해 정보를 다루는 컴퓨터다. 보통 컴퓨터와 다른 방식으로 계산할 수 있다.", "4", "다음 문제");
  await expect(page.getByRole("heading", { name: "자유 설명" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "오개념 수정" })).toHaveCount(0);
  await answerProblem("원리 설명", "원리 설명 답변", "일반 컴퓨터는 0과 1을 하나씩 다루지만 양자컴퓨터는 큐비트의 중첩 같은 성질을 이용해 특정 계산 경로를 다르게 살핀다.", "3", "다음 문제");
  await answerProblem("오개념 수정", "오개념 수정 답변", "양자컴퓨터가 어떤 문제에서는 빠를 수 있다는 점은 맞지만 모든 문제를 빠르게 푸는 것은 아니다. 특정 알고리즘과 문제에서 장점이 있다.", "4", "다음 문제");
  await answerProblem("적용 판단", "적용 판단 답변", "복잡하다고 무조건 양자컴퓨터가 좋은 것은 아니다. 양자컴퓨터에 맞는 문제에서는 도움이 될 수 있지만 글쓰기나 보통 계산처럼 일반 컴퓨터가 나은 경우도 있다.", "3", "활동 돌아보기");

  await chooseRating("활동을 해 보니 생각보다 설명하기 어려운 부분이 있었다.", "5");
  await chooseRating("활동 전에는 내가 더 잘 이해하고 있다고 생각했다.", "4");
  await chooseRating("AI와 대화할 때는 알 것 같았지만, 직접 표현하려니 부족한 부분이 있었다.", "4");
  await chooseRating("주제의 원리나 작동 이유를 설명하는 것이 생각보다 어려웠다.", "4");
  await chooseRating("주제의 한계나 예외를 설명하는 것이 생각보다 어려웠다.", "4");
  await chooseRating("주제가 어떤 상황에 도움이 되는지 판단하는 것이 생각보다 어려웠다.", "4");
  await chooseRating("다시 AI와 대화할 수 있다면 더 질문하고 싶은 부분이 있다.", "4");
  await chooseRating("이번 활동을 통해 내가 정확히 아는 부분과 아직 모르는 부분을 더 잘 구분하게 되었다.", "5");
  await page.getByLabel("활동을 하면서 가장 어렵게 느껴진 부분은 무엇이었나요?").fill("도움이 되는 경우와 그렇지 않은 경우를 구분하는 부분이 어려웠다.");
  await page.getByLabel("AI와 대화할 때는 알 것 같았지만, 막상 직접 설명하려니 부족하다고 느낀 부분이 있다면 써 보세요.").fill("왜 모든 문제에 빠르지 않은지 내 말로 설명하는 부분이 부족했다.");
  await page.getByRole("button", { name: "대화 다시 보기" }).click();

  await expect(page.getByText("핵심을 글로 정리해줘")).toBeVisible();
  await page.getByRole("button", { name: "마무리 생각 쓰기" }).click();
  await chooseRating("다시 보니 내가 놓친 중요한 내용이 있었다.", "4");
  await chooseRating("AI가 설명해 준 내용을 읽을 때는 이해한 것 같았지만, 실제로는 더 확인이 필요한 부분이 있었다.", "4");
  await chooseRating("내가 AI에게 더 깊이 질문했어야 하는 부분이 있었다.", "5");
  await chooseRating("내 답변에서 빠진 중요한 내용이 있었다.", "4");
  await chooseRating("다시 본 AI 대화는 내가 무엇을 알고 무엇을 모르는지 확인하는 데 도움이 되었다.", "5");
  await page.getByLabel("다시 본 AI 대화 중 가장 도움이 된 부분은 무엇이었나요?").fill("플라스틱이 오래 남는다는 핵심을 짧게 정리해 준 부분이 도움이 되었다.");
  await page.getByLabel("다시 보니 더 확인했어야 한다고 느낀 부분은 무엇인가요?").fill("다음에는 빠른 이유와 모든 문제에 적용되지 않는 이유를 더 자세히 물어보고 싶다.");
  await page.getByRole("button", { name: "완료" }).click();
  await expect(page.getByText("활동이 완료되었습니다.").first()).toBeVisible();
});
