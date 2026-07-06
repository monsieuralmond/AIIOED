import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { unavailableFileSync } from "../session/file-sync.js";
import { activeSession, assignmentsForStudent, createClassGroup, createStudentAccount, createTeacherAccount, deleteAssignment, deleteClassGroup, deleteStudentAccount, deleteTeacherAccount, PilotStateError, requireAssignment, saveAssignmentInState, selectActor, startStudentSession, studentByCredentials, studentByParticipantCode, teacherByCredentials, updatePilotSession, updateTeacherReview } from "../session/session.js";
import type { CreateClassGroupInput, CreateStudentInput, CreateTeacherInput } from "../session/session.js";
import { clearBrowserActorIdentity, clearBrowserAdminAuth, clearBrowserSessionIdentity, clearBrowserSessionToken, clearBrowserTeacherAuth, loadBrowserActorIdentity, loadBrowserSessionIdentity, saveBrowserActorIdentity, saveBrowserAdminAuth, saveBrowserSessionIdentity, saveBrowserSessionToken, saveBrowserTeacherAuth } from "../session/browser-session.js";
import { authenticateAdminWithDatabase, authenticateStudentWithDatabase, authenticateTeacherWithDatabase, loadAdminSessionsFromDatabase, loadRosterFromDatabase, loadTeacherSessionsFromDatabase, resumeResearchSession, startResearchSessionWithParticipantCode, startTeacherPreviewSession, syncRosterToDatabase, syncSessionDelta } from "../session/research-api-client.js";
import { ResearchConditions, ResearchModes } from "../shared/research.js";
import type { Assignment, FileSyncStatus, PilotSession, PilotState, SelectedActor, StudentAccount, TeacherReviewUpdate } from "../shared/types.js";
import { AccountManagement } from "./account-management.js";
import { currentPath, firstStudent, initialPilotState, initialRoute, routePath, stateWithBrowserActor, stateWithDatabaseRoster, stateWithServerSession } from "./app-bootstrap.js";
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

