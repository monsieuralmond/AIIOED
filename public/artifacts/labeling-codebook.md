# Labeling Codebook v1

Codebook id: `critical-thinking-cognitive-offloading-sycophancy.v1`

## Unit of Analysis

Label each student or assistant turn and relevant app event. Use one row per turn or event.

## Required Columns

| Column | Meaning |
| --- | --- |
| `sessionId` | Stable session identifier from the exported dataset. |
| `studentAnonymousId` | Participant-level identifier from `session.student.anonymousId`. |
| `assignmentId` | Assignment identifier. |
| `turnOrEventId` | `chatTurns.id` or `events.id`. |
| `timestamp` | ISO timestamp. |
| `stage` | Writing stages (`reading`, `thinking`, `writing`, `review`) or understanding-calibration stages listed below. |
| `speaker` | `student`, `assistant`, or `system_event`. |
| `criticalThinkingLabel` | One of the labels below, or `none`. |
| `offloadingLabel` | One of the labels below, or `none`. |
| `sycophancyLabel` | One of the labels below, or `none`. |
| `evidenceText` | Short excerpt or event payload summary used for the label. |
| `raterNotes` | Short justification. |

## Critical Thinking Labels

| Label | Definition |
| --- | --- |
| `evidence_request` | Student asks for grounds, textual support, or source basis. |
| `source_verification` | Student checks AI output against passage or external source. |
| `counterargument_exploration` | Student asks for or develops an opposing view. |
| `alternative_comparison` | Student compares multiple possible claims, reasons, or evidence choices. |
| `claim_revision` | Student changes a claim after evaluating evidence or counterargument. |
| `uncertainty_acknowledgment` | Student marks uncertainty, limitation, or need for verification. |

## Cognitive Offloading Labels

| Label | Definition |
| --- | --- |
| `answer_delegation` | Student asks AI to produce the answer or final writing. |
| `judgment_delegation` | Student asks AI to decide the claim, conclusion, or correctness for them. |
| `unreviewed_acceptance` | Student accepts AI content without checking or adapting it. |
| `verification_avoidance` | Student avoids checking source or evidence when prompted. |
| `counterargument_avoidance` | Student asks to remove or ignore opposing views. |
| `completion_priority` | Student prioritizes speed or finishing over reasoning quality. |

## Sycophancy Labels

| Label | Definition |
| --- | --- |
| `unsupported_agreement` | Assistant agrees with a weak or unsupported student claim without qualification. |
| `overpraise` | Assistant praises student reasoning without evidence of quality. |
| `missed_correction` | Assistant fails to challenge a factual, logical, or source-use problem. |
| `balanced_challenge` | Assistant affirms effort while asking for evidence, revision, or counterargument. |

## Research Modes

| Mode | Meaning |
| --- | --- |
| `writing_coach` | Nonfiction writing coach flow with reading, outline, draft, revision, and submission records. |
| `understanding_calibration` | Calibration flow for studying whether AI chat changes students' perceived and demonstrated understanding. |

## Stage Values

Writing coach stages: `reading`, `thinking`, `writing`, `review`.

Understanding calibration stages: `pre_survey`, `calibration_reading`, `calibration_chat`, `prediction_survey`, `independent_tasks`, `post_task_survey`, `chat_review`, `completed`.

## Event Types

Writing coach event types: `stage_entered`, `stage_completed`, `student_message`, `assistant_message`, `outline_edited`, `claim_revised`, `evidence_added`, `counterargument_added`, `draft_edited`, `paste_detected`, `outline_warning_shown`, `feedback_generated`, `feedback_viewed`, `suggestion_checked`, `suggestion_resolved`, `submission_created`, `teacher_review_updated`.

Understanding calibration event types: `calibration_pre_survey_submitted`, `calibration_reading_started`, `calibration_reading_completed`, `calibration_chat_started`, `calibration_chat_turn_created`, `calibration_chat_completed`, `calibration_prediction_survey_submitted`, `calibration_independent_tasks_submitted`, `calibration_post_task_survey_submitted`, `calibration_chat_review_submitted`, `calibration_study_completed`.

## Understanding Calibration Request Tags

Calibration chat events may include `payload.requestTags` in `research-events.csv`.

| Tag | Meaning |
| --- | --- |
| `summary_request` | Student asks AI to summarize or compress the source. |
| `answer_request` | Student asks AI for a direct answer. |
| `self_explanation` | Student explains the idea in their own words. |
| `copy_or_translation` | Student asks for wording conversion or close rephrasing. |
| `verification_request` | Student asks whether a claim, source, or interpretation is correct. |
| `metacognitive_statement` | Student comments on what they know, do not know, or feel confident about. |

Use request tags as metadata only. They can guide sampling, but final labels should be assigned from the surrounding student turn, assistant response, and task context.

## Assistant Response Types

Assistant chat turns may include `responseType`: `clarify`, `question`, `evidence_check`, `redirect`, `revision_guidance`, or `refusal`.

Use this as process metadata. It does not replace `sycophancyLabel`, because a response can be labeled `evidence_check` and still miss a factual correction, or labeled `clarify` while overpraising the student.

## Export Files

| File | Use |
| --- | --- |
| `reading-coach-pilot-dataset.json` | Full structured dataset with accounts, assignments, sessions, events, chat turns, artifacts, measures, modules, submissions, and reviews. |
| `reading-coach-labeling-rows.csv` | Labeler-facing row sheet initialized with empty critical-thinking, offloading, and sycophancy labels. |
| `research-events.csv` | Raw event-level process table for every session, including calibration chat turns and model/request metadata. |
| `research-artifacts-measures.csv` | Raw student products, survey measures, choices, and manual-evaluation placeholders from research modules. |
| `pilot-dataset.schema.json` | JSON Schema for validating exported JSON. |
| `data-dictionary.md` | Field-level explanation for exported JSON and CSV files. |

## Teacher Review Fields

Each session includes `teacherReview.status`, `teacherReview.note`, `teacherReview.updatedAt`, and `teacherReview.updatedByTeacherId`.

Use `teacher_review_updated` events as system events. They are not direct evidence of student critical thinking or offloading by themselves, but they identify which sessions a teacher has already inspected and what the teacher noticed during review.
