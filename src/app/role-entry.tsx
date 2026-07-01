import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Field, Surface, TextInput } from "./ui";

type RoleEntryMode = "entry" | "teacher";

type RoleEntryProps = {
  readonly mode: RoleEntryMode;
  readonly onTeacher: (loginId: string, password: string) => boolean;
  readonly onStudentCode: (code: string) => boolean;
  readonly onStudentCredentials: (loginId: string, password: string) => boolean;
};

export function RoleEntry(props: RoleEntryProps): ReactElement {
  const [participantCode, setParticipantCode] = useState("");
  const [studentLoginId, setStudentLoginId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [teacherLoginId, setTeacherLoginId] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [studentError, setStudentError] = useState("");
  const [studentCredentialError, setStudentCredentialError] = useState("");
  const [teacherError, setTeacherError] = useState("");

  const submitStudentCode = (): void => {
    setStudentError("");
    if (!props.onStudentCode(participantCode)) setStudentError("참여자 코드를 확인하세요");
  };

  const submitStudentCredentials = (): void => {
    setStudentCredentialError("");
    if (!props.onStudentCredentials(studentLoginId, studentPassword)) setStudentCredentialError("학생 아이디 또는 비밀번호가 맞지 않습니다");
  };

  const submitTeacher = (): void => {
    setTeacherError("");
    if (!props.onTeacher(teacherLoginId, teacherPassword)) setTeacherError("교사 아이디 또는 비밀번호가 맞지 않습니다");
  };

  const showStudent = props.mode === "entry";

  return (
    <main className="role-entry-page">
      <Surface className="role-entry">
        <p className="eyebrow">Reading Coach Lab pilot</p>
        <h1>{props.mode === "teacher" ? "교사 확인" : "수업 계정으로 시작하세요"}</h1>
        <p>학생은 받은 코드나 아이디로 입장합니다. 교사는 계정으로 과제와 연구 로그를 확인합니다.</p>
        {showStudent ? (
          <section className="login-section" aria-label="학생 입장">
            <Field label="참여자 코드">
              <TextInput autoComplete="off" value={participantCode} onChange={(event) => setParticipantCode(event.currentTarget.value)} />
            </Field>
            {studentError.length > 0 ? <p className="error-text">{studentError}</p> : null}
            <Button variant="primary" onClick={submitStudentCode}>학생으로 시작</Button>
            <div className="login-divider">또는</div>
            <div className="account-field-grid login-credential-grid">
              <Field label="학생 아이디">
                <TextInput autoComplete="username" value={studentLoginId} onChange={(event) => setStudentLoginId(event.currentTarget.value)} />
              </Field>
              <Field label="학생 비밀번호">
                <TextInput autoComplete="current-password" type="password" value={studentPassword} onChange={(event) => setStudentPassword(event.currentTarget.value)} />
              </Field>
            </div>
            {studentCredentialError.length > 0 ? <p className="error-text">{studentCredentialError}</p> : null}
            <Button onClick={submitStudentCredentials}>아이디로 시작</Button>
          </section>
        ) : null}
        <section className="login-section" aria-label="교사 입장">
          <Field label="교사 아이디">
            <TextInput autoComplete="username" value={teacherLoginId} onChange={(event) => setTeacherLoginId(event.currentTarget.value)} />
          </Field>
          <Field label="교사 비밀번호">
            <TextInput autoComplete="current-password" type="password" value={teacherPassword} onChange={(event) => setTeacherPassword(event.currentTarget.value)} />
          </Field>
          {teacherError.length > 0 ? <p className="error-text">{teacherError}</p> : null}
          <Button onClick={submitTeacher}>교사로 시작</Button>
        </section>
      </Surface>
    </main>
  );
}
