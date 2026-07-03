import { useState } from "react";
import type { ReactElement } from "react";
import { sessionForStudent, sessionStatus } from "../session/session";
import type { Assignment, PilotSession, PilotState, StudentAccount, StudentWorkStatus, TeacherReviewStatus, TeacherReviewUpdate } from "../shared/types";
import { TeacherProcessRecord } from "./teacher-process-record";
import { reviewFilterLabels, reviewFilters, teacherReviewLabels } from "./teacher-review-status";
import type { ReviewFilter } from "./teacher-review-status";
import { Button, Field, Surface, TextInput } from "./ui";

type StatusFilter = "all" | StudentWorkStatus;

type StudentProcessRow = {
  readonly session: PilotSession | null;
  readonly status: StudentWorkStatus;
  readonly student: StudentAccount;
};

const statusLabels: Readonly<Record<StudentWorkStatus, string>> = {
  not_started: "시작 전",
  in_progress: "진행 중",
  submitted: "제출 완료"
};

const statusClassNames: Readonly<Record<StudentWorkStatus, string>> = {
  not_started: "status-badge not-started",
  in_progress: "status-badge in-progress",
  submitted: "status-badge submitted"
};

const statusFilters: readonly StatusFilter[] = ["all", "not_started", "in_progress", "submitted"];

const statusFilterLabels: Readonly<Record<StatusFilter, string>> = {
  all: "전체",
  ...statusLabels
};

const matchesSearch = (row: StudentProcessRow, searchText: string): boolean => {
  const query = searchText.trim().toLowerCase();
  if (query.length === 0) return true;
  return row.student.displayName.toLowerCase().includes(query) || row.student.participantCode.toLowerCase().includes(query) || `${row.student.studentNumber}`.includes(query);
};

const reviewStatusForRow = (row: StudentProcessRow): TeacherReviewStatus => row.session?.teacherReview.status ?? "not_reviewed";

const initialAssignmentId = (state: PilotState): string =>
  state.assignments.find((assignment) => assignment.id === state.activeAssignmentId)?.id ?? state.assignments[0]?.id ?? "";

const studentsForAssignment = (state: PilotState, assignment: Assignment | null): readonly StudentAccount[] => {
  if (assignment === null || assignment.classGroupId === undefined) return state.students;
  return state.students.filter((student) => student.classGroupId === assignment.classGroupId);
};

