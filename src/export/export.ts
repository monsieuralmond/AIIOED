import type { FileSyncStatus, LabelingRow, LabelingSpeaker, PilotDataset, PilotEventType, PilotSession, PilotState, PublicStudentAccount, PublicTeacherAccount, StudentAccount, TeacherAccount } from "../shared/types";

export { exportResearchArtifactMeasureRows, exportResearchEventRows, stringifyResearchArtifactMeasuresCsv, stringifyResearchEventsCsv } from "./research-csv";

export const DATASET_SCHEMA_ID = "reading-coach-pilot-dataset.v1";
export const LABELING_CODEBOOK_ID = "critical-thinking-cognitive-offloading-sycophancy.v1";

const defaultFileSync: FileSyncStatus = {
  status: "pending",
  message: "아직 파일 저장 상태가 확인되지 않았습니다."
};

const nowIso = (): string => new Date().toISOString();
const publicTeacher = (teacher: TeacherAccount): PublicTeacherAccount => ({
  displayName: teacher.displayName,
  id: teacher.id,
  loginId: teacher.loginId
});

const publicStudent = (student: StudentAccount): PublicStudentAccount => ({
  classGroupId: student.classGroupId,
  displayName: student.displayName,
  id: student.id,
  loginId: student.loginId,
  participantCode: student.participantCode,
  studentNumber: student.studentNumber
});

const labelingColumns: readonly (keyof LabelingRow)[] = [
  "sessionId",
  "studentAnonymousId",
  "assignmentId",
  "turnOrEventId",
  "timestamp",
  "stage",
  "speaker",
  "criticalThinkingLabel",
  "offloadingLabel",
  "sycophancyLabel",
  "evidenceText",
  "raterNotes"
];

const speakerByEventType: Readonly<Record<PilotEventType, LabelingSpeaker>> = {
  assistant_message: "assistant",
  claim_revised: "system_event",
  counterargument_added: "system_event",
  draft_edited: "system_event",
  evidence_added: "system_event",
  feedback_generated: "system_event",
  feedback_viewed: "system_event",
  outline_edited: "system_event",
  outline_warning_shown: "system_event",
  paste_detected: "system_event",
  source_added: "system_event",
  stage_completed: "system_event",
  stage_entered: "system_event",
  student_message: "student",
  submission_created: "system_event",
  suggestion_checked: "system_event",
  suggestion_resolved: "system_event",
  teacher_review_updated: "system_event",
  calibration_chat_completed: "system_event",
  calibration_chat_review_submitted: "system_event",
  calibration_chat_started: "system_event",
  calibration_chat_turn_created: "system_event",
  calibration_independent_tasks_submitted: "system_event",
  calibration_post_task_survey_submitted: "system_event",
  calibration_pre_survey_submitted: "system_event",
  calibration_prediction_survey_submitted: "system_event",
  calibration_reading_completed: "system_event",
  calibration_reading_started: "system_event",
  calibration_study_completed: "system_event"
};

const evidenceText = (payload: Record<string, unknown>, eventType: PilotEventType): string => {
  const text = payload["text"];
  if (typeof text === "string") return text;
  const serialized = JSON.stringify(payload);
  return serialized === undefined || serialized === "{}" ? eventType : serialized;
};

const csvValue = (value: string): string => `"${value.replaceAll("\"", "\"\"")}"`;

export const exportSession = (session: PilotSession): PilotSession => session;

export const stringifySession = (session: PilotSession): string => JSON.stringify(exportSession(session), null, 2);

export const exportDataset = (state: PilotState, fileSync: FileSyncStatus = defaultFileSync): PilotDataset => ({
  ...state,
  teacher: publicTeacher(state.teacher),
  teachers: state.teachers.map(publicTeacher),
  students: state.students.map(publicStudent),
  exportMetadata: {
    codebookId: LABELING_CODEBOOK_ID,
    fileSync,
    generatedAt: nowIso(),
    schemaId: DATASET_SCHEMA_ID
  }
});

export const stringifyDataset = (state: PilotState, fileSync?: FileSyncStatus): string => JSON.stringify(exportDataset(state, fileSync), null, 2);

export const exportLabelingRows = (state: PilotState): readonly LabelingRow[] =>
  state.sessions.flatMap((session) =>
    session.events.map((event): LabelingRow => ({
      assignmentId: session.assignment.id,
      criticalThinkingLabel: "none",
      evidenceText: evidenceText(event.payload, event.type),
      offloadingLabel: "none",
      raterNotes: "",
      sessionId: session.sessionId,
      speaker: speakerByEventType[event.type],
      stage: event.stage,
      studentAnonymousId: session.student.anonymousId,
      sycophancyLabel: "none",
      timestamp: event.timestamp,
      turnOrEventId: event.id
    }))
  );

export const stringifyLabelingCsv = (state: PilotState): string => {
  const rows = exportLabelingRows(state);
  return [
    labelingColumns.join(","),
    ...rows.map((row) => labelingColumns.map((column) => csvValue(row[column])).join(","))
  ].join("\n");
};
