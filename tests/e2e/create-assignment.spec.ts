import { expect, test } from "@playwright/test";
import { enterTeacher, openTeacherExport } from "./helpers";

const passage =
  "플라스틱은 가볍고 값이 싸서 일상에서 널리 쓰인다. 하지만 한 번 쓰고 버려지는 플라스틱은 분해되는 데 오랜 시간이 걸리며, 강과 바다로 흘러가 생태계에 피해를 줄 수 있다.";

type StoredResearchRecord = {
  readonly id: string;
  readonly kind: string;
};

type StoredStageRecord = {
  readonly artifactIds?: readonly string[];
  readonly eventIds?: readonly string[];
  readonly measureIds?: readonly string[];
  readonly stage: string;
};

type StoredResearchEvent = {
  readonly id: string;
  readonly payload?: {
    readonly aiMode?: string;
    readonly assistantMessage?: string;
    readonly lastRequestTags?: readonly string[];
    readonly model?: string;
    readonly requestTags?: readonly string[];
    readonly totalAssistantChars?: number;
    readonly totalUserChars?: number;
    readonly userMessage?: string;
  };
  readonly type: string;
};

type StoredSession = {
  readonly artifacts: readonly StoredResearchRecord[];
  readonly assignment: {
    readonly title: string;
  };
  readonly currentStage: string;
  readonly events: readonly StoredResearchEvent[];
  readonly measures: readonly StoredResearchRecord[];
  readonly modules: {
    readonly understandingCalibration?: {
      readonly stageRecords?: Readonly<Record<string, StoredStageRecord>>;
    };
  };
  readonly status: string;
};

type StoredState = {
  readonly sessions: readonly StoredSession[];
};

