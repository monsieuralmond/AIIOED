import { useState } from "react";
import type { ReactElement } from "react";
import type { TeacherReviewNote, TeacherReviewStatus, TeacherReviewUpdate } from "../shared/types";
import { Button, Field, TextArea } from "./ui";

const reviewStatuses: readonly TeacherReviewStatus[] = ["not_reviewed", "needs_follow_up", "reviewed"];

const reviewStatusLabels: Readonly<Record<TeacherReviewStatus, string>> = {
  needs_follow_up: "추가 확인 필요",
  not_reviewed: "검토 전",
  reviewed: "검토 완료"
};

export function TeacherReviewNoteEditor(props: { readonly note: TeacherReviewNote; readonly onSave: (input: TeacherReviewUpdate) => void }): ReactElement {
  const [status, setStatus] = useState<TeacherReviewStatus>(props.note.status);
  const [note, setNote] = useState(props.note.note);
  const [saved, setSaved] = useState(false);
  const updatedLabel = props.note.updatedByTeacherId === null ? "아직 저장된 검토 없음" : `마지막 저장 ${new Date(props.note.updatedAt).toLocaleString("ko-KR")}`;

  const saveReview = (): void => {
    props.onSave({ note, status });
    setSaved(true);
  };

  const updateStatus = (nextStatus: TeacherReviewStatus): void => {
    setStatus(nextStatus);
    setSaved(false);
  };

  const updateNote = (nextNote: string): void => {
    setNote(nextNote);
    setSaved(false);
  };

  return (
    <section aria-label="교사 검토" className="teacher-review-note">
      <header className="teacher-review-note-heading">
        <div>
          <h3>교사 검토</h3>
          <p>{updatedLabel}</p>
        </div>
      </header>
      <fieldset className="teacher-review-status-group">
        <legend>검토 상태</legend>
        <div className="teacher-review-status-options">
          {reviewStatuses.map((reviewStatus) => (
            <label className={status === reviewStatus ? "teacher-review-status-option selected" : "teacher-review-status-option"} key={reviewStatus}>
              <input checked={status === reviewStatus} name="teacher-review-status" type="radio" onChange={() => updateStatus(reviewStatus)} />
              <span>{reviewStatusLabels[reviewStatus]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="교사 메모">
        <TextArea rows={4} value={note} onChange={(event) => updateNote(event.currentTarget.value)} />
      </Field>
      <footer className="teacher-review-note-actions">
        <Button variant="primary" onClick={saveReview}>검토 저장</Button>
        {saved ? <p className="success-text">검토 기록이 저장되었습니다.</p> : null}
      </footer>
    </section>
  );
}
