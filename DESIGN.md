# Reading Coach Lab Design System

## 1. Atmosphere & Identity

Reading Coach Lab feels like a quiet academic writing workspace: structured, calm, and direct. The signature is a Khan Writing Coach-style writing flow: a dark task bar, a thin stage rail, a document-like work surface, and a right coach panel that slides between Chat, Outline, and Feedback without feeling like a dashboard board. Assignment details stay in the top task bar slide-over, and model/provider status is never shown to students.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | --surface-primary | #FFFFFF | #111117 | Page and document background |
| Surface/secondary | --surface-secondary | #F7F8FA | #181820 | App background |
| Surface/elevated | --surface-elevated | #FFFFFF | #20202A | Panels and form surfaces |
| Surface/coach | --surface-coach | #F4EDFF | #2A1C33 | Assistant messages |
| Surface/warning | --surface-warning | #FFF4C7 | #3A321A | Outline warning banner |
| Surface/check | --surface-check | #F7F2D6 | #36301D | Stage checks and coach notices |
| Surface/panel | --surface-panel | #FBFCFE | #181820 | Right support panel |
| Surface/inverse | --surface-inverse | #FFFFFF | #111117 | Text on filled accent surfaces |
| Text/primary | --text-primary | #1F1F2E | #F8F8FB | Headlines and body |
| Text/secondary | --text-secondary | #6B6F7A | #BABDCA | Hints and metadata |
| Text/tertiary | --text-tertiary | #8B909C | #8A8D9A | Disabled text |
| Border/default | --border-default | #D9DCE3 | #353744 | Inputs and dividers |
| Border/subtle | --border-subtle | #ECEEF3 | #292B35 | Soft panel divisions |
| Border/accent-soft | --border-accent-soft | #C7C8FF | #4E47A0 | Secondary action outlines |
| Border/warning | --border-warning | #E5D36A | #756527 | Warning banner outline |
| Accent/primary | --accent-primary | #5F4CFF | #8B7DFF | Primary action |
| Accent/deep | --accent-deep | #6A1B6D | #C084FC | Coach avatar and send action |
| Accent/sky | --accent-sky | #7EC3F2 | #93C5FD | Hero geometric block |
| Accent/ink | --accent-ink | #15131F | #F8F8FB | Student task bar |
| Status/success | --status-success | #2E9F5B | #4ADE80 | Completion |
| Status/error | --status-error | #C2413B | #F87171 | Validation |

### Rules

- Accent is only for navigation state, focus, and commands.
- Yellow is reserved for non-blocking guidance.
- No decorative gradients, orbs, or bokeh.
- Right-panel tabs use accent only for the selected underline and active button; inactive tabs remain quiet text.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| H1 | 28px | 700 | 1.25 | 0 | Page title |
| H2 | 22px | 700 | 1.3 | 0 | Form and stage title |
| H3 | 18px | 700 | 1.35 | 0 | Panel titles |
| Body | 16px | 400 | 1.6 | 0 | Reading and draft text |
| Body/sm | 14px | 400 | 1.45 | 0 | Metadata and helper text |
| Label | 14px | 700 | 1.35 | 0 | Field labels |
| Caption | 12px | 500 | 1.35 | 0 | Counters and tags |

### Font Stack

- Primary: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Mono: "SFMono-Regular", Consolas, monospace

### Rules

- Body text never below 14px.
- Letter spacing is 0 except mono metadata.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px.

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Tiny inline gaps |
| --space-2 | 8px | Compact groups |
| --space-3 | 12px | Field padding |
| --space-4 | 16px | Default gap |
| --space-5 | 20px | Main workspace gap |
| --space-6 | 24px | Panel padding |
| --space-8 | 32px | Page padding |
| --space-10 | 40px | Major vertical gaps |

### Grid

- Desktop app top bar: 52px, allowed range 48-56px.
- Desktop workspace: left work pane 60%, right coach/support pane 40%.
- Understanding calibration split workspace max width: `--calibration-split-max-width` 1280px.
- Understanding calibration AI chat minimum desktop pane: `--calibration-chat-min-width` 340px.
- Guided writing workspace max width: `--guided-workspace-max-width` 1180px for student-only planning and writing steps.
- Guided writing with coach max width: `--guided-workspace-with-coach-max-width` 1320px so the document pane and support pane read as one contained workspace.
- Workspace gap: 20px, allowed range 16-20px.
- Mobile: single primary work column; coach is an explicit secondary surface.

### Rules

