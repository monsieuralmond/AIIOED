import { useState } from "react";
import type { ReactElement } from "react";
import { sessionStatus } from "../session/session.js";
import type { Assignment, PilotState, StudentAccount, StudentWorkStatus } from "../shared/types.js";
import { Button, Surface } from "./ui.js";

const passagePreviewLimit = 320;

const statusLabels: Readonly<Record<StudentWorkStatus, string>> = {
  not_started: "시작 전",
  in_progress: "진행 중",
  submitted: "제출 완료"
};

const previewPassage = (passage: string): string => {
  const compactPassage = passage.replace(/\s+/g, " ").trim();
  if (compactPassage.length <= passagePreviewLimit) return compactPassage;
  return `${compactPassage.slice(0, passagePreviewLimit).trimEnd()}...`;
};

type StudentAssignmentsProps = {
  readonly assignments: readonly Assignment[];
  readonly state: PilotState;
  readonly student: StudentAccount;
  readonly onStart: (assignmentId: string) => boolean | Promise<boolean>;
};

type AssignedTaskProps = {
  readonly assignment: Assignment;
  readonly pending: boolean;
  readonly startError: string;
  readonly state: PilotState;
  readonly student: StudentAccount;
  readonly onStart: (assignmentId: string) => void | Promise<void>;
};

function AssignedTask(props: AssignedTaskProps): ReactElement {
  const status = sessionStatus(props.state, props.student.id, props.assignment.id);
  return (
    <>
      <article className="assigned-task-row" aria-label={`${props.assignment.title} 과제`}>
        <div>
          <strong>{props.assignment.title}</strong>
          <p>{props.assignment.question}</p>
          <dl className="assigned-task-meta">
            <div><dt>난이도</dt><dd>{props.assignment.gradeLevel}</dd></div>
            <div><dt>상태</dt><dd>{statusLabels[status]}</dd></div>
          </dl>
          {props.assignment.dueDate === undefined ? null : <p className="student-due-note">마감: {props.assignment.dueDate}{props.assignment.dueTime === undefined ? "" : ` ${props.assignment.dueTime}`}</p>}
        </div>
        <div className="assigned-task-actions">
          <Button disabled={props.pending} variant="primary" onClick={() => { void props.onStart(props.assignment.id); }}>
            {props.pending ? "시작 중" : "과제 시작"}
          </Button>
          {props.startError.length > 0 ? <p className="student-start-error" role="alert">{props.startError}</p> : null}
        </div>
      </article>
      <section className="student-passage-preview" aria-label="지문 미리보기">
        <p className="support-label">지문 미리보기</p>
        <p>{previewPassage(props.assignment.passage)}</p>
      </section>
    </>
  );
}

export function StudentAssignments(props: StudentAssignmentsProps): ReactElement {
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const [startErrorByAssignmentId, setStartErrorByAssignmentId] = useState<Record<string, string>>({});

  const startAssignment = async (assignmentId: string): Promise<void> => {
    setPendingAssignmentId(assignmentId);
    setStartErrorByAssignmentId((errors) => ({ ...errors, [assignmentId]: "" }));
    try {
      const started = await props.onStart(assignmentId);
      if (!started) {
        setStartErrorByAssignmentId((errors) => ({ ...errors, [assignmentId]: "과제를 시작하지 못했습니다. 잠시 후 다시 눌러 주세요." }));
      }
    } catch (error) {
      setStartErrorByAssignmentId((errors) => ({
        ...errors,
        [assignmentId]: error instanceof Error ? error.message : "과제를 시작하지 못했습니다. 잠시 후 다시 눌러 주세요."
      }));
    } finally {
      setPendingAssignmentId(null);
    }
  };

  return (
    <main className="student-assignments-page">
      <Surface className="student-assignment">
        <header className="student-assignment-hero">
          <p className="student-name">{props.student.displayName}</p>
          <p className="eyebrow">{props.student.displayName} 학생에게 배정됨</p>
          <h1>배정된 과제</h1>
          <p>지문을 읽고 문제에 대해 내 주장을 세운 뒤, 근거와 반론을 넣어 글을 완성합니다.</p>
        </header>
        {props.assignments.length === 0 ? <p className="prompt-empty-state">아직 배정된 과제가 없습니다. 교사에게 과제 배정을 확인해 주세요.</p> : null}
        {props.assignments.map((assignment) => (
          <AssignedTask
            assignment={assignment}
            key={assignment.id}
            pending={pendingAssignmentId === assignment.id}
            startError={startErrorByAssignmentId[assignment.id] ?? ""}
            state={props.state}
            student={props.student}
            onStart={startAssignment}
          />
        ))}
      </Surface>
    </main>
  );
}
