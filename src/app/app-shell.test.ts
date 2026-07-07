import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { loadBrowserSessionIdentity, loadBrowserTeacherAuth, saveBrowserActorIdentity, saveBrowserAdminAuth, saveBrowserSessionIdentity, saveBrowserSessionToken, saveBrowserTeacherAuth } from "../session/browser-session.js";
import { createSession, enterStage } from "../session/session.js";
import { sampleAssignment, sampleClassGroups, sampleStudents, sampleTeacher } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
type LoginFormName = "관리자 로그인" | "교사 로그인" | "학생 로그인";

const loginControls = (name: LoginFormName): { readonly form: HTMLElement; readonly loginId: HTMLElement; readonly password: HTMLElement; readonly submit: HTMLElement } => {
  const form = screen.getByRole("form", { name });
  return {
    form,
    loginId: within(form).getByLabelText("아이디"),
    password: within(form).getByLabelText("비밀번호"),
    submit: within(form).getByRole("button", { name: "로그인" })
  };
};

describe("App shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Khan-style shell when the app starts", () => {
    render(createElement(App));

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getAllByText("Reading Coach Lab").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "계정을 선택하세요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "학생 계정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "교사 계정" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "관리자 계정" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "관리자" })).toBeInTheDocument();
    expect(screen.queryByLabelText("참여자 코드")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "학생 계정" }));
    expect(screen.getByRole("heading", { name: "학생 로그인" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "계정을 선택하세요" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("참여자 코드")).toBeInTheDocument();
    expect(loginControls("학생 로그인").loginId).toBeInTheDocument();
    expect(loginControls("학생 로그인").password).toBeInTheDocument();
    expect(screen.queryByLabelText("교사 아이디")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "역할 다시 선택" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "뒤로가기" }));
    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    expect(screen.getByRole("heading", { name: "교사 로그인" })).toBeInTheDocument();
    expect(loginControls("교사 로그인").loginId).toBeInTheDocument();
    expect(loginControls("교사 로그인").password).toBeInTheDocument();
    expect(loginControls("교사 로그인").submit).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "관리자" }));
    expect(screen.getByRole("heading", { name: "관리자 로그인" })).toBeInTheDocument();
    expect(loginControls("관리자 로그인").submit).toBeInTheDocument();
  });

  it("restores the teacher account on refresh without returning to role selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      assignments: [],
      classes: [],
      students: []
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/review");
    saveBrowserActorIdentity({ accountId: sampleTeacher.id, role: "teacher" });
    saveBrowserTeacherAuth({ teacherId: sampleTeacher.id, teacherToken: "teacher-token-test" });

    render(createElement(App));

    await waitFor(() => expect(screen.getByRole("heading", { name: "학생 현황" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "교사 로그인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "계정을 선택하세요" })).not.toBeInTheDocument();
  });

  it("does not show the seeded plastic assignment while the database roster is still loading", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    saveBrowserActorIdentity({ accountId: sampleTeacher.id, role: "teacher" });
    saveBrowserTeacherAuth({ teacherId: sampleTeacher.id, teacherToken: "teacher-token-test" });

    render(createElement(App));

    expect(screen.getByText("과제를 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByText("플라스틱 사용을 줄여야 할까?")).not.toBeInTheDocument();
  });

  it("keeps the teacher account active when opening and leaving the student preview", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const previewSession = createSession(sampleAssignment, sampleStudent);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/teacher")) {
        return new Response(JSON.stringify({
          displayName: sampleTeacher.displayName,
          teacherId: sampleTeacher.id,
          teacherToken: "teacher-token-test"
        }), { status: 200 });
      }
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [{ payload: sampleAssignment }],
          classes: sampleClassGroups,
          students: sampleStudents.map((student) => ({
            classGroupId: student.classGroupId,
            displayLabel: student.displayName,
            id: student.id,
            loginId: student.loginId,
            participantCode: student.participantCode,
            password: student.password,
            studentAnonymousId: student.id,
            studentNumber: student.studentNumber
          })),
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      if (url.endsWith("/api/session/start")) {
        return new Response(JSON.stringify({
          assignmentId: sampleAssignment.id,
          classGroupId: sampleStudent.classGroupId,
          session: previewSession,
          sessionId: previewSession.sessionId,
          sessionToken: "preview-token-test",
          studentAnonymousId: previewSession.student.anonymousId
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    fireEvent.change(loginControls("교사 로그인").loginId, { target: { value: sampleTeacher.loginId } });
    fireEvent.change(loginControls("교사 로그인").password, { target: { value: sampleTeacher.password } });
    fireEvent.submit(loginControls("교사 로그인").form);

    await waitFor(() => expect(screen.getByRole("button", { name: "학생 화면 보기" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "학생 화면 보기" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "과제 보기" })).toBeInTheDocument());
    expect(screen.getByText(sampleTeacher.displayName)).toBeInTheDocument();
    expect(screen.queryByText(sampleStudent.displayName)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("reading-coach-lab:browser-session:v1")).toBeNull();
    expect(window.sessionStorage.getItem("reading-coach-lab:browser-actor:v1")).toContain("\"role\":\"teacher\"");

    fireEvent.click(screen.getByRole("button", { name: "홈" }));

    await waitFor(() => expect(screen.getByText(sampleAssignment.title)).toBeInTheDocument());
    expect(screen.getByText(sampleTeacher.displayName)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "과제 시작" })).not.toBeInTheDocument();
  });

  it("opens an existing student session instead of resetting teacher preview to the first stage", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const canonicalAnonymousId = "anon-restored-from-db-001";
    const rosterStudent = { ...sampleStudent, anonymousId: canonicalAnonymousId };
    const progressedSession = enterStage({
      ...createSession(sampleAssignment),
      student: { anonymousId: canonicalAnonymousId }
    }, "writing");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/teacher")) {
        return new Response(JSON.stringify({
          displayName: sampleTeacher.displayName,
          teacherId: sampleTeacher.id,
          teacherToken: "teacher-token-test"
        }), { status: 200 });
      }
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [{ payload: sampleAssignment }],
          classes: sampleClassGroups,
          students: [rosterStudent, ...sampleStudents.slice(1)].map((student) => ({
            classGroupId: student.classGroupId,
            displayLabel: student.displayName,
            id: student.id,
            loginId: student.loginId,
            participantCode: student.participantCode,
            password: student.password,
            studentAnonymousId: student.anonymousId ?? student.id,
            studentNumber: student.studentNumber
          })),
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [progressedSession] }), { status: 200 });
      }
      if (url.endsWith("/api/session/start")) {
        return new Response(JSON.stringify({ error: "teacher preview must reuse the existing student session" }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    fireEvent.change(loginControls("교사 로그인").loginId, { target: { value: sampleTeacher.loginId } });
    fireEvent.change(loginControls("교사 로그인").password, { target: { value: sampleTeacher.password } });
    fireEvent.click(loginControls("교사 로그인").submit);

    await waitFor(() => expect(screen.getByRole("button", { name: "학생 화면 보기" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "학생 화면 보기" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "초안 쓰기" })).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/session/start"), expect.anything());
    expect(window.localStorage.getItem("reading-coach-lab:browser-session:v1")).toBeNull();
    expect(window.sessionStorage.getItem("reading-coach-lab:browser-actor:v1")).toContain("\"role\":\"teacher\"");
  });

  it("previews the latest progressed student session even when the first assigned student has not started", async () => {
    const firstStudent = sampleStudents[0];
    const progressedStudent = sampleStudents[1];
    if (firstStudent === undefined || progressedStudent === undefined) throw new Error("Missing sample student fixture.");
    const progressedAnonymousId = "anon-progressed-second-student";
    const rosterStudents = [firstStudent, { ...progressedStudent, anonymousId: progressedAnonymousId }];
    const progressedSession = enterStage({
      ...createSession(sampleAssignment),
      student: { anonymousId: progressedAnonymousId }
    }, "writing");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/teacher")) {
        return new Response(JSON.stringify({
          displayName: sampleTeacher.displayName,
          teacherId: sampleTeacher.id,
          teacherToken: "teacher-token-test"
        }), { status: 200 });
      }
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [{ payload: sampleAssignment }],
          classes: sampleClassGroups,
          students: rosterStudents.map((student) => ({
            classGroupId: student.classGroupId,
            displayLabel: student.displayName,
            id: student.id,
            loginId: student.loginId,
            participantCode: student.participantCode,
            password: student.password,
            studentAnonymousId: student.anonymousId ?? student.id,
            studentNumber: student.studentNumber
          })),
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [progressedSession] }), { status: 200 });
      }
      if (url.endsWith("/api/session/start")) {
        return new Response(JSON.stringify({ error: "teacher preview must not start the first assigned student" }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    fireEvent.change(loginControls("교사 로그인").loginId, { target: { value: sampleTeacher.loginId } });
    fireEvent.change(loginControls("교사 로그인").password, { target: { value: sampleTeacher.password } });
    fireEvent.click(loginControls("교사 로그인").submit);

    await waitFor(() => expect(screen.getByRole("button", { name: "학생 화면 보기" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "학생 화면 보기" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "초안 쓰기" })).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/session/start"), expect.anything());
    expect(window.sessionStorage.getItem("reading-coach-lab:browser-actor:v1")).toContain("\"role\":\"teacher\"");
  });

  it("keeps local teacher preview stage changes when the session poll returns stale data", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const guidedAssignment = {
      ...sampleAssignment,
      id: "assignment-guided-preview",
      researchMode: ResearchModes.guidedWriting,
      title: "IT 글쓰기"
    };
    const staleSession = createSession(guidedAssignment, sampleStudent);
    const staleSessionList = {
      resolve: undefined as undefined | ((response: Response) => void)
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/teacher")) {
        return new Response(JSON.stringify({
          displayName: sampleTeacher.displayName,
          teacherId: sampleTeacher.id,
          teacherToken: "teacher-token-test"
        }), { status: 200 });
      }
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [{ payload: guidedAssignment }],
          classes: sampleClassGroups,
          students: sampleStudents.map((student) => ({
            classGroupId: student.classGroupId,
            displayLabel: student.displayName,
            id: student.id,
            loginId: student.loginId,
            participantCode: student.participantCode,
            password: student.password,
            studentAnonymousId: student.id,
            studentNumber: student.studentNumber
          })),
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Promise<Response>((resolve) => {
          staleSessionList.resolve = resolve;
        });
      }
      if (url.endsWith("/api/session/start")) {
        return new Response(JSON.stringify({
          assignmentId: guidedAssignment.id,
          classGroupId: sampleStudent.classGroupId,
          session: staleSession,
          sessionId: staleSession.sessionId,
          sessionToken: "preview-token-test",
          studentAnonymousId: staleSession.student.anonymousId
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    fireEvent.change(loginControls("교사 로그인").loginId, { target: { value: sampleTeacher.loginId } });
    fireEvent.change(loginControls("교사 로그인").password, { target: { value: sampleTeacher.password } });
    fireEvent.click(loginControls("교사 로그인").submit);

    await waitFor(() => expect(screen.getByRole("button", { name: "학생 화면 보기" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "학생 화면 보기" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "소재 정하기" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("소재"), { target: { value: "해저케이블" } });
    fireEvent.click(screen.getByRole("button", { name: "다음 단계" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "주제 정하기" })).toBeInTheDocument());
    staleSessionList.resolve?.(new Response(JSON.stringify({ sessions: [staleSession] }), { status: 200 }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "주제 정하기" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "소재 정하기" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("reading-coach-lab:browser-actor:v1")).toContain("\"role\":\"teacher\"");
  });

  it("does not restore a stale student session while a teacher is active on the student route", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [{ payload: sampleAssignment }],
          classes: sampleClassGroups,
          students: sampleStudents.map((student) => ({
            classGroupId: student.classGroupId,
            displayLabel: student.displayName,
            id: student.id,
            loginId: student.loginId,
            participantCode: student.participantCode,
            password: student.password,
            studentAnonymousId: student.id,
            studentNumber: student.studentNumber
          })),
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      if (url.endsWith("/api/session/resume")) {
        return new Response(JSON.stringify({ error: "stale session must not resume for teacher" }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/student");
    saveBrowserActorIdentity({ accountId: sampleTeacher.id, role: "teacher" });
    saveBrowserTeacherAuth({ teacherId: sampleTeacher.id, teacherToken: "teacher-token-test" });
    saveBrowserSessionIdentity({
      assignmentId: sampleAssignment.id,
      classGroupId: sampleClassGroups[0]?.id ?? "class-pilot",
      sessionId: "stale-student-session",
      studentAnonymousId: sampleStudents[0]?.id ?? "student-s001"
    });

    render(createElement(App));

    await waitFor(() => expect(screen.getByText(sampleAssignment.title)).toBeInTheDocument());
    expect(screen.getByText(sampleTeacher.displayName)).toBeInTheDocument();
    expect(screen.queryByText(sampleStudents[0]?.displayName ?? "")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/session/resume"), expect.anything());
  });

  it("clears stale student browser session data when a teacher logs in", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/teacher")) {
        return new Response(JSON.stringify({
          displayName: sampleTeacher.displayName,
          teacherId: sampleTeacher.id,
          teacherToken: "teacher-token-test"
        }), { status: 200 });
      }
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [],
          classes: [],
          students: [],
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    saveBrowserSessionIdentity({
      assignmentId: sampleAssignment.id,
      classGroupId: sampleClassGroups[0]?.id ?? "class-pilot",
      sessionId: "stale-student-session",
      studentAnonymousId: sampleStudents[0]?.id ?? "student-s001"
    });
    saveBrowserSessionToken("stale-student-token");

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    fireEvent.change(loginControls("교사 로그인").loginId, { target: { value: sampleTeacher.loginId } });
    fireEvent.change(loginControls("교사 로그인").password, { target: { value: sampleTeacher.password } });
    fireEvent.click(loginControls("교사 로그인").submit);

    await waitFor(() => expect(screen.getByRole("heading", { name: "과제 둘러보기" })).toBeInTheDocument());
    expect(loadBrowserSessionIdentity()).toBeNull();
    expect(window.sessionStorage.getItem("reading-coach-lab:browser-session-token:v1")).toBeNull();
    expect(loadBrowserTeacherAuth()).toEqual({ teacherId: sampleTeacher.id, teacherToken: "teacher-token-test" });
  });

  it("clears stale teacher auth when a student account is authenticated", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/student")) {
        return new Response(JSON.stringify({
          assignments: [sampleAssignment],
          student: {
            classGroupId: sampleStudent.classGroupId,
            displayName: sampleStudent.displayName,
            id: sampleStudent.id,
            loginId: sampleStudent.loginId,
            participantCode: sampleStudent.participantCode,
            studentNumber: sampleStudent.studentNumber
          }
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    saveBrowserTeacherAuth({ teacherId: sampleTeacher.id, teacherToken: "stale-teacher-token" });

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "학생 계정" }));
    fireEvent.change(screen.getByLabelText("참여자 코드"), { target: { value: sampleStudent.participantCode } });
    fireEvent.click(loginControls("학생 로그인").submit);

    await waitFor(() => expect(screen.getByRole("heading", { name: "배정된 과제" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "과제 시작" })).toBeInTheDocument();
    expect(loadBrowserTeacherAuth()).toBeNull();
    expect(window.sessionStorage.getItem("reading-coach-lab:browser-actor:v1")).toContain("\"role\":\"student\"");
  });

  it("starts the assignment selected by the student instead of the first assigned task", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const firstAssignment = { ...sampleAssignment, id: "assignment-first", title: "첫 번째 과제" };
    const secondAssignment = { ...sampleAssignment, id: "assignment-second", title: "두 번째 과제" };
    let postedStartBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/student")) {
        return new Response(JSON.stringify({
          assignments: [firstAssignment, secondAssignment],
          student: {
            classGroupId: sampleStudent.classGroupId,
            displayName: sampleStudent.displayName,
            id: sampleStudent.id,
            loginId: sampleStudent.loginId,
            participantCode: sampleStudent.participantCode,
            studentNumber: sampleStudent.studentNumber
          }
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/start")) {
        if (typeof init?.body !== "string") throw new Error("Session start body must be a string.");
        const parsed: unknown = JSON.parse(init.body);
        if (!isRecord(parsed)) throw new Error("Session start body must be an object.");
        postedStartBody = parsed;
        const selectedAssignment = parsed["assignmentId"] === secondAssignment.id ? secondAssignment : firstAssignment;
        const startedSession = createSession(selectedAssignment, sampleStudent);
        return new Response(JSON.stringify({
          assignmentId: selectedAssignment.id,
          classGroupId: sampleStudent.classGroupId,
          session: startedSession,
          sessionId: startedSession.sessionId,
          sessionToken: "student-session-token",
          studentAnonymousId: startedSession.student.anonymousId
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "학생 계정" }));
    fireEvent.change(loginControls("학생 로그인").loginId, { target: { value: sampleStudent.loginId } });
    fireEvent.change(loginControls("학생 로그인").password, { target: { value: sampleStudent.password } });
    fireEvent.click(loginControls("학생 로그인").submit);

    await waitFor(() => expect(screen.getByRole("heading", { name: "배정된 과제" })).toBeInTheDocument());
    const secondTask = screen.getByRole("article", { name: `${secondAssignment.title} 과제` });
    fireEvent.click(within(secondTask).getByRole("button", { name: "과제 시작" }));

    await waitFor(() => expect(postedStartBody?.["assignmentId"]).toBe(secondAssignment.id));
    expect(loadBrowserSessionIdentity()?.assignmentId).toBe(secondAssignment.id);
  });

  it("shows a visible error when an assigned student task cannot start", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/student")) {
        return new Response(JSON.stringify({
          assignments: [sampleAssignment],
          student: {
            classGroupId: sampleStudent.classGroupId,
            displayName: sampleStudent.displayName,
            id: sampleStudent.id,
            loginId: sampleStudent.loginId,
            participantCode: sampleStudent.participantCode,
            studentNumber: sampleStudent.studentNumber
          }
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/start")) {
        return new Response(JSON.stringify({ error: "start failed" }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "학생 계정" }));
    fireEvent.change(loginControls("학생 로그인").loginId, { target: { value: sampleStudent.loginId } });
    fireEvent.change(loginControls("학생 로그인").password, { target: { value: sampleStudent.password } });
    fireEvent.click(loginControls("학생 로그인").submit);

    await waitFor(() => expect(screen.getByRole("heading", { name: "배정된 과제" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "과제 시작" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("과제를 시작하지 못했습니다"));
    expect(screen.queryByRole("heading", { name: "시작 전 확인" })).not.toBeInTheDocument();
  });

  it("lets a teacher change their own password from the top account menu", async () => {
    const upsertBodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/teacher")) {
        return new Response(JSON.stringify({
          displayName: sampleTeacher.displayName,
          teacherId: sampleTeacher.id,
          teacherToken: "teacher-token-test"
        }), { status: 200 });
      }
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [],
          classes: [],
          rosterRevision: "revision-1",
          students: [],
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/upsert-roster")) {
        if (typeof init?.body !== "string") throw new Error("Roster upsert body must be a string.");
        const parsed: unknown = JSON.parse(init.body);
        if (!isRecord(parsed)) throw new Error("Roster upsert body must be an object.");
        upsertBodies.push(parsed);
        return new Response(JSON.stringify({ rosterRevision: "revision-2" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    fireEvent.change(loginControls("교사 로그인").loginId, { target: { value: sampleTeacher.loginId } });
    fireEvent.change(loginControls("교사 로그인").password, { target: { value: sampleTeacher.password } });
    fireEvent.click(loginControls("교사 로그인").submit);

    await waitFor(() => expect(screen.getByRole("heading", { name: "과제 둘러보기" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: sampleTeacher.displayName }));
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "changed-pw" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "changed-pw" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));

    await waitFor(() => expect(screen.getByText("비밀번호를 변경했습니다.")).toBeInTheDocument());
    expect(upsertBodies).toHaveLength(1);
    expect(JSON.stringify(upsertBodies[0])).toContain(`"id":"${sampleTeacher.id}"`);
    expect(JSON.stringify(upsertBodies[0])).toContain("\"password\":\"changed-pw\"");
  });

  it("shows the student assignment list instead of failing login when no assignment is assigned", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/student")) {
        return new Response(JSON.stringify({
          assignments: [],
          student: {
            classGroupId: sampleStudent.classGroupId,
            displayName: sampleStudent.displayName,
            id: sampleStudent.id,
            loginId: sampleStudent.loginId,
            participantCode: sampleStudent.participantCode,
            studentNumber: sampleStudent.studentNumber
          }
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "학생 계정" }));
    fireEvent.change(loginControls("학생 로그인").loginId, { target: { value: sampleStudent.loginId } });
    fireEvent.change(loginControls("학생 로그인").password, { target: { value: sampleStudent.password } });
    fireEvent.click(loginControls("학생 로그인").submit);

    await waitFor(() => expect(screen.getByRole("heading", { name: "배정된 과제" })).toBeInTheDocument());
    expect(screen.getByText("아직 배정된 과제가 없습니다. 교사에게 과제 배정을 확인해 주세요.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "학생 로그인" })).not.toBeInTheDocument();
  });

  it("persists assignment student selections through the roster save API", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const assignmentWithoutStudents = { ...sampleAssignment, assignedStudentIds: [] };
    const upsertBodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/teacher")) {
        return new Response(JSON.stringify({
          displayName: sampleTeacher.displayName,
          teacherId: sampleTeacher.id,
          teacherToken: "teacher-token-test"
        }), { status: 200 });
      }
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [{
            classGroupId: assignmentWithoutStudents.classGroupId,
            createdByTeacherId: assignmentWithoutStudents.createdByTeacherId,
            id: assignmentWithoutStudents.id,
            payload: assignmentWithoutStudents,
            researchCondition: assignmentWithoutStudents.researchCondition,
            researchMode: assignmentWithoutStudents.researchMode,
            title: assignmentWithoutStudents.title
          }],
          classes: sampleClassGroups,
          rosterRevision: "revision-1",
          students: sampleStudents.map((student) => ({
            classGroupId: student.classGroupId,
            displayLabel: student.displayName,
            id: student.id,
            loginId: student.loginId,
            participantCode: student.participantCode,
            password: student.password,
            studentAnonymousId: student.id,
            studentNumber: student.studentNumber
          })),
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/upsert-roster")) {
        if (typeof init?.body !== "string") throw new Error("Roster upsert body must be a string.");
        const parsed: unknown = JSON.parse(init.body);
        if (!isRecord(parsed)) throw new Error("Roster upsert body must be an object.");
        upsertBodies.push(parsed);
        return new Response(JSON.stringify({ rosterRevision: "revision-2" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(App));

    fireEvent.click(screen.getByRole("button", { name: "교사 계정" }));
    fireEvent.change(loginControls("교사 로그인").loginId, { target: { value: sampleTeacher.loginId } });
    fireEvent.change(loginControls("교사 로그인").password, { target: { value: sampleTeacher.password } });
    fireEvent.click(loginControls("교사 로그인").submit);

    await waitFor(() => expect(screen.getByText(assignmentWithoutStudents.title)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "배정" }));
    fireEvent.click(screen.getByLabelText(`${sampleStudent.studentNumber}번 ${sampleStudent.displayName}`));
    fireEvent.click(screen.getByRole("button", { name: "배정 저장" }));

    await waitFor(() => expect(upsertBodies).toHaveLength(1));
    const assignments = upsertBodies[0]?.["assignments"];
    if (!Array.isArray(assignments) || !isRecord(assignments[0])) throw new Error("Roster assignments payload is invalid.");
    const payload = assignments[0]["payload"];
    if (!isRecord(payload)) throw new Error("Roster assignment payload is invalid.");
    expect(payload["assignedStudentIds"]).toEqual([sampleStudent.id]);
    expect(assignments[0]["classGroupId"]).toBe(sampleStudent.classGroupId);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "과제 배정" })).not.toBeInTheDocument());
  });

  it("waits for a roster save before accepting the next account edit", async () => {
    const sampleStudent = sampleStudents[0];
    if (sampleStudent === undefined) throw new Error("Missing sample student fixture.");
    const upsertBodies: Record<string, unknown>[] = [];
    const firstUpsert = {
      resolve: undefined as undefined | ((response: Response) => void)
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [],
          classes: sampleClassGroups,
          rosterRevision: "revision-1",
          students: [{
            classGroupId: sampleStudent.classGroupId,
            displayLabel: sampleStudent.displayName,
            id: sampleStudent.id,
            loginId: sampleStudent.loginId,
            participantCode: sampleStudent.participantCode,
            password: sampleStudent.password,
            studentAnonymousId: sampleStudent.id,
            studentNumber: sampleStudent.studentNumber
          }],
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/upsert-roster")) {
        if (typeof init?.body !== "string") throw new Error("Roster upsert body must be a string.");
        const parsed: unknown = JSON.parse(init.body);
        if (!isRecord(parsed)) throw new Error("Roster upsert body must be an object.");
        upsertBodies.push(parsed);
        if (upsertBodies.length === 1) {
          return new Promise<Response>((resolve) => {
            firstUpsert.resolve = resolve;
          });
        }
        return new Response(JSON.stringify({ rosterRevision: "revision-3" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/accounts");
    saveBrowserActorIdentity({ accountId: sampleTeacher.id, role: "teacher" });
    saveBrowserTeacherAuth({ teacherId: sampleTeacher.id, teacherToken: "teacher-token-test" });

    render(createElement(App));

    await waitFor(() => expect(screen.getByRole("heading", { name: "계정 관리" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: `학생 삭제: ${sampleStudent.displayName}` }));
    await waitFor(() => expect(upsertBodies).toHaveLength(1));
    expect(upsertBodies[0]?.["expectedRosterRevision"]).toBe("revision-1");

    fireEvent.change(screen.getByLabelText("학생 번호"), { target: { value: "99" } });
    fireEvent.change(screen.getByLabelText("참여자 코드"), { target: { value: "S099" } });
    fireEvent.change(screen.getByLabelText("학생 아이디"), { target: { value: "s099" } });
    fireEvent.change(screen.getByLabelText("학생 비밀번호"), { target: { value: "test" } });
    fireEvent.change(screen.getByLabelText("학생 이름"), { target: { value: "새 학생" } });
    fireEvent.click(screen.getByRole("button", { name: "학생 만들기" }));
    await Promise.resolve();
    expect(upsertBodies).toHaveLength(1);

    const resolveFirstUpsert = firstUpsert.resolve;
    if (resolveFirstUpsert === undefined) throw new Error("First roster upsert was not captured.");
    resolveFirstUpsert(new Response(JSON.stringify({ rosterRevision: "revision-2" }), { status: 200 }));
    await waitFor(() => expect(screen.getByText("학생 계정을 삭제했습니다.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "학생 만들기" }));
    await waitFor(() => expect(upsertBodies).toHaveLength(2));
    expect(upsertBodies[1]?.["expectedRosterRevision"]).toBe("revision-2");
  });

  it("keeps a newly created teacher account in the saved roster from the admin screen", async () => {
    const upsertBodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [],
          classes: [],
          rosterRevision: "revision-1",
          students: [],
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/upsert-roster")) {
        if (typeof init?.body !== "string") throw new Error("Roster upsert body must be a string.");
        const parsed: unknown = JSON.parse(init.body);
        if (!isRecord(parsed)) throw new Error("Roster upsert body must be an object.");
        upsertBodies.push(parsed);
        return new Response(JSON.stringify({ rosterRevision: "revision-2" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/admin");
    saveBrowserActorIdentity({ accountId: "admin-root", role: "admin" });
    saveBrowserAdminAuth({ adminId: "admin-root", adminToken: "admin-token-test" });

    render(createElement(App));

    await waitFor(() => expect(screen.getByRole("heading", { name: "계정 관리" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("교사 이름"), { target: { value: "보조 교사" } });
    fireEvent.change(screen.getByLabelText("교사 아이디 만들기"), { target: { value: "helper" } });
    fireEvent.change(screen.getByLabelText("교사 비밀번호 만들기"), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: "교사 만들기" }));

    await waitFor(() => expect(upsertBodies).toHaveLength(1));
    expect(screen.getAllByText("보조 교사").length).toBeGreaterThan(0);
    const teachers = upsertBodies[0]?.["teachers"];
    expect(teachers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        displayName: "보조 교사",
        id: "teacher-helper",
        loginId: "helper",
        password: "test"
      })
    ]));
  });

  it("saves sequential student deletions with the latest roster revision", async () => {
    const firstStudent = sampleStudents[0];
    const secondStudent = sampleStudents[1];
    if (firstStudent === undefined || secondStudent === undefined) throw new Error("Missing sample student fixture.");
    const upsertBodies: Record<string, unknown>[] = [];
    const firstUpsert = {
      resolve: undefined as undefined | ((response: Response) => void)
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/admin/roster")) {
        return new Response(JSON.stringify({
          assignments: [],
          classes: sampleClassGroups,
          rosterRevision: "revision-1",
          students: [firstStudent, secondStudent].map((student) => ({
            classGroupId: student.classGroupId,
            displayLabel: student.displayName,
            id: student.id,
            loginId: student.loginId,
            participantCode: student.participantCode,
            password: student.password,
            studentAnonymousId: student.id,
            studentNumber: student.studentNumber
          })),
          teachers: [sampleTeacher]
        }), { status: 200 });
      }
      if (url.endsWith("/api/session/list")) {
        return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
      }
      if (url.endsWith("/api/admin/upsert-roster")) {
        if (typeof init?.body !== "string") throw new Error("Roster upsert body must be a string.");
        const parsed: unknown = JSON.parse(init.body);
        if (!isRecord(parsed)) throw new Error("Roster upsert body must be an object.");
        upsertBodies.push(parsed);
        if (upsertBodies.length === 1) {
          return new Promise<Response>((resolve) => {
            firstUpsert.resolve = resolve;
          });
        }
        return new Response(JSON.stringify({ rosterRevision: "revision-3" }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/accounts");
    saveBrowserActorIdentity({ accountId: sampleTeacher.id, role: "teacher" });
    saveBrowserTeacherAuth({ teacherId: sampleTeacher.id, teacherToken: "teacher-token-test" });

    render(createElement(App));

    await waitFor(() => expect(screen.getByRole("heading", { name: "계정 관리" })).toBeInTheDocument());
    const firstDeleteButton = screen.getByRole("button", { name: `학생 삭제: ${firstStudent.displayName}` });
    const secondDeleteButton = screen.getByRole("button", { name: `학생 삭제: ${secondStudent.displayName}` });
    fireEvent.click(firstDeleteButton);
    fireEvent.click(secondDeleteButton);
    await waitFor(() => expect(upsertBodies).toHaveLength(1));

    const resolveFirstUpsert = firstUpsert.resolve;
    if (resolveFirstUpsert === undefined) throw new Error("First roster upsert was not captured.");
    resolveFirstUpsert(new Response(JSON.stringify({ rosterRevision: "revision-2" }), { status: 200 }));
    await waitFor(() => expect(screen.getByText("학생 계정을 삭제했습니다.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: `학생 삭제: ${secondStudent.displayName}` }));
    await waitFor(() => expect(upsertBodies).toHaveLength(2));
    expect(upsertBodies[1]?.["expectedRosterRevision"]).toBe("revision-2");
    expect(upsertBodies[1]?.["deletedStudentIds"]).toEqual([secondStudent.id]);
    expect(upsertBodies[1]?.["students"]).toEqual([]);
  });

  it("does not restore a stale student session from the student route without a student actor", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/student");
    saveBrowserSessionIdentity({
      assignmentId: sampleAssignment.id,
      classGroupId: sampleClassGroups[0]?.id ?? "class-pilot",
      sessionId: "stale-student-session",
      studentAnonymousId: sampleStudents[0]?.id ?? "student-s001"
    });

    render(createElement(App));

    await waitFor(() => expect(screen.getByRole("heading", { name: "계정을 선택하세요" })).toBeInTheDocument());
    expect(fetchMock.mock.calls.some((call) => {
      const input = call[0];
      if (input instanceof Request) return input.url.endsWith("/api/session/resume");
      if (input instanceof URL) return input.href.endsWith("/api/session/resume");
      return typeof input === "string" && input.endsWith("/api/session/resume");
    })).toBe(false);
  });
});
