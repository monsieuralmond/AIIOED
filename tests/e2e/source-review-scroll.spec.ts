import { expect, test } from "@playwright/test";
import { enterStudent } from "./helpers";

const completeOutline = async (page: import("@playwright/test").Page): Promise<void> => {
  await page.getByRole("button", { name: "이해했어요" }).click();
  await page.getByLabel("중심 생각").fill("일회용 플라스틱은 줄여야 한다");
  await page.getByLabel("근거 또는 예시 1").fill("분해가 오래 걸린다");
  await page.getByLabel("근거 또는 예시 2").fill("생태계에 피해를 준다");
  await page.getByRole("button", { name: "출처 추가" }).click();
  await page.getByLabel("출처 메모").fill("- 지문: 플라스틱 분해와 생태계 피해 문장");
  await page.getByLabel("설명 또는 연결 1").fill("환경 피해가 오래 이어지기 때문이다.");
  await page.getByLabel("반대 의견").fill("위생과 편리함이 중요하다는 반론이 있다.");
  await page.getByRole("button", { name: "초안 쓰기 시작" }).click();
};

const longDraftText = (): string => {
  const draftBlock = [
    "일회용 플라스틱은 줄여야 한다. 플라스틱은 가볍고 편리하지만 한 번 쓰고 버리면 분해가 오래 걸린다.",
    "또 강과 바다로 흘러가 생태계에 피해를 준다. 이런 피해는 내가 물건을 편하게 쓰는 시간보다 훨씬 오래 남는다.",
    "위생과 편리함이 중요하다는 의견도 있다. 하지만 꼭 필요한 경우가 아니라면 재사용 가능한 물건을 고르는 습관이 더 책임 있는 선택이다.",
    "학교에서는 개인 물병과 도시락 통을 쓰고, 가정에서는 불필요한 포장을 줄일 수 있다.",
    "이런 실천은 한 사람만으로 끝나지 않고 친구와 가족에게도 영향을 준다.",
    "그래서 일회용 플라스틱을 줄이는 일은 불편함을 조금 감수하더라도 생태계를 지키기 위한 필요한 행동이다."
  ].join("\n\n");
  return Array.from({ length: 4 }, (_, index) => `${draftBlock}\n\n${index + 1}번째 점검 문단에서도 같은 주장을 반복하지 않고 이유와 실천을 더 자세히 살펴본다.`).join("\n\n");
};

test("revision feedback catches missing source markers and scrolls long drafts", async ({ page }) => {
  const longDraft = longDraftText();

  await enterStudent(page);
  await completeOutline(page);
  await page.getByTestId("draft-editor").fill(longDraft);
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();

  await expect(page.getByTestId("work-pane").getByText("근거 출처 표시")).toBeVisible();
  await expect(page.getByText("근거가 어디에서 온 것인지 초안에 짧게 표시했는지 확인해보세요.")).toBeVisible();

  const scrollInfo = await page.getByTestId("draft-editor").evaluate((node) => {
    const editor = node as HTMLTextAreaElement;
    editor.scrollTop = 120;
    editor.dispatchEvent(new Event("scroll", { bubbles: true }));
    const layer = editor.closest(".draft-editor-stack")?.querySelector(".draft-highlight-layer");
    return {
      editorScrollTop: editor.scrollTop,
      layerScrollTop: layer instanceof HTMLElement ? layer.scrollTop : -1,
      canScroll: editor.scrollHeight > editor.clientHeight,
      editorClientHeight: editor.clientHeight
    };
  });
  expect(scrollInfo.canScroll).toBe(true);
  expect(scrollInfo.editorClientHeight).toBeGreaterThanOrEqual(260);
  expect(scrollInfo.layerScrollTop).toBe(scrollInfo.editorScrollTop);

  await page.getByTestId("draft-editor").fill(`지문에 따르면 ${longDraft}`);
  await page.getByRole("button", { name: "내 수정 확인" }).click();
  await expect(page.getByText("수정이 확인됐어요. 이 제안을 해결로 표시했어요.")).toBeVisible();
});

test("mobile revision editor keeps a visible scrollable writing area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterStudent(page);
  await completeOutline(page);
  await page.getByTestId("draft-editor").fill(longDraftText());
  await page.getByRole("button", { name: "고쳐쓰기 시작" }).click();
  await expect(page.getByText("근거가 어디에서 온 것인지 초안에 짧게 표시했는지 확인해보세요.")).toBeVisible();

  const scrollInfo = await page.getByTestId("draft-editor").evaluate((node) => {
    const editor = node as HTMLTextAreaElement;
    editor.scrollTop = 120;
    editor.dispatchEvent(new Event("scroll", { bubbles: true }));
    const layer = editor.closest(".draft-editor-stack")?.querySelector(".draft-highlight-layer");
    return {
      editorClientHeight: editor.clientHeight,
      editorScrollTop: editor.scrollTop,
      layerScrollTop: layer instanceof HTMLElement ? layer.scrollTop : -1
    };
  });
  expect(scrollInfo.editorClientHeight).toBeGreaterThanOrEqual(260);
  expect(scrollInfo.layerScrollTop).toBe(scrollInfo.editorScrollTop);
});
