import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Field, Surface, TextInput } from "./ui.js";

type RoleEntryMode = "admin" | "entry" | "teacher";
type LoginRole = "admin" | "student" | "teacher";
type StudentLoginInput = {
  readonly loginId: string;
  readonly participantCode: string;
  readonly password: string;
};

type RoleEntryProps = {
  readonly mode: RoleEntryMode;
  readonly onAdmin: (loginId: string, password: string) => boolean | Promise<boolean>;
  readonly onTeacher: (loginId: string, password: string) => boolean | Promise<boolean>;
  readonly onStudentCredentials: (input: StudentLoginInput) => boolean | Promise<boolean>;
};

function BackArrowIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="role-page-back-icon" fill="none" viewBox="0 0 20 20">
      <path d="M12.5 4.5 7 10l5.5 5.5" />
      <path d="M7.5 10H16" />
    </svg>
  );
}

export function RoleEntry(props: RoleEntryProps): ReactElement {
  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(props.mode === "entry" ? null : props.mode);
  const [studentParticipantCode, setStudentParticipantCode] = useState("");
  const [studentLoginId, setStudentLoginId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [adminLoginId, setAdminLoginId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [teacherLoginId, setTeacherLoginId] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [studentError, setStudentError] = useState("");
  const [teacherError, setTeacherError] = useState("");
  const [adminPending, setAdminPending] = useState(false);
  const [studentPending, setStudentPending] = useState(false);
  const [teacherPending, setTeacherPending] = useState(false);

  const submitStudentCredentials = async (): Promise<void> => {
    setStudentError("");
    setStudentPending(true);
    try {
      if (!(await props.onStudentCredentials({ loginId: studentLoginId, participantCode: studentParticipantCode, password: studentPassword }))) {
        setStudentError("참여코드, 학생 아이디 또는 비밀번호가 맞지 않습니다");
      }
    } finally {
      setStudentPending(false);
    }
  };

  const submitTeacher = async (): Promise<void> => {
    setTeacherError("");
    setTeacherPending(true);
    try {
      if (!(await props.onTeacher(teacherLoginId, teacherPassword))) setTeacherError("교사 아이디 또는 비밀번호가 맞지 않습니다");
    } finally {
      setTeacherPending(false);
    }
  };

  const submitAdmin = async (): Promise<void> => {
    setAdminError("");
    setAdminPending(true);
    try {
      if (!(await props.onAdmin(adminLoginId, adminPassword))) setAdminError("관리자 아이디 또는 비밀번호가 맞지 않습니다");
    } finally {
      setAdminPending(false);
    }
  };

  const resetRole = (): void => {
    setAdminError("");
    setStudentError("");
    setTeacherError("");
    setSelectedRole(null);
  };

  const title = selectedRole === null ? "계정을 선택하세요" : selectedRole === "student" ? "학생 로그인" : selectedRole === "teacher" ? "교사 로그인" : "관리자 로그인";
  const description =
    selectedRole === null
      ? "수업에서 받은 계정으로 로그인하면 배정된 활동을 이어서 진행할 수 있습니다."
      : selectedRole === "student"
        ? "수업에서 받은 참여코드와 학생 계정 정보를 입력하세요."
        : selectedRole === "teacher"
          ? "교사 계정으로 과제, 반, 학생 기록을 관리합니다."
          : "관리자 계정으로 교사 계정을 만들고 비밀번호를 확인하거나 수정합니다.";

  return (
    <main className="role-entry-page">
      <div className="role-entry-stack">
        {selectedRole !== null && props.mode === "entry" ? (
          <button className="role-page-back" type="button" onClick={resetRole}>
            <BackArrowIcon />
            <span>뒤로가기</span>
          </button>
        ) : null}
        <Surface className="role-entry">
          <p className="eyebrow">Reading Coach Lab</p>
          <h1>{title}</h1>
          <p>{description}</p>

          {selectedRole === null ? (
            <div className="role-choice-grid" aria-label="계정 종류 선택">
              <button aria-label="학생 계정" type="button" onClick={() => setSelectedRole("student")}>
                <strong>학생</strong>
                <span>배정된 글 읽기와 활동을 시작합니다.</span>
              </button>
              <button aria-label="교사 계정" type="button" onClick={() => setSelectedRole("teacher")}>
                <strong>교사</strong>
                <span>과제, 반, 학생 기록을 관리합니다.</span>
              </button>
              <button aria-label="관리자 계정" type="button" onClick={() => setSelectedRole("admin")}>
                <strong>관리자</strong>
                <span>교사 계정과 초기 설정을 관리합니다.</span>
              </button>
            </div>
          ) : null}

          {selectedRole === "student" ? (
            <section className="login-section" aria-label="학생 로그인">
              <header className="login-section-header">
                <h2>계정 정보</h2>
              </header>
              <Field label="참여코드">
                <TextInput autoComplete="one-time-code" value={studentParticipantCode} onChange={(event) => setStudentParticipantCode(event.currentTarget.value)} />
              </Field>
              <div className="account-field-grid login-credential-grid">
                <Field label="학생 아이디">
                  <TextInput autoComplete="username" value={studentLoginId} onChange={(event) => setStudentLoginId(event.currentTarget.value)} />
                </Field>
                <Field label="학생 비밀번호">
                  <TextInput autoComplete="current-password" type="password" value={studentPassword} onChange={(event) => setStudentPassword(event.currentTarget.value)} />
                </Field>
              </div>
              {studentError.length > 0 ? <p className="error-text">{studentError}</p> : null}
              <Button disabled={studentPending} variant="primary" onClick={() => { void submitStudentCredentials(); }}>{studentPending ? "확인 중" : "학생으로 시작"}</Button>
            </section>
          ) : null}

          {selectedRole === "teacher" ? (
            <section className="login-section" aria-label="교사 로그인">
              <header className="login-section-header">
                <h2>계정 정보</h2>
              </header>
              <Field label="교사 아이디">
                <TextInput autoComplete="username" value={teacherLoginId} onChange={(event) => setTeacherLoginId(event.currentTarget.value)} />
              </Field>
              <Field label="교사 비밀번호">
                <TextInput autoComplete="current-password" type="password" value={teacherPassword} onChange={(event) => setTeacherPassword(event.currentTarget.value)} />
              </Field>
              {teacherError.length > 0 ? <p className="error-text">{teacherError}</p> : null}
              <Button disabled={teacherPending} variant="primary" onClick={() => { void submitTeacher(); }}>{teacherPending ? "확인 중" : "교사로 시작"}</Button>
            </section>
          ) : null}

          {selectedRole === "admin" ? (
            <section className="login-section" aria-label="관리자 로그인">
              <header className="login-section-header">
                <h2>계정 정보</h2>
              </header>
              <Field label="관리자 아이디">
                <TextInput autoComplete="username" value={adminLoginId} onChange={(event) => setAdminLoginId(event.currentTarget.value)} />
              </Field>
              <Field label="관리자 비밀번호">
                <TextInput autoComplete="current-password" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.currentTarget.value)} />
              </Field>
              {adminError.length > 0 ? <p className="error-text">{adminError}</p> : null}
              <Button disabled={adminPending} variant="primary" onClick={() => { void submitAdmin(); }}>{adminPending ? "확인 중" : "관리자로 시작"}</Button>
            </section>
          ) : null}
        </Surface>
      </div>
    </main>
  );
}