export function TeacherReview(props: { readonly state: PilotState; readonly onBack: () => void; readonly onUpdateReview: (sessionId: string, input: TeacherReviewUpdate) => void }): ReactElement {
  const [selectedStudentId, setSelectedStudentId] = useState(props.state.students[0]?.id ?? "");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(initialAssignmentId(props.state));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all_reviews");
  const [studentSearch, setStudentSearch] = useState("");
  const fallbackAssignmentId = initialAssignmentId(props.state);
  const effectiveAssignmentId = props.state.assignments.some((assignment) => assignment.id === selectedAssignmentId) ? selectedAssignmentId : fallbackAssignmentId;
  const selectedAssignment = props.state.assignments.find((assignment) => assignment.id === effectiveAssignmentId) ?? null;
  const selectedClassGroup = selectedAssignment?.classGroupId === undefined ? null : props.state.classGroups.find((classGroup) => classGroup.id === selectedAssignment.classGroupId) ?? null;
  const assignmentStudents = studentsForAssignment(props.state, selectedAssignment);
  const studentRows = assignmentStudents.map((student): StudentProcessRow => {
    const session = sessionForStudent(props.state, student.id, effectiveAssignmentId);
    return { session, status: sessionStatus(props.state, student.id, effectiveAssignmentId), student };
  });
  const statusCounts: Readonly<Record<StatusFilter, number>> = {
    all: studentRows.length,
    in_progress: studentRows.filter((row) => row.status === "in_progress").length,
    not_started: studentRows.filter((row) => row.status === "not_started").length,
    submitted: studentRows.filter((row) => row.status === "submitted").length
  };
  const reviewCounts: Readonly<Record<ReviewFilter, number>> = {
    all_reviews: studentRows.length,
    needs_follow_up: studentRows.filter((row) => reviewStatusForRow(row) === "needs_follow_up").length,
    not_reviewed: studentRows.filter((row) => reviewStatusForRow(row) === "not_reviewed").length,
    reviewed: studentRows.filter((row) => reviewStatusForRow(row) === "reviewed").length
  };
  const visibleRows = studentRows.filter((row) => (statusFilter === "all" || row.status === statusFilter) && (reviewFilter === "all_reviews" || reviewStatusForRow(row) === reviewFilter) && matchesSearch(row, studentSearch));
  const selectedRow = studentRows.find((row) => row.student.id === selectedStudentId) ?? studentRows[0] ?? null;
  const selectedSession = selectedRow?.session ?? null;
  return (
    <main className="teacher-review-page">
      <section className="teacher-review-header">
        <div>
          <h1>학생 현황</h1>
          <p>과제별로 학생 진행 상태와 대화, 응답, 최종 제출 기록을 확인합니다.</p>
        </div>
        <Button onClick={props.onBack}>과제 목록</Button>
      </section>
      <section className="teacher-review-layout">
        <Surface className="student-status-list">
          <header className="student-status-heading">
            <div>
              <h2>{selectedAssignment?.title ?? "과제 없음"}</h2>
              <p>{selectedClassGroup?.name ?? "전체 학생"} · {studentRows.length}명 중 {statusCounts.submitted}명 제출</p>
            </div>
          </header>
          <div className="student-status-tools">
            <Field label="과제 선택">
              <select
                className="ui-control"
                disabled={props.state.assignments.length === 0}
                value={effectiveAssignmentId}
                onChange={(event) => {
                  setSelectedAssignmentId(event.currentTarget.value);
                  setStatusFilter("all");
                  setReviewFilter("all_reviews");
                }}
              >
                {props.state.assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
                ))}
              </select>
            </Field>
            <Field label="학생 검색">
              <TextInput placeholder="이름, 번호, 코드" value={studentSearch} onChange={(event) => setStudentSearch(event.currentTarget.value)} />
            </Field>
            <div aria-label="상태 필터" className="status-filter-group" role="group">
              {statusFilters.map((filter) => (
                <button aria-pressed={statusFilter === filter} className={filter === statusFilter ? "status-filter selected" : "status-filter"} key={filter} type="button" onClick={() => setStatusFilter(filter)}>
                  {statusFilterLabels[filter]} {statusCounts[filter]}
                </button>
              ))}
            </div>
            <div aria-label="검토 필터" className="status-filter-group" role="group">
              {reviewFilters.map((filter) => (
                <button aria-pressed={reviewFilter === filter} className={filter === reviewFilter ? "status-filter selected" : "status-filter"} key={filter} type="button" onClick={() => setReviewFilter(filter)}>
                  {reviewFilterLabels[filter]} {reviewCounts[filter]}
                </button>
              ))}
            </div>
          </div>
          {visibleRows.length === 0 ? <p className="empty-student-list">조건에 맞는 학생이 없습니다.</p> : null}
          {visibleRows.map((row) => {
            const rowClassName = row.student.id === selectedRow?.student.id ? "student-status-row selected" : "student-status-row";
            return (
              <article aria-label={`${row.student.displayName} 상태`} className={rowClassName} key={row.student.id}>
                <div className="student-status-main">
                  <strong>{row.student.displayName}</strong>
                  <span className="student-status-meta">{row.student.studentNumber}번 · {row.student.participantCode}</span>
                  <span className={statusClassNames[row.status]}>{statusLabels[row.status]}</span>
                  {row.session === null ? null : <span className={`review-status-badge ${row.session.teacherReview.status}`}>{teacherReviewLabels[row.session.teacherReview.status]}</span>}
                </div>
                <Button onClick={() => setSelectedStudentId(row.student.id)}>{row.student.displayName} 과정 보기</Button>
              </article>
            );
          })}
        </Surface>
        <Surface className="process-review">
          {selectedSession === null ? (
            <EmptyProcessRecord row={selectedRow} />
          ) : (
            <TeacherProcessRecord session={selectedSession} onUpdateReview={props.onUpdateReview} />
          )}
        </Surface>
      </section>
    </main>
  );
}

function EmptyProcessRecord(props: { readonly row: StudentProcessRow | null }): ReactElement {
  if (props.row === null) {
    return (
      <div className="empty-process">
        <h2>학생을 선택하세요</h2>
        <p>왼쪽 목록에서 학생을 고르면 과정 기록을 확인할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <article className="empty-process selected-student-process" aria-label={`${props.row.student.displayName} 과정 기록`}>
      <p className="eyebrow">선택한 학생</p>
      <h2>{props.row.student.displayName}</h2>
      <dl className="empty-process-meta">
        <div><dt>번호</dt><dd>{props.row.student.studentNumber}번</dd></div>
        <div><dt>참여자 코드</dt><dd>{props.row.student.participantCode}</dd></div>
        <div><dt>상태</dt><dd>{statusLabels[props.row.status]}</dd></div>
      </dl>
      <section aria-label="기록 대기 항목" className="empty-process-next">
        <h3>과제를 시작하면 자동으로 모입니다</h3>
        <ul>
          <li>AI 코치와 나눈 대화 턴</li>
          <li>생각 정리, 초안, 고쳐쓰기 기록</li>
          <li>붙여넣기 시도와 최종 제출 글</li>
        </ul>
      </section>
    </article>
  );
}
