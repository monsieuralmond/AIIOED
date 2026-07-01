import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const evidenceDir = resolve(".omo/evidence/pilot-writing-coach-100");
const screensDir = resolve(evidenceDir, "screens");
const htmlPath = resolve(screensDir, "visual-reference-contact-sheet.html");
const pngPath = resolve(screensDir, "visual-reference-contact-sheet.png");

const captures = [
  ["Role entry", resolve(screensDir, "role-entry.png")],
  ["Teacher list", resolve(screensDir, "teacher-list.png")],
  ["Teacher account management", resolve(screensDir, "teacher-account-management.png")],
  ["Assignment preview", resolve(screensDir, "assignment-preview.png")],
  ["Create assignment", resolve(screensDir, "create-assignment-form.png")],
  ["Assigned task", resolve(screensDir, "student-assigned-task.png")],
  ["Student reading", resolve(screensDir, "student-reading.png")],
  ["Assignment reference", resolve(screensDir, "student-assignment-reference.png")],
  ["Student thinking", resolve(screensDir, "student-thinking.png")],
  ["Outline warning", resolve(screensDir, "student-warning.png")],
  ["Student writing", resolve(screensDir, "student-writing.png")],
  ["Review submit", resolve(screensDir, "student-review.png")],
  ["Teacher review", resolve(screensDir, "teacher-review.png")],
  ["Mobile role entry", resolve(screensDir, "mobile-role-entry.png")],
  ["Mobile assigned task", resolve(screensDir, "mobile-student-assigned-task.png")],
  ["Mobile reading", resolve(screensDir, "mobile-student-reading.png")],
  ["Mobile teacher gate", resolve(screensDir, "mobile-teacher-gate.png")],
  ["Mobile export", resolve(screensDir, "mobile-export.png")],
  ["Mobile teacher review", resolve(screensDir, "mobile-teacher-review.png")],
  ["Mobile account management", resolve(screensDir, "mobile-account-management.png")]
];

const imageCard = ([label, filePath]) => `
  <figure>
    <figcaption>${label}</figcaption>
    <img src="${pathToFileURL(filePath).href}" alt="${label}" />
  </figure>`;

await mkdir(screensDir, { recursive: true });
await writeFile(
  htmlPath,
  `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>Pilot Writing Coach Visual Contact Sheet</title>
  <style>
    body {
      background: #f7f8fa;
      color: #1f1f2e;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 32px;
    }
    h1 { font-size: 28px; margin: 0 0 20px; }
    main { display: grid; gap: 20px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    figure {
      background: #ffffff;
      border: 1px solid #d9dce3;
      border-radius: 8px;
      margin: 0;
      padding: 12px;
    }
    figcaption { font-size: 14px; font-weight: 800; margin-bottom: 8px; }
    img { border: 1px solid #eceef3; display: block; width: 100%; }
  </style>
</head>
<body>
  <h1>Pilot Writing Coach 100 visual contact sheet</h1>
  <main>${captures.map(imageCard).join("")}</main>
</body>
</html>
`,
  "utf8"
);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 2200 } });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.screenshot({ fullPage: true, path: pngPath });
} finally {
  await browser.close();
}