export function App(): ReactElement {
  const [pilotState, setPilotState] = useState<PilotState>(initialAppState);
  const [route, setRoute] = useState(initialRoute);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [rosterReady, setRosterReady] = useState(false);
  const [, setRosterRevision] = useState<string | null>(null);
  const rosterRevisionRef = useRef<string | null>(null);
  const rosterSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pilotStateRef = useRef<PilotState>(pilotState);
  const fileSync: FileSyncStatus = unavailableFileSync();
  const activeAssignment = pilotState.assignments.find((assignment) => assignment.id === pilotState.activeAssignmentId) ?? pilotState.assignments[0] ?? null;
  const session = activeSession(pilotState);
  const actor = pilotState.selectedActor;
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

  const updateRosterRevision = (nextRevision: string | null): void => {
    rosterRevisionRef.current = nextRevision;
    setRosterRevision(nextRevision);
  };

  const persistTeacherRoster = (nextState: PilotState, deletedIds: {
    readonly deletedAssignmentIds?: readonly string[];
    readonly deletedClassIds?: readonly string[];
    readonly deletedStudentIds?: readonly string[];
    readonly deletedTeacherIds?: readonly string[];
  } = {}): Promise<void> => {
    if (useLocalResearchStorage) return Promise.resolve();
    if ((actor?.role !== "teacher" && actor?.role !== "admin") || !rosterReady) return Promise.resolve();
    const syncRoster = async (): Promise<void> => {
      const result = await syncRosterToDatabase(nextState, deletedIds, rosterRevisionRef.current);
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

  const stateWithTeacherPreviewSession = (state: PilotState, previewSession: PilotSession): PilotState => {
    const assignments = state.assignments.some((assignment) => assignment.id === previewSession.assignment.id)
      ? state.assignments.map((assignment) => (assignment.id === previewSession.assignment.id ? previewSession.assignment : assignment))
      : [...state.assignments, previewSession.assignment];
    return {
      ...state,
      activeAssignmentId: previewSession.assignment.id,
      assignments,
      sessions: [...state.sessions.filter((item) => item.sessionId !== previewSession.sessionId), previewSession]
    };
  };

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
    const intervalId = window.setInterval(refreshSessions, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [actor?.accountId, actor?.role, rosterReady, route]);

  const saveAssignment = (nextAssignment: Assignment): void => {
    const nextState = saveAssignmentInState(pilotStateRef.current, nextAssignment);
    pilotStateRef.current = nextState;
    setPilotState(nextState);
    void persistTeacherRoster(nextState);
    setEditingAssignmentId(null);
    openRoute("list");
  };

  const openNewAssignment = (): void => {
    setEditingAssignmentId(null);
    openRoute("create");
  };

  const openEditAssignment = (assignmentId: string): void => {
    setEditingAssignmentId(assignmentId);
    openRoute("create");
  };

  const firstStudentForAssignment = (assignment: Assignment): StudentAccount | null =>
    pilotState.students.find((student) => assignmentsForStudent(pilotState, student).some((item) => item.id === assignment.id)) ?? null;

  const anonymousIdForStudent = (student: StudentAccount): string => student.anonymousId ?? `anon-${student.classGroupId}-${String(student.studentNumber).padStart(3, "0")}`;

  const sessionIdentifiersForStudent = (student: StudentAccount): ReadonlySet<string> =>
    new Set([student.id, anonymousIdForStudent(student)]);

  const sessionMatchesStudent = (item: PilotSession, student: StudentAccount): boolean =>
    item.student.accountId === student.id || sessionIdentifiersForStudent(student).has(item.student.anonymousId);

  const latestSessionForStudent = (assignment: Assignment, student: StudentAccount): PilotSession | null => {
    return [...pilotState.sessions].reverse().find((item) =>
      item.assignment.id === assignment.id &&
      sessionMatchesStudent(item, student)
    ) ?? null;
  };

  const latestStudentPreviewTarget = (assignment: Assignment): { readonly session: PilotSession | null; readonly student: StudentAccount } | null => {
    const latestAssignmentSession = [...pilotState.sessions].reverse().find((item) => item.assignment.id === assignment.id) ?? null;
    if (latestAssignmentSession !== null) {
      const sessionStudent = pilotState.students.find((student) =>
        assignmentsForStudent(pilotState, student).some((item) => item.id === assignment.id) &&
        sessionMatchesStudent(latestAssignmentSession, student)
      );
      if (sessionStudent !== undefined) return { session: latestAssignmentSession, student: sessionStudent };
    }
    const student = firstStudentForAssignment(assignment);
    return student === null ? null : { session: latestSessionForStudent(assignment, student), student };
  };

  const sessionWithPreviewStudent = (previewSession: PilotSession, student: StudentAccount): PilotSession => ({
    ...previewSession,
    student: { ...previewSession.student, accountId: student.id, displayName: student.displayName }
  });

  const openStudent = async (): Promise<void> => {
    if (activeAssignment === null) return;
    if (useLocalResearchStorage) {
      setPilotState((state) => startStudentSession(state, firstStudent(state).id, activeAssignment.id).state);
      openRoute("student");
      return;
    }
    const previewTarget = latestStudentPreviewTarget(activeAssignment);
    if (previewTarget === null) {
      console.error("Student preview failed: no assigned student for this assignment.");
      return;
    }
    const { session: existingSession, student } = previewTarget;
    if (existingSession !== null) {
      setPilotState((state) => stateWithTeacherPreviewSession(state, sessionWithPreviewStudent(existingSession, student)));
      openRoute("student");
      return;
    }
    try {
      const result = await startTeacherPreviewSession({
        assignmentId: activeAssignment.id,
        ...(student.loginId === undefined ? {} : { loginId: student.loginId }),
        participantCode: student.participantCode
      });
      setPilotState((state) => stateWithTeacherPreviewSession(state, sessionWithPreviewStudent(result.session, student)));
      openRoute("student");
    } catch (error) {
      reportSessionSyncError(error);
    }
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
          return selectActor({ ...state, teachers }, nextActor);
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
      const assignment = assignmentsForStudent(pilotState, student)[0];
      if (assignment === undefined) return false;
      const nextActor: SelectedActor = { accountId: student.id, role: "student" };
      clearBrowserAdminAuth();
      clearBrowserTeacherAuth();
      clearBrowserSessionIdentity();
      clearBrowserSessionToken();
      saveBrowserActorIdentity(nextActor);
      setPilotState((state) => selectActor(startStudentSession(state, student.id, assignment.id).state, nextActor));
      openRoute("student");
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
          sessions: [],
          students: [result.student]
        }, nextActor));
        openRoute("list");
        return true;
      } catch (error) {
        if (error instanceof Error) console.error(`Student login failed: ${error.message}`);
        return false;
      }
    }
    const studentByLogin = studentByCredentials(pilotState, input.loginId, input.password);
    const studentByCode = studentByParticipantCode(pilotState, input.participantCode);
    if (studentByLogin === null || studentByCode === null || studentByLogin.id !== studentByCode.id) return false;
    return startServerSessionForStudent(studentByLogin);
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
    setPilotState((state) => {
      const currentSession = activeSession(state);
      if (currentSession === null) throw new Error("Student workspace requires an active persisted session.");
      const nextSession = updater(currentSession);
      if (loadBrowserSessionIdentity()?.sessionId === currentSession.sessionId) {
        void syncSessionDelta(currentSession, nextSession).catch(reportSessionSyncError);
      }
      return updatePilotSession(state, nextSession);
    });
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

  const renderStudentWorkspace = (): ReactElement => {
    if (session === null) throw new Error("Student workspace requires an active persisted session.");
    if (session.researchMode === ResearchModes.understandingCalibration) return <UnderstandingCalibrationFlow session={session} setSession={setSession} />;
    if (session.researchMode === ResearchModes.guidedWriting) return <GuidedWritingFlow session={session} setSession={setSession} />;
    return <StudentWorkspace session={session} setSession={setSession} />;
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

  const startSelectedStudentAssignment = (assignmentId: string): void => {
    const student = selectedStudent();
    if (!useLocalResearchStorage) {
      void startResearchSessionWithParticipantCode({
        assignmentId,
        loginId: student.loginId,
        participantCode: student.participantCode,
        password: student.password
      }).then((result) => {
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
      }).catch(reportSessionSyncError);
      return;
    }
    setPilotState((state) => startStudentSession(state, student.id, assignmentId).state);
    openRoute("student");
  };

  const mutateAccountState = (mutator: (state: PilotState) => PilotState, deletedIds: {
    readonly deletedAssignmentIds?: readonly string[];
    readonly deletedClassIds?: readonly string[];
    readonly deletedStudentIds?: readonly string[];
    readonly deletedTeacherIds?: readonly string[];
  } = {}): string | null => {
    try {
      const nextState = mutator(pilotStateRef.current);
      pilotStateRef.current = nextState;
      setPilotState(nextState);
      void persistTeacherRoster(nextState, deletedIds);
      return null;
    } catch (error) {
      if (error instanceof PilotStateError) return error.message;
      throw error;
    }
  };

  const mutateAccountStateAndWait = async (mutator: (state: PilotState) => PilotState, deletedIds: {
    readonly deletedAssignmentIds?: readonly string[];
    readonly deletedClassIds?: readonly string[];
    readonly deletedStudentIds?: readonly string[];
    readonly deletedTeacherIds?: readonly string[];
  } = {}): Promise<string | null> => {
    try {
      const nextState = mutator(pilotStateRef.current);
      pilotStateRef.current = nextState;
      setPilotState(nextState);
      await persistTeacherRoster(nextState, deletedIds);
      return null;
    } catch (error) {
      if (error instanceof PilotStateError) return error.message;
      if (error instanceof Error) return `저장에 실패했습니다. ${error.message}`;
      return "저장에 실패했습니다. 다시 시도하세요.";
    }
  };

  const updateTeacherPasswordInState = (state: PilotState, teacherId: string, password: string): PilotState => {
    if (!state.teachers.some((teacher) => teacher.id === teacherId)) throw new PilotStateError("수정할 교사 계정을 찾을 수 없습니다.");
    return {
      ...state,
      teacher: state.teacher.id === teacherId ? { ...state.teacher, password } : state.teacher,
      teachers: state.teachers.map((teacher) => (teacher.id === teacherId ? { ...teacher, password } : teacher))
    };
  };

  const removeAssignment = (assignmentId: string): string | null => {
    const error = mutateAccountState((state) => deleteAssignment(state, assignmentId), { deletedAssignmentIds: [assignmentId] });
    if (error !== null) return error;
    setEditingAssignmentId(null);
    openRoute("list");
    return null;
  };

  const renderTeacherRoute = (): ReactElement | null => {
    const renderTeacherList = (): ReactElement => <ResearcherList activeAssignment={activeAssignment} state={pilotState} onAccounts={() => openRoute("accounts")} onAssign={saveAssignment} onCreate={openNewAssignment} onEditAssignment={openEditAssignment} onReview={() => openRoute("review")} onStudent={openStudent} />;
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
      ...(pilotState.classGroups[0]?.id === undefined ? {} : { classGroupId: pilotState.classGroups[0].id })
    });
    if (route === "list") return renderTeacherList();
    if (route === "create") {
      const assignmentForForm = editingAssignmentId === null ? newAssignmentTemplate() : requireAssignment(pilotState, editingAssignmentId);
      return <CreateAssignment assignment={assignmentForForm} key={`${editingAssignmentId ?? "new"}-${assignmentForForm.id}`} mode={editingAssignmentId === null ? "create" : "edit"} state={pilotState} onBack={() => openRoute("list")} onDelete={removeAssignment} onSave={saveAssignment} />;
    }
    if (route === "review") return <TeacherReview state={pilotState} onBack={() => openRoute("list")} onUpdateReview={updateTeacherReviewForSession} />;
    if (route === "accounts") return (
      <AccountManagement
        {...(actor?.role === "teacher" ? { currentTeacherId: actor.accountId } : {})}
        mode="teacher"
        state={pilotState}
        onBack={() => openRoute("list")}
        onCreateClass={(input: CreateClassGroupInput) => mutateAccountStateAndWait((state) => createClassGroup(state, input))}
        onCreateStudent={(input: CreateStudentInput) => mutateAccountStateAndWait((state) => createStudentAccount(state, input))}
        onCreateStudents={(inputs: readonly CreateStudentInput[]) => mutateAccountStateAndWait((state) => inputs.reduce((nextState, input) => createStudentAccount(nextState, input), state))}
        onCreateTeacher={() => "교사 계정은 관리자 화면에서만 만들 수 있습니다."}
        onDeleteClass={(classGroupId: string) => mutateAccountStateAndWait((state) => deleteClassGroup(state, classGroupId), { deletedClassIds: [classGroupId] })}
        onDeleteStudent={(studentId: string) => mutateAccountStateAndWait((state) => deleteStudentAccount(state, studentId), { deletedStudentIds: [studentId] })}
        onDeleteTeacher={() => "교사 계정은 관리자 화면에서만 삭제할 수 있습니다."}
        onUpdateTeacherPassword={() => "교사 비밀번호는 관리자 화면에서만 수정할 수 있습니다."}
      />
    );
    if (route === "student") return session === null ? renderTeacherList() : renderStudentWorkspace();
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
      onCreateClass={(input: CreateClassGroupInput) => mutateAccountStateAndWait((state) => createClassGroup(state, input))}
      onCreateStudent={(input: CreateStudentInput) => mutateAccountStateAndWait((state) => createStudentAccount(state, input))}
      onCreateStudents={(inputs: readonly CreateStudentInput[]) => mutateAccountStateAndWait((state) => inputs.reduce((nextState, input) => createStudentAccount(nextState, input), state))}
      onCreateTeacher={(input: CreateTeacherInput) => mutateAccountStateAndWait((state) => createTeacherAccount(state, input))}
      onDeleteClass={(classGroupId: string) => mutateAccountStateAndWait((state) => deleteClassGroup(state, classGroupId), { deletedClassIds: [classGroupId] })}
      onDeleteStudent={(studentId: string) => mutateAccountStateAndWait((state) => deleteStudentAccount(state, studentId), { deletedStudentIds: [studentId] })}
      onDeleteTeacher={(teacherId: string) => mutateAccountStateAndWait((state) => deleteTeacherAccount(state, teacherId), { deletedTeacherIds: [teacherId] })}
      onUpdateTeacherPassword={(teacherId: string, password: string) => mutateAccountStateAndWait((state) => updateTeacherPasswordInState(state, teacherId, password))}
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
      <TopBar actorName={actorName(actor)} onHome={() => openRoute("list")} onLogout={actor?.role === "student" ? switchRole : undefined} onSwitchRole={actor !== null && actor.role !== "student" && route !== "student" ? switchRole : undefined} />
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
