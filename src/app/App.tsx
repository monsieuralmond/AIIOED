import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { unavailableFileSync } from "../session/file-sync.js";
import { activeSession, assignmentsForStudent, createClassGroup, createSession, createStudentAccount, createTeacherAccount, deleteAssignment, deleteClassGroup, deleteStudentAccount, deleteTeacherAccount, PilotStateError, requireAssignment, saveAssignmentInState, selectActor, startStudentSession, studentByCredentials, studentByParticipantCode, teacherByCredentials, updatePilotSession, updateTeacherReview } from "../session/session.js";
import type { CreateClassGroupInput, CreateStudentInput, CreateTeacherInput } from "../session/session.js";
import { clearBrowserActorIdentity, clearBrowserAdminAuth, clearBrowserSessionIdentity, clearBrowserSessionToken, clearBrowserTeacherAuth, loadBrowserActorIdentity, loadBrowserSessionIdentity, saveBrowserActorIdentity, saveBrowserAdminAuth, saveBrowserSessionIdentity, saveBrowserSessionToken, saveBrowserTeacherAuth } from "../session/browser-session.js";
import { ResearchApiClientError, authenticateAdminWithDatabase, authenticateStudentWithDatabase, authenticateTeacherWithDatabase, currentRosterAuthHeaders, loadAdminSessionsFromDatabase, loadRosterFromDatabase, loadTeacherSessionsFromDatabase, resetTeacherStudentSession, resumeResearchSession, startResearchSessionWithParticipantCode, syncRosterDeltaToDatabase, syncSessionDelta } from "../session/research-api-client.js";
import type { RosterSyncDelta } from "../session/research-api-client.js";
import { ResearchConditions, ResearchModes } from "../shared/research.js";
import type { Assignment, FileSyncStatus, PilotSession, PilotState, SelectedActor, StudentAccount, TeacherReviewUpdate } from "../shared/types.js";
import { AccountManagement } from "./account-management.js";
import { currentPath, firstStudent, initialPilotState, initialRoute, routePath, stateForTeacherScope, stateWithBrowserActor, stateWithDatabaseRoster, stateWithServerSession } from "./app-bootstrap.js";
import type { Route } from "./app-bootstrap.js";
import { CreateAssignment } from "./create-assignment.js";
import { ExportView } from "./export-view.js";
import { GuidedWritingFlow } from "./guided-writing-flow.js";
import { TopBar } from "./layout.js";
import { ResearcherList } from "./researcher.js";
import { RoleEntry } from "./role-entry.js";
import { StudentAssignments } from "./student-assignments.js";
import { StudentWorkspace } from "./student-workspace.js";
import { TeacherReview } from "./teacher-review.js";
import { UnderstandingCalibrationFlow } from "./understanding-calibration-flow.js";
import { useLocalResearchStorage } from "./storage-mode.js";
import { Button, Field, TextInput } from "./ui.js";

const initialAppState = (): PilotState => {
  const base = initialPilotState();
  if (useLocalResearchStorage) return stateWithBrowserActor(base);
  return stateWithBrowserActor({
    ...base,
    activeAssignmentId: "",
    assignments: [],
    classGroups: [],
    selectedActor: null,
    sessions: [],
    students: [],
    teachers: []
  });
};

