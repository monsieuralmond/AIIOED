import type { ReactElement } from "react";
import type { ClassGroup, PilotState, StudentAccount, TeacherAccount } from "../shared/types";

type RosterTableProps = {
  readonly classNameById: ReadonlyMap<string, string>;
  readonly state: PilotState;
  readonly onDeleteClass: (classGroup: ClassGroup) => void;
  readonly onDeleteStudent: (student: StudentAccount) => void;
  readonly onDeleteTeacher: (teacher: TeacherAccount) => void;
};

export function RosterTable(props: RosterTableProps): ReactElement {
  return (
    <>
      <DataTable label="반 목록" headers={["반", "담당 교사", "학생 수", "삭제"]}>
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
      </DataTable>
      <DataTable label="학생 계정 목록" headers={["반", "번호", "학생", "참여자 코드", "학생 아이디", "초기 비밀번호", "삭제"]}>
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
      </DataTable>
      <DataTable label="교사 계정 목록" headers={["교사", "아이디", "비밀번호", "삭제"]}>
        {props.state.teachers.map((teacher) => (
          <tr key={teacher.id}>
            <td>{teacher.displayName}</td>
            <td>{teacher.loginId}</td>
            <td>{teacher.password}</td>
            <td className="account-action-cell"><TrashButton label={`교사 삭제: ${teacher.displayName}`} onClick={() => props.onDeleteTeacher(teacher)} /></td>
          </tr>
        ))}
      </DataTable>
    </>
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

function DataTable(props: { readonly children: ReactElement | readonly ReactElement[]; readonly headers: readonly string[]; readonly label: string }): ReactElement {
  return (
    <section className="account-table-wrap">
      <h3>{props.label}</h3>
      <table aria-label={props.label} className="account-table">
        <thead><tr>{props.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{props.children}</tbody>
      </table>
    </section>
  );
}
