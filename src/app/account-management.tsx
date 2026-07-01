import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { CreateClassGroupInput, CreateStudentInput, CreateTeacherInput } from "../session/session";
import type { ClassGroup, PilotState, StudentAccount, TeacherAccount } from "../shared/types";
import { RosterTable } from "./account-roster-table";
import { Button, Field, Surface, TextInput } from "./ui";

type AccountManagementProps = {
  readonly state: PilotState;
  readonly onBack: () => void;
  readonly onCreateClass: (input: CreateClassGroupInput) => string | null;
  readonly onCreateStudent: (input: CreateStudentInput) => string | null;
  readonly onCreateStudents: (inputs: readonly CreateStudentInput[]) => string | null;
  readonly onCreateTeacher: (input: CreateTeacherInput) => string | null;
  readonly onDeleteClass: (classGroupId: string) => string | null;
  readonly onDeleteStudent: (studentId: string) => string | null;
  readonly onDeleteTeacher: (teacherId: string) => string | null;
};

const firstTeacherId = (teachers: readonly TeacherAccount[]): string => teachers[0]?.id ?? "";
const firstClassId = (classGroups: readonly ClassGroup[]): string => classGroups[0]?.id ?? "";

export function AccountManagement(props: AccountManagementProps): ReactElement {
  const [className, setClassName] = useState("");
  const [classTeacherId, setClassTeacherId] = useState(firstTeacherId(props.state.teachers));
  const [studentClassId, setStudentClassId] = useState(firstClassId(props.state.classGroups));
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentLoginId, setStudentLoginId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [participantCode, setParticipantCode] = useState("");
  const [bulkClassId, setBulkClassId] = useState(firstClassId(props.state.classGroups));
  const [bulkStartNumber, setBulkStartNumber] = useState("1");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkLoginPrefix, setBulkLoginPrefix] = useState("student-");
  const [bulkPasswordPrefix, setBulkPasswordPrefix] = useState("pw-");
  const [bulkNamePrefix, setBulkNamePrefix] = useState("학생");
  const [teacherName, setTeacherName] = useState("");
  const [teacherLoginId, setTeacherLoginId] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [message, setMessage] = useState("");

  const classNameById = useMemo(() => new Map(props.state.classGroups.map((classGroup) => [classGroup.id, classGroup.name])), [props.state.classGroups]);

  useEffect(() => {
    const teacherIds = new Set(props.state.teachers.map((teacher) => teacher.id));
    const classIds = new Set(props.state.classGroups.map((classGroup) => classGroup.id));
    const nextTeacherId = firstTeacherId(props.state.teachers);
    const nextClassId = firstClassId(props.state.classGroups);
    if (classTeacherId !== nextTeacherId && !teacherIds.has(classTeacherId)) setClassTeacherId(nextTeacherId);
    if (studentClassId !== nextClassId && !classIds.has(studentClassId)) setStudentClassId(nextClassId);
    if (bulkClassId !== nextClassId && !classIds.has(bulkClassId)) setBulkClassId(nextClassId);
  }, [bulkClassId, classTeacherId, props.state.classGroups, props.state.teachers, studentClassId]);

  const createClass = (): void => {
    const error = props.onCreateClass({ name: className, teacherId: classTeacherId });
    if (error !== null) { setMessage(error); return; }
    setClassName("");
    setMessage("반을 만들었습니다.");
  };

  const createStudent = (): void => {
    const parsedNumber = Number(studentNumber);
    const fallbackCredential = participantCode.trim();
    const error = props.onCreateStudent({
      classGroupId: studentClassId,
      displayName: studentName,
      loginId: studentLoginId.trim().length === 0 ? fallbackCredential.toLowerCase() : studentLoginId,
      participantCode,
      password: studentPassword.trim().length === 0 ? fallbackCredential : studentPassword,
      studentNumber: parsedNumber
    });
    if (error !== null) { setMessage(error); return; }
    setStudentLoginId("");
    setStudentName("");
    setStudentNumber("");
    setStudentPassword("");
    setParticipantCode("");
    setMessage("학생 계정을 만들었습니다.");
  };

  const createStudents = (): void => {
    const startNumber = Number(bulkStartNumber);
    const count = Number(bulkCount);
    const loginPrefix = bulkLoginPrefix.trim();
    const passwordPrefix = bulkPasswordPrefix.trim();
    const namePrefix = bulkNamePrefix.trim();
    if (!Number.isInteger(startNumber) || startNumber <= 0) { setMessage("시작 번호는 1 이상의 정수여야 합니다."); return; }
    if (!Number.isInteger(count) || count <= 0) { setMessage("생성 갯수는 1 이상의 정수여야 합니다."); return; }
    if (loginPrefix.length === 0) { setMessage("아이디 접두어를 입력하세요."); return; }
    if (passwordPrefix.length === 0) { setMessage("비밀번호 접두어를 입력하세요."); return; }
    if (namePrefix.length === 0) { setMessage("학생 이름 접두어를 입력하세요."); return; }
    const lastNumber = startNumber + count - 1;
    const numberWidth = Math.max(2, `${lastNumber}`.length);
    const inputs = Array.from({ length: count }, (_, index): CreateStudentInput => {
      const nextNumber = startNumber + index;
      const suffix = `${nextNumber}`.padStart(numberWidth, "0");
      const loginId = `${loginPrefix}${suffix}`;
      return {
        classGroupId: bulkClassId,
        displayName: `${namePrefix} ${nextNumber}`,
        loginId,
        participantCode: loginId.toUpperCase(),
        password: `${passwordPrefix}${suffix}`,
        studentNumber: nextNumber
      };
    });
    const error = props.onCreateStudents(inputs);
    if (error !== null) { setMessage(error); return; }
    setMessage(`학생 계정 ${inputs.length}개를 만들었습니다.`);
  };

  const createTeacher = (): void => {
    const error = props.onCreateTeacher({ displayName: teacherName, loginId: teacherLoginId, password: teacherPassword });
    if (error !== null) { setMessage(error); return; }
    setTeacherName("");
    setTeacherLoginId("");
    setTeacherPassword("");
    setMessage("교사 계정을 만들었습니다.");
  };

  const deleteClass = (classGroup: ClassGroup): void => {
    const error = props.onDeleteClass(classGroup.id);
    setMessage(error ?? "반을 삭제했습니다.");
  };

  const deleteStudent = (student: StudentAccount): void => {
    const error = props.onDeleteStudent(student.id);
    setMessage(error ?? "학생 계정을 삭제했습니다.");
  };

  const deleteTeacher = (teacher: TeacherAccount): void => {
    const error = props.onDeleteTeacher(teacher.id);
    setMessage(error ?? "교사 계정을 삭제했습니다.");
  };

  return (
    <main className="account-page">
      <section className="teacher-page-heading">
        <div>
          <h1>계정 관리</h1>
          <p>반, 번호, 학생 참여자 코드, 교사 계정을 파일럿 데이터에 저장합니다.</p>
        </div>
        <Button onClick={props.onBack}>과제로 돌아가기</Button>
      </section>
      {message.length > 0 ? <p className="account-message">{message}</p> : null}
      <div className="account-management-layout">
        <section aria-label="계정 만들기" className="account-form-column">
          <div className="account-column-heading">
            <h2>새로 만들기</h2>
            <p>수업 전에 반, 학생, 교사 계정을 차례대로 추가합니다.</p>
          </div>
          <Surface className="account-section">
            <h3>반 만들기</h3>
            <Field label="새 반 이름"><TextInput value={className} onChange={(event) => setClassName(event.currentTarget.value)} /></Field>
            <label className="ui-field">
              <span>담당 교사</span>
              <select className="ui-control" value={classTeacherId} onChange={(event) => setClassTeacherId(event.currentTarget.value)}>
                {props.state.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>)}
              </select>
            </label>
            <Button variant="primary" onClick={createClass}>반 만들기</Button>
          </Surface>
          <Surface className="account-section">
            <h3>학생 만들기</h3>
            <label className="ui-field">
              <span>학생 반</span>
              <select className="ui-control" value={studentClassId} onChange={(event) => setStudentClassId(event.currentTarget.value)}>
                {props.state.classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
              </select>
            </label>
            <div className="account-field-grid">
              <Field label="학생 번호"><TextInput inputMode="numeric" value={studentNumber} onChange={(event) => setStudentNumber(event.currentTarget.value)} /></Field>
              <Field label="참여자 코드"><TextInput value={participantCode} onChange={(event) => setParticipantCode(event.currentTarget.value)} /></Field>
            </div>
            <div className="account-field-grid">
              <Field label="학생 아이디"><TextInput autoComplete="off" value={studentLoginId} onChange={(event) => setStudentLoginId(event.currentTarget.value)} /></Field>
              <Field label="학생 비밀번호"><TextInput autoComplete="new-password" value={studentPassword} onChange={(event) => setStudentPassword(event.currentTarget.value)} /></Field>
            </div>
            <Field label="학생 이름"><TextInput value={studentName} onChange={(event) => setStudentName(event.currentTarget.value)} /></Field>
            <Button variant="primary" onClick={createStudent}>학생 만들기</Button>
          </Surface>
          <Surface className="account-section">
            <h3>학생 일괄 만들기</h3>
            <p className="account-helper">예: 아이디 접두어 student-, 시작 번호 3, 생성 갯수 5 → student-03부터 student-07까지 만듭니다.</p>
            <label className="ui-field">
              <span>일괄 생성 반</span>
              <select className="ui-control" value={bulkClassId} onChange={(event) => setBulkClassId(event.currentTarget.value)}>
                {props.state.classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
              </select>
            </label>
            <div className="account-field-grid">
              <Field label="시작 번호"><TextInput inputMode="numeric" value={bulkStartNumber} onChange={(event) => setBulkStartNumber(event.currentTarget.value)} /></Field>
              <Field label="생성 갯수"><TextInput inputMode="numeric" value={bulkCount} onChange={(event) => setBulkCount(event.currentTarget.value)} /></Field>
            </div>
            <div className="account-field-grid">
              <Field label="아이디 접두어"><TextInput autoComplete="off" value={bulkLoginPrefix} onChange={(event) => setBulkLoginPrefix(event.currentTarget.value)} /></Field>
              <Field label="비밀번호 접두어"><TextInput autoComplete="off" value={bulkPasswordPrefix} onChange={(event) => setBulkPasswordPrefix(event.currentTarget.value)} /></Field>
            </div>
            <Field label="학생 이름 접두어"><TextInput value={bulkNamePrefix} onChange={(event) => setBulkNamePrefix(event.currentTarget.value)} /></Field>
            <Button variant="primary" onClick={createStudents}>학생 일괄 만들기</Button>
          </Surface>
          <Surface className="account-section">
            <h3>교사 만들기</h3>
            <Field label="교사 이름"><TextInput value={teacherName} onChange={(event) => setTeacherName(event.currentTarget.value)} /></Field>
            <div className="account-field-grid">
              <Field label="교사 아이디 만들기"><TextInput autoComplete="off" value={teacherLoginId} onChange={(event) => setTeacherLoginId(event.currentTarget.value)} /></Field>
              <Field label="교사 비밀번호 만들기"><TextInput type="password" value={teacherPassword} onChange={(event) => setTeacherPassword(event.currentTarget.value)} /></Field>
            </div>
            <Button variant="primary" onClick={createTeacher}>교사 만들기</Button>
          </Surface>
        </section>
        <section aria-label="저장된 계정 목록" className="account-list-column">
          <div className="account-column-heading">
            <h2>저장된 목록</h2>
            <p>생성된 반, 학생 참여자 코드, 교사 아이디를 한곳에서 확인합니다.</p>
          </div>
          <RosterTable
            classNameById={classNameById}
            state={props.state}
            onDeleteClass={deleteClass}
            onDeleteStudent={deleteStudent}
            onDeleteTeacher={deleteTeacher}
          />
        </section>
      </div>
    </main>
  );
}