test("researcher creates a Korean nonfiction assignment", async ({ page }) => {
  await enterTeacher(page);
  await page.getByRole("button", { name: "새 과제 만들기" }).click();
  await page.getByLabel("과제 제목").fill("플라스틱 사용을 줄여야 할까?");
  await page.getByLabel("비문학 지문").fill(passage);
  await page.getByLabel("해결할 문제").fill("일회용 플라스틱 사용을 줄여야 하는지 주장하세요.");
  await page.getByLabel("학년 또는 난이도").selectOption("초등 고학년");
  await page.getByRole("button", { name: "저장" }).click();
  const createdAssignment = page.getByRole("article").filter({ hasText: "일회용 플라스틱 사용을 줄여야 하는지 주장하세요." });
  await expect(createdAssignment.getByRole("heading", { name: "플라스틱 사용을 줄여야 할까?" })).toBeVisible();
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
  await createdAssignment.getByRole("button", { name: "미리보기 및 배정" }).click();
  await expect(page.getByRole("dialog", { name: "과제 미리보기" }).getByText("양자컴퓨터는 모든 일을 사람보다 정확하게 처리한다.")).toBeVisible();
  await page.getByRole("button", { name: "선택한 반에 배정" }).click();
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
  await page.getByRole("article").filter({ hasText: "플라스틱 이해 확인" }).getByRole("button", { name: "미리보기 및 배정" }).click();
  await page.getByRole("button", { name: "선택한 반에 배정" }).click();
  await page.getByRole("button", { name: "학생 화면 보기" }).click();

  const chooseRating = async (label: string, value: string): Promise<void> => {
    await page.getByRole("group", { name: label }).getByRole("button", { name: value }).click();
  };

  await chooseRating("나는 이 주제에 대해 들어본 적이 있다.", "4");
  await chooseRating("나는 이 주제가 무엇인지 설명할 수 있다.", "3");
  await chooseRating("나는 이 주제의 원리나 이유를 설명할 수 있다.", "2");
  await chooseRating("나는 이 주제의 한계를 설명할 수 있다.", "2");
  await page.getByLabel("이 주제에 대해 현재 알고 있는 내용을 자유롭게 써 보세요.").fill("플라스틱은 편하지만 버리면 오래 남는다고 알고 있다.");
  await page.getByRole("button", { name: "글 읽기로 이동" }).click();
  await expect(page.getByText("지문")).toBeVisible();
  await page.getByRole("button", { name: "질문하러 가기" }).click();
  await page.getByLabel("질문").fill("핵심을 글로 정리해줘");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText("AI").first()).toBeVisible();
  await page.getByRole("button", { name: "다음 활동 전 확인" }).click();

  await chooseRating("나는 이 주제를 내 말로 설명할 수 있다.", "4");
  await chooseRating("나는 비슷한 것과 다른 점을 비교할 수 있다.", "3");
  await chooseRating("나는 왜 그런지 이유를 설명할 수 있다.", "3");
  await chooseRating("나는 언제 맞고 언제 조심해야 하는지 말할 수 있다.", "3");
  await chooseRating("나는 다른 상황에도 이 내용을 적용할 수 있다.", "2");
  await page.getByRole("button", { name: "활동하기" }).click();
  await expect(page.getByRole("heading", { name: "지문" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "질문" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /이전/ })).toHaveCount(0);

  await page.getByLabel("컴퓨터를 잘 모르는 친구에게 이 주제가 무엇인지 쉽게 설명해 주세요.").fill("일회용 플라스틱은 한 번 쓰고 버리는 물건인데 오래 남아서 강과 바다에 피해를 줄 수 있다.");
  await page.getByRole("radio", { name: /틀리다/ }).check();
  await page.getByLabel("그렇게 생각한 이유").fill("지문에서 분해되는 데 오래 걸린다고 했다.");
  await page.getByRole("radio", { name: /B/ }).check();
  await page.getByLabel("고른 이유").fill("핵심 원리를 새로운 상황에 맞추어 설명해야 하기 때문이다.");
  await page.getByRole("button", { name: "활동 후 확인" }).click();

  await chooseRating("처음 생각보다 설명하기가 어려웠다.", "4");
  await chooseRating("아는 것과 설명하는 것은 다를 수 있다고 느꼈다.", "5");
  await chooseRating("AI와 이야기할 때는 쉬워 보였지만 혼자 쓰니 어려운 부분이 있었다.", "4");
  await chooseRating("내가 더 확인해야 할 부분을 발견했다.", "4");
  await chooseRating("다음에는 AI에게 더 구체적으로 물어보고 싶다.", "4");
  await page.getByLabel("가장 어려웠던 부분").fill("근거와 내 설명을 연결하는 부분이 어려웠다.");
  await page.getByRole("button", { name: "대화 다시 보기" }).click();

  await chooseRating("대화 중 중요한 부분을 그냥 지나친 것 같다.", "4");
  await chooseRating("AI 설명이 명확해서 내가 안다고 느낀 부분이 있었다.", "4");
  await chooseRating("더 물어봤다면 내 답이 나아졌을 것 같다.", "4");
  await chooseRating("내 답에 빠진 부분이 보인다.", "3");
  await page.getByLabel("가장 도움이 된 부분").fill("근거를 먼저 찾으라고 한 부분이 도움이 되었다.");
  await page.getByLabel("다시 확인했어야 할 부분").fill("반대되는 생각이나 한계를 더 확인했어야 했다.");
  await page.getByRole("button", { name: "완료" }).click();
  await expect(page.getByText("활동이 완료되었습니다.").first()).toBeVisible();

  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem("reading-coach-lab:v1");
    if (raw === null) return null;
    const state: StoredState = JSON.parse(raw);
    const session = state.sessions.find((item) => item.assignment.title === "플라스틱 이해 확인");
    if (session === undefined) return null;
    const moduleStageRecords = Object.values(session.modules.understandingCalibration?.stageRecords ?? {});
    return {
      artifactIds: session.artifacts.map((artifact) => artifact.id),
      artifactKinds: session.artifacts.map((artifact) => artifact.kind),
      chatCompletedPayload: session.events.find((event) => event.type === "calibration_chat_completed")?.payload ?? null,
      chatTurnPayloads: session.events.filter((event) => event.type === "calibration_chat_turn_created").map((event) => event.payload ?? {}),
      currentStage: session.currentStage,
      eventIds: session.events.map((event) => event.id),
      eventTypes: session.events.map((event) => event.type),
      measureIds: session.measures.map((measure) => measure.id),
      measureKinds: session.measures.map((measure) => measure.kind),
      moduleArtifactIds: moduleStageRecords.flatMap((record) => record.artifactIds ?? []),
      moduleEventIds: moduleStageRecords.flatMap((record) => record.eventIds ?? []),
      moduleMeasureIds: moduleStageRecords.flatMap((record) => record.measureIds ?? []),
      moduleStages: moduleStageRecords.map((record) => record.stage),
      status: session.status
    };
  });
  if (stored === null) throw new Error("Expected completed calibration session.");
  const lastChatTurnPayload = stored.chatTurnPayloads.at(-1);
  if (lastChatTurnPayload === undefined) throw new Error("Expected a stored calibration chat turn.");

  expect(stored.status).toBe("submitted");
  expect(stored.currentStage).toBe("completed");
  expect(stored.eventTypes).toContain("calibration_study_completed");
  expect(lastChatTurnPayload.requestTags).toContain("generated_explanation_request");
  expect(["mock", "real"]).toContain(lastChatTurnPayload.aiMode);
  expect(lastChatTurnPayload.model).toBeTruthy();
  expect(lastChatTurnPayload.assistantMessage).not.toContain("써줄 수 없");
  expect(stored.chatCompletedPayload?.totalUserChars).toBeGreaterThan(0);
  expect(stored.chatCompletedPayload?.totalAssistantChars).toBeGreaterThan(0);
  expect(stored.chatCompletedPayload?.lastRequestTags).toContain("generated_explanation_request");
  expect(stored.artifactKinds).toContain("independent_explanation");
  expect(stored.measureKinds).toContain("chat_review_self_report");
  expect(stored.moduleStages).toEqual(expect.arrayContaining([
    "pre_survey",
    "calibration_reading",
    "calibration_chat",
    "prediction_survey",
    "independent_tasks",
    "post_task_survey",
    "chat_review",
    "completed"
  ]));
  expect(stored.moduleArtifactIds).toEqual(expect.arrayContaining(stored.artifactIds));
  expect(stored.moduleMeasureIds).toEqual(expect.arrayContaining(stored.measureIds));
  expect(stored.moduleEventIds.length).toBeGreaterThanOrEqual(stored.eventIds.length);

  await openTeacherExport(page);
  const exportedJson = await page.getByTestId("export-json").textContent();
  if (exportedJson === null) throw new Error("Expected export JSON preview.");
  const eventsHref = await page.getByRole("link", { name: "이벤트 CSV 다운로드" }).getAttribute("href");
  const artifactMeasuresHref = await page.getByRole("link", { name: "산출물·측정값 CSV 다운로드" }).getAttribute("href");
  if (eventsHref === null) throw new Error("Expected research events CSV link.");
  if (artifactMeasuresHref === null) throw new Error("Expected artifact-measure CSV link.");
  const eventsCsv = decodeURIComponent(eventsHref.replace("data:text/csv;charset=utf-8,", ""));
  const artifactMeasuresCsv = decodeURIComponent(artifactMeasuresHref.replace("data:text/csv;charset=utf-8,", ""));

  expect(exportedJson).toContain("understanding_calibration");
  expect(exportedJson).toContain("independent_explanation");
  expect(exportedJson).toContain("chat_review_self_report");
  expect(exportedJson).toContain("understandingCalibration");
  expect(eventsCsv).toContain("calibration_chat_turn_created");
  expect(eventsCsv).toContain("generated_explanation_request");
  expect(artifactMeasuresCsv).toContain("independent_explanation");
  expect(artifactMeasuresCsv).toContain("chat_review_self_report");
});
