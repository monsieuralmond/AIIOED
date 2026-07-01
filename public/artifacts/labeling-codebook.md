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
| `stage` | `reading`, `thinking`, `writing`, or `review`. |
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

## Event Types

`stage_entered`, `stage_completed`, `student_message`, `assistant_message`, `outline_edited`, `claim_revised`, `evidence_added`, `counterargument_added`, `draft_edited`, `paste_detected`, `outline_warning_shown`, `feedback_generated`, `feedback_viewed`, `suggestion_resolved`, `submission_created`, `teacher_review_updated`.

## Assistant Response Types

Assistant chat turns may include `responseType`: `clarify`, `question`, `evidence_check`, `redirect`, `revision_guidance`, or `refusal`.

Use this as process metadata. It does not replace `sycophancyLabel`, because a response can be labeled `evidence_check` and still miss a factual correction, or labeled `clarify` while overpraising the student.

## Teacher Review Fields

Each session includes `teacherReview.status`, `teacherReview.note`, `teacherReview.updatedAt`, and `teacherReview.updatedByTeacherId`.

Use `teacher_review_updated` events as system events. They are not direct evidence of student critical thinking or offloading by themselves, but they identify which sessions a teacher has already inspected and what the teacher noticed during review.
