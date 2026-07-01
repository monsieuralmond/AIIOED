import { expect, test } from "@playwright/test";

test("pilot excludes still-deferred or authorship-breaking surfaces", async ({ page }) => {
  await page.goto("/");
  for (const forbidden of ["즐겨찾기", "Wiki", "RAG", "복사", "문장 고쳐줘", "초안 만들기"]) {
    await expect(page.getByText(forbidden)).toHaveCount(0);
  }
});
