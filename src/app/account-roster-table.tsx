import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import type { ClassGroup, PilotState, StudentAccount, TeacherAccount } from "../shared/types.js";

type RosterTableProps = {
  readonly classNameById: ReadonlyMap<string, string>;
  readonly canManageRoster: boolean;
  readonly canManageTeachers: boolean;
  readonly state: PilotState;
  readonly onDeleteClass: (classGroup: ClassGroup) => void;
  readonly onDeleteStudent: (student: StudentAccount) => void;
  readonly onDeleteTeacher: (teacher: TeacherAccount) => void;
  readonly onUpdateTeacherPassword: (teacher: TeacherAccount, password: string) => void;
};

export function RosterTable(props: RosterTableProps): ReactElement {
  return (
    <>
      {props.canManageRoster ? <DataTable label="반 목록" headers={["반", "담당 교사", "학생 수", "삭제"]}>
        {props.state.classGroups.map((classGroup) => {
          const teacher = props.state.teachers.find((item) => item.id === classGroup.teacherId);
          return (
            <tr key={classGroup.id}>
              <td>{classGroup.name}</td>
              <td>{teacher?.displayName ?? "미지정"}</td>
              <td>{classGroup.studentIds.length}명</td>
              <td className="account-action-cell"><TrashButton label={`반 삭제: ${classGroup.name}`} onClick={() => props.onDeleteClass(classGroup)} /></td>
            </tr>
          );
        })}
      </DataTable> : null}
      {props.canManageRoster ? <DataTable label="학생 계정 목록" headers={["반", "번호", "학생", "참여자 코드", "학생 아이디", "초기 비밀번호", "삭제"]}>
        {props.state.students.map((student) => (
          <tr key={student.id}>
            <td>{props.classNameById.get(student.classGroupId) ?? "미지정"}</td>
            <td>{student.studentNumber}번</td>
            <td>{student.displayName}</td>
            <td>{student.participantCode}</td>
            <td>{student.loginId}</td>
            <td>{student.password}</td>
            <td className="account-action-cell"><TrashButton label={`학생 삭제: ${student.displayName}`} onClick={() => props.onDeleteStudent(student)} /></td>
          </tr>
        ))}
      </DataTable> : null}
      {props.canManageTeachers ? (
        <DataTable className="teacher-account-table" label="교사 계정 목록" headers={["교사", "아이디", "비밀번호 수정", "삭제"]}>
          {props.state.teachers.map((teacher) => (
            <TeacherRow
              key={teacher.id}
              teacher={teacher}
              onDelete={props.onDeleteTeacher}
              onUpdatePassword={props.onUpdateTeacherPassword}
            />
          ))}
        </DataTable>
      ) : null}
    </>
  );
}

function TeacherRow(props: {
  readonly teacher: TeacherAccount;
  readonly onDelete: (teacher: TeacherAccount) => void;
  readonly onUpdatePassword: (teacher: TeacherAccount, password: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(props.teacher.password);
  useEffect(() => setDraft(props.teacher.password), [props.teacher.id, props.teacher.password]);
  const normalizedDraft = draft.trim();
  const hasStoredPassword = props.teacher.password.trim().length > 0;
  const saveDisabled = normalizedDraft.length === 0 || normalizedDraft === props.teacher.password;
  return (
    <tr>
      <td>{props.teacher.displayName}</td>
      <td>{props.teacher.loginId}</td>
      <td className="account-password-cell">
        <div className="account-password-editor">
          <input
            aria-label={`교사 비밀번호: ${props.teacher.displayName}`}
            autoComplete="off"
            className="account-password-input"
            placeholder="새 비밀번호 입력"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
          <button
            aria-label={`교사 비밀번호 저장: ${props.teacher.displayName}`}
            className="account-save-button"
            disabled={saveDisabled}
            title={`교사 비밀번호 저장: ${props.teacher.displayName}`}
            type="button"
            onClick={() => props.onUpdatePassword(props.teacher, normalizedDraft)}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </button>
        </div>
        {hasStoredPassword ? null : <span className="account-password-hint">저장된 원문 비밀번호가 없습니다. 새 비밀번호를 입력해 저장하세요.</span>}
      </td>
      <td className="account-action-cell"><TrashButton label={`교사 삭제: ${props.teacher.displayName}`} onClick={() => props.onDelete(props.teacher)} /></td>
    </tr>
  );
}

function TrashButton(props: { readonly label: string; readonly onClick: () => void }): ReactElement {
  return (
    <button aria-label={props.label} className="account-delete-button" onClick={props.onClick} title={props.label} type="button">
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </svg>
    </button>
  );
}

function DataTable(props: { readonly children: ReactElement | readonly ReactElement[]; readonly className?: string; readonly headers: readonly string[]; readonly label: string }): ReactElement {
  return (
    <section className={props.className === undefined ? "account-table-wrap" : `account-table-wrap ${props.className}`}>
      <h3>{props.label}</h3>
      <table aria-label={props.label} className="account-table">
        <thead><tr>{props.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{props.children}</tbody>
      </table>
    </section>
  );
}
