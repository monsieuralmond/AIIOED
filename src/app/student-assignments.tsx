import type { ReactElement } from "react";
import { sessionStatus } from "../session/session";
import type { Assignment, PilotState, StudentAccount, StudentWorkStatus } from "../shared/types";
import { Button, Surface } from "./ui";

const statusLabels: Readonly<Record<StudentWorkStatus, string>> = {
  not_started: "시작 전",
  in_progress: "진행 중",
  submitted: "제출 완료"
};

const assignmentRequirements = (assignment: Assignment): readonly string[] =>
  assignment.requirements ?? [
    "문제에 직접 답하는 중심 생각 한 문장",
    "지문에서 근거 두 가지를 찾아 내 말로 설명하기",
    "반대 의견을 생각하고 내 주장을 다시 확인하기"
  ];

type StudentAssignmentsProps = {
  readonly assignments: readonly Assignment[];
  readonly state: PilotState;
  readonly student: StudentAccount;
  readonly onStart: (assignmentId: string) => void;
};

type AssignedTaskProps = {
  readonly assignment: Assignment;
  readonly state: PilotState;
  readonly student: StudentAccount;
  readonly onStart: (assignmentId: string) => void;
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
            <div><dt>목표</dt><dd>{props.assignment.targetLength}</dd></div>
            <div><dt>상태</dt><dd>{statusLabels[status]}</dd></div>
          </dl>
          {props.assignment.dueDate === undefined ? null : <p className="student-due-note">마감: {props.assignment.dueDate}{props.assignment.dueTime === undefined ? "" : ` ${props.assignment.dueTime}`}</p>}
        </div>
        <Button variant="primary" onClick={() => props.onStart(props.assignment.id)}>과제 시작</Button>
      </article>
      <section className="student-output-brief" aria-label="내가 제출할 글">
        <p className="support-label">내가 제출할 글</p>
        <ul>
          {assignmentRequirements(props.assignment).map((requirement) => <li key={requirement}>{requirement}</li>)}
        </ul>
        {props.assignment.sourceGuidance === undefined ? null : <p className="source-guidance">{props.assignment.sourceGuidance}</p>}
      </section>
      <section className="student-passage-preview" aria-label="지문 미리보기">
        <p className="support-label">지문 미리보기</p>
        <p>{props.assignment.passage}</p>
      </section>
    </>
  );
}

export function StudentAssignments(props: StudentAssignmentsProps): ReactElement {
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
          <AssignedTask assignment={assignment} key={assignment.id} state={props.state} student={props.student} onStart={props.onStart} />
        ))}
      </Surface>
    </main>
  );
}