- Student screens are stage-based, not board-based.
- No nested cards inside cards.
- Student workspace desktop geometry: work surface 58-62%, right panel 38-42%, with the panel flush to the writing surface like the reference video.
- The right panel is not a floating card. It is a contiguous support pane with internal tabs.

## 5. Components

### App Shell
- **Structure**: top bar, stepper row, workspace.
- **States**: active step, disabled next, saved status.
- **Accessibility**: landmarks and visible focus rings.

### Teacher Assignment List
- **Structure**: side rail, assignment category tabs, filter column, assignment list, progress summary.
- **Rule**: the screen starts with the assignment list itself. Do not add a decorative hero or redundant explainer strip above the operational list.
- **Navigation rule**: teacher navigation such as student status, logs, and account management lives in the side rail. Student preview is assignment-specific and therefore lives inside each assignment row; never put a global student preview button in the side rail because it can only guess at the target assignment.

### Form Field
- **Structure**: label, input or textarea, helper/error.
- **Spacing**: `--space-2` label gap, `--space-3` inner padding.
- **States**: default, focus, error, disabled.

### Coach Panel
- **Structure**: tab row, sliding content area, scrollable messages, quick actions, input.
- **Tabs**: Chat during Understanding/Outlining; Chat/Outline during Drafting; Feedback/Outline during Revising. Assignment details stay in the top task-bar "과제 보기" slide-over, not inside the coach panel.
- **States**: empty, active conversation, redirected unrelated question, selected tab, suggestion detail, resolved suggestion.
- **Rule**: no copy button and no answer-generation command.
- **Research rule**: assistant messages may show a compact response-type chip, but the chip must support transparency rather than become a student-facing scoring label.

### Outline Builder
- **Structure**: thesis/claim, paragraph topic, evidence/example, source, reasoning/explanation, opposing view.
- **States**: empty, incomplete warning, checked checklist, ready for drafting.
- **Guided progress**: a compact "지금 할 일" strip may sit above the fields to show claim, evidence, source, reasoning, and counterargument progress. It must guide focus to the student's own input fields rather than generate text.
- **Rule**: student-entered evidence may be summarized in the panel, but the UI must not provide a one-click copy action into the draft.
- **Evidence rule**: evidence help appears as three stable questions — where it came from, what it shows, and why it connects — not as supplied evidence text.

### Draft Writing
- **Structure**: page title, compact read-only outline bridge, local readiness check, large draft editor, character count, revision action.
- **States**: empty draft, missing readiness items, ready for revision, pasted text recorded, AI feedback loading.
- **Outline bridge rule**: the bridge may show the student's own claim, evidence, source, and counterargument as memory support. It must not generate a paragraph, insert text, or offer copy actions.
- **Readiness rule**: the readiness check may compare the student's draft with the student's own outline for claim, evidence, source cue, and counterargument presence. It is non-blocking, local, and not a grade or rewrite engine.

### Guided Writing
- **Structure**: one step per screen: material, topic, sources, outline, writing.
- **AI rule**: material, topic, sources, and outline are student-only input stages. The coach panel appears only during the final writing stage.
- **Progress rule**: the step rail may wrap across rows on narrow screens, but it must never introduce horizontal scrolling or hide a step.
- **Prompting rule**: each planning step may show a quiet "생각해볼 질문" block above the input. These prompts should guide students toward book-style IT explanatory writing: an everyday entry scene, a simple principle explanation, practical uses, limits or risks, and a closing thinking question. Avoid school-AI debate prompts or broad smartphone-habit opinion topics.
- **Material rule**: 소재 is a broad IT/science-technology object such as 양자컴퓨터, 반도체, 해저케이블, 데이터센터, or 위성 인터넷. Topic narrows that object into an explanatory focus, while the final title is entered in the writing step.
- **Source rule**: 자료 찾기 uses repeatable rows with separate 내용 and 출처 fields. Students can add rows and remove rows with a compact trash-icon button.
- **Outline rule**: 개요 짜기 uses 서론, 본론, 결론 sections. 본론 is repeatable so students can add or remove explanation blocks without turning the screen into a board.
- **Revision rule**: after 글쓰기, students enter a 고쳐쓰기 step that shows AI feedback suggestions in the right support pane and keeps the draft editable on the left. Final submission happens only after this step.
- **Completion rule**: after final submission, present the essay as a framed finished text with a paper-like sheet and double accent border. The frame shows only the student-entered title when present and the body text; it does not show a generated fallback title, date, or signature. The primary export action is labeled `내 작품 내보내기 (Word)`; the secondary action is `텍스트 파일`.