function TeacherAccountSettingsMenu(props: {
  readonly displayName: string;
  readonly onChangePassword: (password: string) => Promise<string | null>;
}): ReactElement {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (): Promise<void> => {
    const nextPassword = password.trim();
    setMessage("");
    if (nextPassword.length === 0) {
      setMessage("새 비밀번호를 입력하세요.");
      return;
    }
    if (nextPassword !== passwordConfirm.trim()) {
      setMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setPending(true);
    try {
      const error = await props.onChangePassword(nextPassword);
      if (error !== null) {
        setMessage(error);
        return;
      }
      setPassword("");
      setPasswordConfirm("");
      setMessage("비밀번호를 변경했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="account-settings-menu" role="menu" aria-label="계정 설정">
      <p className="account-settings-title">계정 설정</p>
      <p className="account-settings-name">{props.displayName}</p>
      <Field label="새 비밀번호">
        <TextInput autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
      </Field>
      <Field label="새 비밀번호 확인">
        <TextInput autoComplete="new-password" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.currentTarget.value)} />
      </Field>
      {message.length > 0 ? <p className="account-settings-message">{message}</p> : null}
      <Button disabled={pending} variant="primary" onClick={() => { void submit(); }}>{pending ? "저장 중" : "비밀번호 변경"}</Button>
    </div>
  );
}

export function App(): ReactElement {
  const [pilotState, setPilotState] = useState<PilotState>(initialAppState);
  const [route, setRoute] = useState(initialRoute);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [teacherPreviewAssignmentId, setTeacherPreviewAssignmentId] = useState<string | null>(null);
  const [teacherPreviewSession, setTeacherPreviewSession] = useState<PilotSession | null>(null);
  const [rosterReady, setRosterReady] = useState(false);
  const [, setRosterRevision] = useState<string | null>(null);
  const rosterRevisionRef = useRef<string | null>(null);
  const rosterSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const submissionSyncInFlightRef = useRef<string | null>(null);
  const pilotStateRef = useRef<PilotState>(pilotState);
  const fileSync: FileSyncStatus = unavailableFileSync();
  const actor = pilotState.selectedActor;
  const visibleTeacherState = actor?.role === "teacher" ? stateForTeacherScope(pilotState, actor.accountId) : pilotState;
  const activeAssignment = visibleTeacherState.assignments.find((assignment) => assignment.id === visibleTeacherState.activeAssignmentId) ?? visibleTeacherState.assignments[0] ?? null;
  const session = activeSession(pilotState);
  const teacherRoute = route === "create" || route === "review" || route === "accounts";
  const adminRoute = route === "admin" || route === "export";

  useEffect(() => {
    pilotStateRef.current = pilotState;
  }, [pilotState]);

  const openRoute = (next: Route): void => {
    if (next !== "create") setEditingAssignmentId(null);
    window.history.pushState({}, "", routePath(next));
    setRoute(next);
  };

  const reportRosterSyncError = (error: unknown): void => {
    if (error instanceof Error) {
      console.error(`Roster persistence failed: ${error.message}`);
      return;
    }
    console.error("Roster persistence failed.");
  };

  const reportSessionSyncError = (error: unknown): void => {
    if (error instanceof Error) {
      console.error(`Session persistence failed: ${error.message}`);
      return;
    }
    console.error("Session persistence failed.");
  };

  const persistenceErrorMessage = (error: unknown): string => {
    if (error instanceof ResearchApiClientError && error.status === 409) return "다른 화면에서 먼저 저장되었습니다. 새로고침 후 다시 시도하세요.";
    if (error instanceof Error) return `저장에 실패했습니다. ${error.message}`;
    return "저장에 실패했습니다. 다시 시도하세요.";
  };

  const updateRosterRevision = (nextRevision: string | null): void => {
    rosterRevisionRef.current = nextRevision;
    setRosterRevision(nextRevision);
  };

  const persistTeacherRosterDelta = (nextState: PilotState, delta: RosterSyncDelta): Promise<void> => {
    if (useLocalResearchStorage) return Promise.resolve();
    if ((actor?.role !== "teacher" && actor?.role !== "admin") || !rosterReady) return Promise.resolve();
    const authHeaders = currentRosterAuthHeaders();
    const syncRoster = async (): Promise<void> => {
      const result = await syncRosterDeltaToDatabase(nextState, delta, rosterRevisionRef.current, authHeaders);
      if (result.rosterRevision !== undefined) updateRosterRevision(result.rosterRevision);
    };
    const queuedSync = rosterSyncQueueRef.current.then(syncRoster, syncRoster);
    rosterSyncQueueRef.current = queuedSync.catch(reportRosterSyncError);
    return queuedSync;
  };

  useEffect(() => {
    const syncRouteFromHistory = (): void => setRoute(initialRoute());
    window.addEventListener("popstate", syncRouteFromHistory);
    return () => window.removeEventListener("popstate", syncRouteFromHistory);
  }, []);

  useEffect(() => {
    if (useLocalResearchStorage) {
      const actorIdentity = loadBrowserActorIdentity();
      if (actorIdentity?.role !== "student" || !currentPath().startsWith("/student")) return;
      setPilotState((state) => {
        const student = state.students.find((item) => item.id === actorIdentity.accountId);
        if (student === undefined) return selectActor(state, null);
        const assignment = assignmentsForStudent(state, student)[0];
        if (assignment === undefined) return selectActor(state, actorIdentity);
        return selectActor(startStudentSession(state, student.id, assignment.id).state, actorIdentity);
      });
      openRoute("student");
      return;
    }
    const identity = loadBrowserSessionIdentity();
    const actorIdentity = loadBrowserActorIdentity();
    const shouldResumeStudentSession = identity !== null && actorIdentity?.role === "student";
    if (!shouldResumeStudentSession || identity === null) return;
    let cancelled = false;
    resumeResearchSession(identity.sessionId)
      .then((result) => {
        if (cancelled) return;
        saveBrowserSessionIdentity({
          assignmentId: result.assignmentId,
          classGroupId: result.classGroupId,
          sessionId: result.sessionId,
          studentAnonymousId: result.studentAnonymousId
        });
        if (result.sessionToken !== undefined) saveBrowserSessionToken(result.sessionToken);
        const sessionWithAccount: PilotSession = actorIdentity?.role === "student"
          ? { ...result.session, student: { ...result.session.student, accountId: actorIdentity.accountId } }
          : result.session;
        setPilotState((state) => stateWithServerSession(state, sessionWithAccount));
        openRoute("student");
      })
      .catch(() => {
        clearBrowserSessionIdentity();
        clearBrowserSessionToken();
        clearBrowserActorIdentity();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (useLocalResearchStorage) {
      setRosterReady(true);
      return;
    }
    if (actor?.role !== "teacher" && actor?.role !== "admin") {
      setRosterReady(true);
      return;
    }
    let cancelled = false;
    setRosterReady(false);
    loadRosterFromDatabase(actor.role === "teacher" ? actor.accountId : undefined)
      .then((roster) => {
        if (cancelled) return;
        updateRosterRevision(roster.rosterRevision ?? null);
        setPilotState((state) => stateWithBrowserActor(stateWithDatabaseRoster(state, roster)));
      })
      .catch(reportRosterSyncError)
      .finally(() => {
        if (!cancelled) setRosterReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [actor?.accountId, actor?.role]);

  useEffect(() => {
    if (useLocalResearchStorage || !rosterReady || route === "student") return;
    if (actor?.role !== "teacher" && actor?.role !== "admin") return;
    if (actor.role === "admin" && route !== "export") return;
    let cancelled = false;
    const refreshSessions = (): void => {
      const loader = actor.role === "admin"
        ? loadAdminSessionsFromDatabase()
        : loadTeacherSessionsFromDatabase({ teacherId: actor.accountId });
      loader
        .then((result) => {
          if (cancelled) return;
          setPilotState((state) => {
            const incomingIds = new Set(result.sessions.map((item) => item.sessionId));
            return {
              ...state,
              sessions: [...state.sessions.filter((item) => !incomingIds.has(item.sessionId)), ...result.sessions]
            };
          });
        })
        .catch(reportSessionSyncError);
    };
    refreshSessions();
    const intervalId = window.setInterval(refreshSessions, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [actor?.accountId, actor?.role, rosterReady, route]);

  const saveAssignment = async (nextAssignment: Assignment): Promise<string | null> => {
    const previousState = pilotStateRef.current;
    const nextState = saveAssignmentInState(pilotStateRef.current, nextAssignment);
    pilotStateRef.current = nextState;
    setPilotState(nextState);
    try {
      const savedAssignment = requireAssignment(nextState, nextAssignment.id);
      await persistTeacherRosterDelta(nextState, { assignments: [savedAssignment] });
    } catch (error) {
      pilotStateRef.current = previousState;
      setPilotState(previousState);
      return persistenceErrorMessage(error);
    }
    setEditingAssignmentId(null);
    openRoute("list");
    return null;
  };

  const openNewAssignment = (): void => {
    setEditingAssignmentId(null);
    openRoute("create");
  };

  const openEditAssignment = (assignmentId: string): void => {
    setEditingAssignmentId(assignmentId);
    openRoute("create");
  };

  const sessionWithPreviewStudent = (previewSession: PilotSession, student: StudentAccount): PilotSession => ({
    ...previewSession,
    student: { ...previewSession.student, accountId: student.id, displayName: student.displayName }
  });

  const teacherPreviewStudent = (assignment: Assignment): StudentAccount => ({
    classGroupId: assignment.classGroupId ?? "teacher-preview-class",
    displayName: "학생",
    id: `teacher-preview-student-${assignment.id}`,
    loginId: "preview",
    participantCode: "PREVIEW",
    password: "",
    studentNumber: 1
  });

  const openStudent = async (assignmentId: string): Promise<void> => {
    const previewAssignment = visibleTeacherState.assignments.find((assignment) => assignment.id === assignmentId) ?? null;
    if (previewAssignment === null) return;
    setTeacherPreviewAssignmentId(previewAssignment.id);
    setTeacherPreviewSession(null);
    openRoute("student");
  };

  const chooseTeacher = async (loginId: string, password: string): Promise<boolean> => {
    if (!useLocalResearchStorage) {
      try {
        const auth = await authenticateTeacherWithDatabase({ loginId, password });
        const nextActor: SelectedActor = { role: "teacher", accountId: auth.teacherId };
        clearBrowserAdminAuth();
        clearBrowserSessionIdentity();
        clearBrowserSessionToken();
        saveBrowserTeacherAuth({ teacherId: auth.teacherId, teacherToken: auth.teacherToken });
        saveBrowserActorIdentity(nextActor);
        setPilotState((state) => {
          const teacherExists = state.teachers.some((teacher) => teacher.id === auth.teacherId);
          const teachers = teacherExists
            ? state.teachers.map((teacher) => (teacher.id === auth.teacherId ? { ...teacher, displayName: auth.displayName, loginId, password: "" } : teacher))
            : [...state.teachers, { displayName: auth.displayName, id: auth.teacherId, loginId, password: "" }];
          const teacherAccount = teachers.find((teacher) => teacher.id === auth.teacherId) ?? { displayName: auth.displayName, id: auth.teacherId, loginId, password: "" };
          return selectActor({
            ...state,
            activeAssignmentId: "",
            assignments: [],
            classGroups: [],
            sessions: [],
            students: [],
            teachers: [teacherAccount]
          }, nextActor);
        });
        openRoute(teacherRoute ? route : "list");
        return true;
      } catch (error) {
        if (error instanceof Error) console.error(`Teacher login failed: ${error.message}`);
        return false;
      }
    }
    const teacher = teacherByCredentials(pilotState, loginId, password);
    if (teacher === null) return false;
    const nextActor: SelectedActor = { role: "teacher", accountId: teacher.id };
    clearBrowserAdminAuth();
    clearBrowserSessionIdentity();
    clearBrowserSessionToken();
    saveBrowserActorIdentity(nextActor);
    setPilotState((state) => selectActor(state, nextActor));
    openRoute(teacherRoute ? route : "list");
    return true;
  };

  const chooseAdmin = async (loginId: string, password: string): Promise<boolean> => {
    if (useLocalResearchStorage) {
      if (loginId !== "admin" || password !== "test") return false;
      const nextActor: SelectedActor = { role: "admin", accountId: "admin-root" };
      clearBrowserTeacherAuth();
      clearBrowserSessionIdentity();
      clearBrowserSessionToken();
      saveBrowserActorIdentity(nextActor);
      setPilotState((state) => selectActor(state, nextActor));
      openRoute("admin");
      return true;
    }
    try {
      const auth = await authenticateAdminWithDatabase({ loginId, password });
      const nextActor: SelectedActor = { role: "admin", accountId: auth.adminId };
      clearBrowserTeacherAuth();
      clearBrowserSessionIdentity();
      clearBrowserSessionToken();
      saveBrowserAdminAuth({ adminId: auth.adminId, adminToken: auth.adminToken });
      saveBrowserActorIdentity(nextActor);
      setPilotState((state) => selectActor(state, nextActor));
      openRoute("admin");
      return true;
    } catch (error) {
      if (error instanceof Error) console.error(`Admin login failed: ${error.message}`);
      return false;
    }
  };

  const startServerSessionForStudent = async (student: StudentAccount): Promise<boolean> => {
    if (useLocalResearchStorage) {
      const nextActor: SelectedActor = { accountId: student.id, role: "student" };
      clearBrowserAdminAuth();
      clearBrowserTeacherAuth();
      clearBrowserSessionIdentity();
      clearBrowserSessionToken();
      saveBrowserActorIdentity(nextActor);
      setPilotState((state) => selectActor(state, nextActor));
      openRoute("list");
      return true;
    }
    try {
      const assignment = assignmentsForStudent(pilotState, student)[0];
      const result = await startResearchSessionWithParticipantCode({
        ...(assignment === undefined ? {} : { assignmentId: assignment.id }),
        loginId: student.loginId,
        participantCode: student.participantCode,
        password: student.password
      });
      clearBrowserAdminAuth();
      clearBrowserTeacherAuth();
      saveBrowserSessionIdentity({
        assignmentId: result.assignmentId,
        classGroupId: result.classGroupId,
        sessionId: result.sessionId,
        studentAnonymousId: result.studentAnonymousId
      });
      if (result.sessionToken !== undefined) saveBrowserSessionToken(result.sessionToken);
      const sessionWithAccount: PilotSession = {
        ...result.session,
        student: { ...result.session.student, accountId: student.id, displayName: student.displayName }
      };
      const nextActor: SelectedActor = { accountId: student.id, role: "student" };
      saveBrowserActorIdentity(nextActor);
      setPilotState((state) => selectActor(stateWithServerSession(state, sessionWithAccount), nextActor));
      openRoute("student");
      return true;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Student session start failed: ${error.message}`);
      } else {
        console.error("Student session start failed.");
      }
      return false;
    }
  };

  const chooseStudentCredentials = async (input: { readonly loginId: string; readonly participantCode: string; readonly password: string }): Promise<boolean> => {
    if (!useLocalResearchStorage) {
      try {
        const result = await authenticateStudentWithDatabase(input);
        const nextActor: SelectedActor = { accountId: result.student.id, role: "student" };
        clearBrowserAdminAuth();
        clearBrowserTeacherAuth();
        clearBrowserSessionIdentity();
        clearBrowserSessionToken();
        saveBrowserActorIdentity(nextActor);
        setPilotState((state) => selectActor({
          ...state,
          activeAssignmentId: result.assignments[0]?.id ?? "",
          assignments: result.assignments,
          sessions: result.sessions.map((item) => sessionWithPreviewStudent(item, result.student)),
          students: [result.student]
        }, nextActor));
        openRoute("list");
        return true;
      } catch (error) {
        if (error instanceof Error) console.error(`Student login failed: ${error.message}`);
        return false;
      }
    }
    const code = input.participantCode.trim();
    if (code.length > 0) {
      const student = studentByParticipantCode(pilotState, code);
      return student === null ? false : startServerSessionForStudent(student);
    }
    if (input.loginId.trim().length === 0 || input.password.trim().length === 0) return false;
    const student = studentByCredentials(pilotState, input.loginId, input.password);
    return student === null ? false : startServerSessionForStudent(student);
  };

  const switchRole = (): void => {
    clearBrowserSessionIdentity();
    clearBrowserSessionToken();
    clearBrowserActorIdentity();
    clearBrowserAdminAuth();
    clearBrowserTeacherAuth();
    setPilotState((state) => selectActor(state, null));
    openRoute("list");
  };

  const setSession = (updater: (session: PilotSession) => PilotSession): void => {
    const state = pilotStateRef.current;
    const currentSession = activeSession(state);
    if (currentSession === null) throw new Error("Student workspace requires an active persisted session.");
    if (submissionSyncInFlightRef.current === currentSession.sessionId) return;
    const nextSession = updater(currentSession);
    const nextState = updatePilotSession(state, nextSession);
    const isServerSession = loadBrowserSessionIdentity()?.sessionId === currentSession.sessionId;
    const isFinalSubmission = isServerSession && currentSession.status !== "submitted" && nextSession.status === "submitted";
    const commit = (): void => {
      pilotStateRef.current = nextState;
      setPilotState(nextState);
    };
    if (isFinalSubmission) {
      submissionSyncInFlightRef.current = currentSession.sessionId;
      void syncSessionDelta(currentSession, nextSession).then(commit).catch(reportSessionSyncError).finally(() => {
        submissionSyncInFlightRef.current = null;
      });
      return;
    }
    commit();
    if (isServerSession) void syncSessionDelta(currentSession, nextSession).catch(reportSessionSyncError);
  };

  const updateTeacherReviewForSession = (sessionId: string, input: TeacherReviewUpdate): void => {
    if (actor?.role !== "teacher") throw new Error("Teacher review requires a selected teacher.");
    const teacherId = actor.accountId;
    setPilotState((state) => {
      const target = state.sessions.find((item) => item.sessionId === sessionId);
      if (target === undefined) throw new Error(`Unknown session: ${sessionId}`);
      return updatePilotSession(state, updateTeacherReview(target, teacherId, input));
    });
  };

  const resetTeacherSessionForStudent = async (sessionId: string): Promise<string | null> => {
    if (actor?.role !== "teacher") return "교사 계정으로 로그인해야 합니다.";
    const previousState = pilotStateRef.current;
    const nextState = {
      ...previousState,
      sessions: previousState.sessions.filter((item) => item.sessionId !== sessionId)
    };
    pilotStateRef.current = nextState;
    setPilotState(nextState);
    try {
      if (!useLocalResearchStorage) await resetTeacherStudentSession(sessionId);
      return null;
    } catch (error) {
      pilotStateRef.current = previousState;
      setPilotState(previousState);
      return persistenceErrorMessage(error);
    }
  };

  const renderWorkspaceForSession = (workspaceSession: PilotSession, updateSession: (updater: (session: PilotSession) => PilotSession) => void): ReactElement => {
    if (workspaceSession.researchMode === ResearchModes.understandingCalibration) return <UnderstandingCalibrationFlow session={workspaceSession} setSession={updateSession} />;
    if (workspaceSession.researchMode === ResearchModes.guidedWriting) return <GuidedWritingFlow session={workspaceSession} setSession={updateSession} />;
    return <StudentWorkspace session={workspaceSession} setSession={updateSession} />;
  };

  const renderStudentWorkspace = (): ReactElement => {
    if (session === null) throw new Error("Student workspace requires an active persisted session.");
    return renderWorkspaceForSession(session, setSession);
  };

  const actorName = (selectedActor: SelectedActor | null): string | undefined => {
    if (selectedActor === null) return undefined;
    if (selectedActor.role === "admin") return "관리자";
    if (selectedActor.role === "teacher") return pilotState.teachers.find((teacher) => teacher.id === selectedActor.accountId)?.displayName;
    return pilotState.students.find((student) => student.id === selectedActor.accountId)?.displayName;
  };

  const selectedStudent = (): StudentAccount => {
    if (actor?.role !== "student") return firstStudent(pilotState);
    const student = pilotState.students.find((item) => item.id === actor.accountId);
    if (student === undefined) throw new Error(`Unknown selected student: ${actor.accountId}`);
    return student;
  };

  const startSelectedStudentAssignment = async (assignmentId: string): Promise<boolean> => {
    const student = selectedStudent();
    if (!useLocalResearchStorage) {
      try {
        const result = await startResearchSessionWithParticipantCode({
          assignmentId,
          loginId: student.loginId,
          participantCode: student.participantCode,
          password: student.password
        });
        clearBrowserTeacherAuth();
        saveBrowserSessionIdentity({
          assignmentId: result.assignmentId,
          classGroupId: result.classGroupId,
          sessionId: result.sessionId,
          studentAnonymousId: result.studentAnonymousId
        });
        if (result.sessionToken !== undefined) saveBrowserSessionToken(result.sessionToken);
        setPilotState((state) => stateWithServerSession(state, { ...result.session, student: { ...result.session.student, accountId: student.id, displayName: student.displayName } }));
        openRoute("student");
        return true;
      } catch (error) {
        reportSessionSyncError(error);
        if (error instanceof ResearchApiClientError && error.status === 409) throw error;
        return false;
      }
    }
    setPilotState((state) => startStudentSession(state, student.id, assignmentId).state);
    openRoute("student");
    return true;
  };

  const startTeacherPreviewAssignment = (assignmentId: string): boolean => {
    const previewAssignment = visibleTeacherState.assignments.find((assignment) => assignment.id === assignmentId) ?? null;
    if (previewAssignment === null) return false;
    setTeacherPreviewAssignmentId(previewAssignment.id);
    setTeacherPreviewSession(createSession(previewAssignment, teacherPreviewStudent(previewAssignment)));
    return true;
  };

  const updateTeacherPreviewSession = (updater: (session: PilotSession) => PilotSession): void => {
    setTeacherPreviewSession((current) => (current === null ? current : updater(current)));
  };

  const renderTeacherList = (): ReactElement => <ResearcherList activeAssignment={activeAssignment} state={visibleTeacherState} onAccounts={() => openRoute("accounts")} onAssign={saveAssignment} onCreate={openNewAssignment} onEditAssignment={openEditAssignment} onReview={() => openRoute("review")} onStudent={(assignmentId) => { void openStudent(assignmentId); }} />;

  const renderTeacherStudentPreview = (): ReactElement => {
    const previewAssignment = visibleTeacherState.assignments.find((assignment) => assignment.id === teacherPreviewAssignmentId) ?? null;
    if (previewAssignment === null) return renderTeacherList();
    if (teacherPreviewSession !== null) return renderWorkspaceForSession(teacherPreviewSession, updateTeacherPreviewSession);
    const previewStudent = teacherPreviewStudent(previewAssignment);
    const previewState: PilotState = {
      ...visibleTeacherState,
      activeAssignmentId: previewAssignment.id,
      assignments: [previewAssignment],
      selectedActor: { accountId: previewStudent.id, role: "student" },
      sessions: [],
      students: [previewStudent]
    };
    return <StudentAssignments assignments={[previewAssignment]} state={previewState} student={previewStudent} onStart={startTeacherPreviewAssignment} />;
  };

  const addedItemsById = <T extends { readonly id: string }>(previousItems: readonly T[], nextItems: readonly T[]): readonly T[] => {
    const previousIds = new Set(previousItems.map((item) => item.id));
    return nextItems.filter((item) => !previousIds.has(item.id));
  };

  const changedItemsById = <T extends { readonly id: string }>(previousItems: readonly T[], nextItems: readonly T[]): readonly T[] => {
    const previousById = new Map(previousItems.map((item) => [item.id, JSON.stringify(item)]));
    return nextItems.filter((item) => previousById.get(item.id) !== JSON.stringify(item));
  };

  const itemById = <T extends { readonly id: string }>(items: readonly T[], id: string): T | undefined =>
    items.find((item) => item.id === id);

  const mutateAccountStateAndWait = async (mutator: (state: PilotState) => PilotState, deltaFromStates: (previous: PilotState, next: PilotState) => RosterSyncDelta): Promise<string | null> => {
    const previousState = pilotStateRef.current;
    try {
      const nextState = mutator(pilotStateRef.current);
      pilotStateRef.current = nextState;
      setPilotState(nextState);
      await persistTeacherRosterDelta(nextState, deltaFromStates(previousState, nextState));
      return null;
    } catch (error) {
      pilotStateRef.current = previousState;
      setPilotState(previousState);
      if (error instanceof PilotStateError) return error.message;
      return persistenceErrorMessage(error);
    }
  };

  const updateTeacherPasswordInState = (state: PilotState, teacherId: string, password: string): PilotState => {
    const nextPassword = password.trim();
    if (nextPassword.length === 0) throw new PilotStateError("새 교사 비밀번호를 입력하세요.");
    if (!state.teachers.some((teacher) => teacher.id === teacherId)) throw new PilotStateError("수정할 교사 계정을 찾을 수 없습니다.");
    return {
      ...state,
      teacher: state.teacher.id === teacherId ? { ...state.teacher, password: nextPassword } : state.teacher,
      teachers: state.teachers.map((teacher) => (teacher.id === teacherId ? { ...teacher, password: nextPassword } : teacher))
    };
  };

  const changeCurrentTeacherPassword = async (password: string): Promise<string | null> => {
    if (actor?.role !== "teacher") return "교사 계정으로 로그인해야 합니다.";
    return mutateAccountStateAndWait(
      (state) => updateTeacherPasswordInState(state, actor.accountId, password),
      (_previous, next) => {
        const teacher = itemById(next.teachers, actor.accountId);
        return teacher === undefined ? {} : { teachers: [teacher] };
      }
    );
  };

  const removeAssignment = async (assignmentId: string): Promise<string | null> => {
    const error = await mutateAccountStateAndWait((state) => deleteAssignment(state, assignmentId), () => ({ deletedAssignmentIds: [assignmentId] }));
    if (error !== null) return error;
    setEditingAssignmentId(null);
    openRoute("list");
    return null;
  };

  const renderTeacherRoute = (): ReactElement | null => {
    const newAssignmentTemplate = (): Assignment => ({
      assignmentMode: "full_process",
      essayType: "주장 글쓰기",
      gradeLevel: "초등 고학년",
      id: "assignment-template",
      minimumWordCount: "400",
      passage: "",
      question: "",
      researchCondition: ResearchConditions.singleGroupBaseline,
      researchMode: ResearchModes.writingCoach,
      requirements: [],
      sourceGuidance: "",
      targetLength: "400자",
      title: "",
      ...(actor?.role === "teacher" ? { createdByTeacherId: actor.accountId } : {}),
      ...(visibleTeacherState.classGroups[0]?.id === undefined ? {} : { classGroupId: visibleTeacherState.classGroups[0].id })
    });
    if (route === "list") return renderTeacherList();
    if (route === "create") {
      const assignmentForForm = editingAssignmentId === null ? newAssignmentTemplate() : requireAssignment(visibleTeacherState, editingAssignmentId);
      return <CreateAssignment assignment={assignmentForForm} key={`${editingAssignmentId ?? "new"}-${assignmentForForm.id}`} mode={editingAssignmentId === null ? "create" : "edit"} state={visibleTeacherState} onBack={() => openRoute("list")} onDelete={removeAssignment} onSave={saveAssignment} />;
    }
    if (route === "review") return <TeacherReview state={visibleTeacherState} onBack={() => openRoute("list")} onResetSession={resetTeacherSessionForStudent} onUpdateReview={updateTeacherReviewForSession} />;
    if (route === "accounts") return (
      <AccountManagement
        {...(actor?.role === "teacher" ? { currentTeacherId: actor.accountId } : {})}
        mode="teacher"
        state={visibleTeacherState}
        onBack={() => openRoute("list")}
        onCreateClass={(input: CreateClassGroupInput) => mutateAccountStateAndWait((state) => createClassGroup(state, input), (previous, next) => ({ classGroups: addedItemsById(previous.classGroups, next.classGroups) }))}
        onCreateStudent={(input: CreateStudentInput) => mutateAccountStateAndWait((state) => createStudentAccount(state, input), (previous, next) => ({ students: addedItemsById(previous.students, next.students) }))}
        onCreateStudents={(inputs: readonly CreateStudentInput[]) => mutateAccountStateAndWait((state) => inputs.reduce((nextState, input) => createStudentAccount(nextState, input), state), (previous, next) => ({ students: addedItemsById(previous.students, next.students) }))}
        onCreateTeacher={() => "교사 계정은 관리자 화면에서만 만들 수 있습니다."}
        onDeleteClass={(classGroupId: string) => mutateAccountStateAndWait((state) => deleteClassGroup(state, classGroupId), (previous, next) => ({ assignments: changedItemsById(previous.assignments, next.assignments), deletedClassIds: [classGroupId] }))}
        onDeleteStudent={(studentId: string) => mutateAccountStateAndWait((state) => deleteStudentAccount(state, studentId), (previous, next) => ({ assignments: changedItemsById(previous.assignments, next.assignments), deletedStudentIds: [studentId] }))}
        onDeleteTeacher={() => "교사 계정은 관리자 화면에서만 삭제할 수 있습니다."}
        onUpdateTeacherPassword={() => "교사 비밀번호는 관리자 화면에서만 수정할 수 있습니다."}
      />
    );
    if (route === "student") return renderTeacherStudentPreview();
    return null;
  };

  const renderAdminRoute = (): ReactElement => {
    if (route === "export") return <ExportView fileSync={fileSync} state={pilotState} onBack={() => openRoute("admin")} />;
    return (
      <AccountManagement
      mode="admin"
      state={pilotState}
      onBack={switchRole}
      onLogs={() => openRoute("export")}
      onCreateClass={(input: CreateClassGroupInput) => mutateAccountStateAndWait((state) => createClassGroup(state, input), (previous, next) => ({ classGroups: addedItemsById(previous.classGroups, next.classGroups) }))}
      onCreateStudent={(input: CreateStudentInput) => mutateAccountStateAndWait((state) => createStudentAccount(state, input), (previous, next) => ({ students: addedItemsById(previous.students, next.students) }))}
      onCreateStudents={(inputs: readonly CreateStudentInput[]) => mutateAccountStateAndWait((state) => inputs.reduce((nextState, input) => createStudentAccount(nextState, input), state), (previous, next) => ({ students: addedItemsById(previous.students, next.students) }))}
      onCreateTeacher={(input: CreateTeacherInput) => mutateAccountStateAndWait((state) => createTeacherAccount(state, input), (previous, next) => ({ teachers: addedItemsById(previous.teachers, next.teachers) }))}
      onDeleteClass={(classGroupId: string) => mutateAccountStateAndWait((state) => deleteClassGroup(state, classGroupId), (previous, next) => ({ assignments: changedItemsById(previous.assignments, next.assignments), deletedClassIds: [classGroupId] }))}
      onDeleteStudent={(studentId: string) => mutateAccountStateAndWait((state) => deleteStudentAccount(state, studentId), (previous, next) => ({ assignments: changedItemsById(previous.assignments, next.assignments), deletedStudentIds: [studentId] }))}
      onDeleteTeacher={(teacherId: string) => mutateAccountStateAndWait((state) => deleteTeacherAccount(state, teacherId), (previous, next) => ({ classGroups: changedItemsById(previous.classGroups, next.classGroups), deletedTeacherIds: [teacherId] }))}
      onUpdateTeacherPassword={(teacherId: string, password: string) => mutateAccountStateAndWait((state) => updateTeacherPasswordInState(state, teacherId, password), (_previous, next) => {
        const teacher = itemById(next.teachers, teacherId);
        return teacher === undefined ? {} : { teachers: [teacher] };
      })}
      />
    );
  };
  const renderTeacherRosterLoading = (): ReactElement => (
    <main className="form-page" aria-label="과제 불러오기">
      <section className="assignment-form">
        <p className="eyebrow">Reading Coach Lab</p>
        <h1>과제를 불러오는 중입니다.</h1>
      </section>
    </main>
  );
  const currentStudent = actor?.role === "student" ? pilotState.students.find((student) => student.id === actor.accountId) ?? null : null;
  const routeRequiresLogin = actor === null ||
    (teacherRoute && actor.role !== "teacher") ||
    (adminRoute && actor.role !== "admin");
  const roleEntryMode = adminRoute ? "admin" : teacherRoute ? "teacher" : "entry";

  return (
      <div className="app-shell" data-testid="app-shell">
      <TopBar
        {...(actor?.role === "teacher" ? { accountMenu: <TeacherAccountSettingsMenu displayName={actorName(actor) ?? "교사"} onChangePassword={changeCurrentTeacherPassword} /> } : {})}
        actorName={actorName(actor)}
        onAdminEntry={actor === null ? () => openRoute("admin") : undefined}
        onHome={() => openRoute("list")}
        onLogout={actor?.role === "student" ? switchRole : undefined}
        onSwitchRole={actor !== null && actor.role !== "student" && route !== "student" ? switchRole : undefined}
      />
      {routeRequiresLogin ? <RoleEntry mode={roleEntryMode} onAdmin={chooseAdmin} onTeacher={chooseTeacher} onStudentCredentials={chooseStudentCredentials} /> : null}
      {actor?.role === "teacher" && !rosterReady ? renderTeacherRosterLoading() : null}
      {actor?.role === "teacher" && rosterReady ? renderTeacherRoute() : null}
      {actor?.role === "admin" && !rosterReady ? renderTeacherRosterLoading() : null}
      {actor?.role === "admin" && rosterReady ? renderAdminRoute() : null}
      {currentStudent !== null && route !== "student" && !teacherRoute ? <StudentAssignments assignments={assignmentsForStudent(pilotState, currentStudent)} state={pilotState} student={currentStudent} onStart={startSelectedStudentAssignment} /> : null}
      {actor?.role === "student" && route === "student" ? renderStudentWorkspace() : null}
    </div>
  );
}