### Revision Feedback
- **Structure**: four category rows — Content & Focus, Sources & Explanation, Structure & Flow, Language — localized as 내용과 초점, 자료와 설명, 구조와 흐름, 문장 표현.
- **States**: collapsed category, active suggestion, checking edits, resolved.
- **Rule**: feedback tells the student what to inspect; it does not rewrite the sentence for them.
- **Visual rule**: category items read as one continuous inspection list, not four separate cards. The active suggestion appears as a single yellow note below the list.
- **Progress rule**: a compact progress summary may show total, resolved, and remaining suggestions, but it stays inside the feedback flow and must not become a dashboard.
- **Connection rule**: the active suggestion must also light up a compact "current focus" marker in the draft pane so the student can see which part of their own writing to reread.
- **Span rule**: when the active suggestion can point to existing student text, the draft editor highlights that exact span with a subtle `mark`; this is inspection support, not AI rewriting.

### Teacher Process Review
- **Structure**: student roster on the left, selected process record on the right, visible search/status filters, compact metrics, then detailed logs.
- **States**: selected student, not started, in progress, submitted, empty filter result, teacher review status.
- **Rule**: the teacher should see who is selected, which students need attention, and what evidence exists before reading the full transcript.
- **Summary rule**: process review shows a compact claim/evidence/counterargument/submission summary calculated from the stored session data. It is a navigation aid, not an automated grade.
- **Review note rule**: teacher review status and memo are persistent session data and must export with the dataset. They record the teacher's inspection process, not a student score.

### Account Management
- **Structure**: page heading, left creation column for class/student/student-bulk/teacher forms, right list column for saved class, student, and teacher tables.
- **States**: empty input, saved confirmation, validation message, mobile single-column flow.
- **Rule**: keep account setup operational and scan-friendly; avoid a wide one-column form stack that leaves unused desktop space.
- **Bulk rule**: student bulk creation generates predictable login ids, initial passwords, participant codes, and student numbers from teacher-entered rules; initial passwords may be visible on the protected account page but must not export in research datasets.

### Research Export
- **Structure**: export summary, download actions, labeling-row preview, then raw JSON.
- **States**: no labeling rows, labeling rows present, file sync unavailable, file sync saved, file sync failed.
- **Rule**: the CSV is a derived labeling surface from stored events, not a second source of truth. The preview should stay compact and research-facing, not become a dashboard.
- **Artifact rule**: export actions must include JSON schema, labeling codebook, and data dictionary downloads.

### Student Assigned Task
- **Structure**: student name/status, assignment title, question, target, expected output brief, passage preview, one primary start action.
- **Rule**: this is a task handoff screen, not a dashboard. Do not expose teacher or researcher controls.

### Assignment Reference
- **Structure**: slide-over panel with title, target tags, stage-specific checklist, question, and passage.
- **States**: reading, thinking, writing, review checklist.
- **Rule**: opening and closing the reference must not alter outline, draft, chat, or stage state.

### Assignment Form
- **Structure**: document-like form shell with a clear header, then fields in one vertical path.
- **Rule**: no multi-column board layout for the pilot. The form should feel like assigning one serious writing task, not filling a dashboard.

### Warning Banner
- **Structure**: yellow surface, short reason list, dismiss or continue action.
- **Rule**: guidance is non-blocking unless explicitly specified.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | ease-out | Buttons, focus |
| Standard | 220ms | ease-in-out | Tab and panel switches |
| Stage | 320ms | cubic-bezier(.2,.8,.2,1) | Stage surface entry |

### Rules

- Animate only opacity and transform.
- Respect reduced motion.
- Every button and input has hover/focus states.
- Tab content enters with opacity + translateY(6px). Reduced motion uses opacity only.
- Slide-over assignment panels enter from the right with opacity + translateX(18px). Reduced motion uses opacity only.

## 7. Depth & Surface

### Strategy

Mostly borders-only with subtle tonal surfaces. The student work surface may use a very soft shadow and inset edge so the page reads like an editable document, but it must stay restrained.

| Type | Value | Usage |
|------|-------|-------|
| Default | 1px solid var(--border-default) | Inputs, panels |
| Subtle | 1px solid var(--border-subtle) | Internal dividers |
| Document shadow | 0 18px 36px rgba(30, 31, 45, .06) | Student document surface only |

No decorative glow or heavy shadows.
