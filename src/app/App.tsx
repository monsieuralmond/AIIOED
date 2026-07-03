import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { unavailableFileSync } from "../session/file-sync";
import { activeSession, assignmentsForStudent, createClassGroup, createStudentAccount, createTeacherAccount, deleteClassGroup, deleteStudentAccount, deleteTeacherAccount, PilotStateError, requireAssignment, saveAssignmentInState, selectActor, startStudentSession, studentByCredentials, teacherByCredentials, updatePilotSession, updateTeacherReview } from "../session/session";
import type { CreateClassGroupInput, CreateStudentInput, CreateTeacherInput } from "../session/session";
import { clearBrowserSessionIdentity, loadBrowserSessionIdentity, saveBrowserSessionIdentity } from "../session/browser-session";
import { resumeResearchSession, startResearchSessionWithParticipantCode, syncRosterToDatabase, syncSessionDelta } from "../session/research-api-client";
import { ResearchModes } from "../shared/research";
import type { Assignment, FileSyncStatus, PilotSession, PilotState, SelectedActor, StudentAccount, TeacherReviewUpdate } from "../shared/types";
import { AccountManagement } from "./account-management";
import { currentPath, firstStudent, initialPilotState, initialRoute, routePath, stateWithServerSession } from "./app-bootstrap";
import type { Route } from "./app-bootstrap";
import { CreateAssignment } from "./create-assignment";
import { ExportView } from "./export-view";
import { TopBar } from "./layout";
import { ResearcherList } from "./researcher";
import { RoleEntry } from "./role-entry";
import { StudentAssignments } from "./student-assignments";
import { StudentWorkspace } from "./student-workspace";
import { TeacherReview } from "./teacher-review";
import { UnderstandingCalibrationFlow } from "./understanding-calibration-flow";

export function App(): ReactElement {
  const [pilotState, setPilotState] = useState<PilotState>(initialPilotState);
  const [route, setRoute] = useState(initialRoute);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const fileSync: FileSyncStatus = unavailableFileSync();
  const assignment = requireAssignment(pilotState, pilotState.activeAssignmentId);
  const session = activeSession(pilotState);
  const actor = pilotState.selectedActor;
  const teacherRoute = route === "create" || route === "review" || route === "export" || route === "accounts";

  const openRoute = (next: Route): void => {
    if (next !== "create") setEditingAssignmentId(null);
    window.history.pushState({}, "", routePath(next));
    setRoute(next);
  };

  useEffect(() => {
    const identity = loadBrowserSessionIdentity();
    if (identity === null || !currentPath().startsWith("/student")) return;
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
        setPilotState((state) => stateWithServerSession(state, result.session));
        openRoute("student");
      })
      .catch(() => clearBrowserSessionIdentity());
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (actor?.role !== "teacher") return;
    void syncRosterToDatabase(pilotState);
  }, [actor?.role, pilotState.assignments, pilotState.classGroups, pilotState.students]);

  const saveAssignment = (nextAssignment: Assignment): void => {
    setPilotState((state) => saveAssignmentInState(state, nextAssignment));
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

  const openStudent = (): void => {
    setPilotState((state) => startStudentSession(state, firstStudent(state).id, state.activeAssignmentId).state);
    openRoute("student");
  };

  const chooseTeacher = (loginId: string, password: string): boolean => {
    const teacher = teacherByCredentials(pilotState, loginId, password);
    if (teacher === null) return false;
    const nextActor: SelectedActor = { role: "teacher", accountId: teacher.id };
    setPilotState((state) => selectActor(state, nextActor));
    openRoute(teacherRoute ? route : "list");
    return true;
  };

  const chooseStudent = (student: StudentAccount): boolean => {
    const nextActor: SelectedActor = { role: "student", accountId: student.id };
    setPilotState((state) => selectActor(state, nextActor));
    openRoute("list");
    return true;
  };

  const chooseStudentCode = async (code: string): Promise<boolean> => {
    try {
      const result = await startResearchSessionWithParticipantCode(code);
      saveBrowserSessionIdentity({
        assignmentId: result.assignmentId,
        classGroupId: result.classGroupId,
        sessionId: result.sessionId,
        studentAnonymousId: result.studentAnonymousId
      });
      setPilotState((state) => stateWithServerSession(state, result.session));
      openRoute("student");
      return true;
    } catch {
      return false;
    }
  };

  const chooseStudentCredentials = (loginId: string, password: string): boolean => {
    const student = studentByCredentials(pilotState, loginId, password);
    if (student === null) return false;
    return chooseStudent(student);
  };

  const switchRole = (): void => {
    clearBrowserSessionIdentity();
    setPilotState((state) => selectActor(state, null));
    openRoute("list");
  };

  const setSession = (updater: (session: PilotSession) => PilotSession): void => {
    setPilotState((state) => {
      const currentSession = activeSession(state);
      if (currentSession === null) throw new Error("Student workspace requires an active persisted session.");
      const nextSession = updater(currentSession);
      void syncSessionDelta(currentSession, nextSession).catch(() => undefined);
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
    return <StudentWorkspace session={session} setSession={setSession} />;
  };

  const actorName = (selectedActor: SelectedActor | null): string | undefined => {
    if (selectedActor === null) return undefined;
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
    setPilotState((state) => startStudentSession(state, student.id, assignmentId).state);
    openRoute("student");
  };

  const mutateAccountState = (mutator: (state: PilotState) => PilotState): string | null => {
    try {
      setPilotState(mutator(pilotState));
      return null;
    } catch (error) {
      if (error instanceof PilotStateError) return error.message;
      throw error;
    }
  };

  const renderTeacherRoute = (): ReactElement | null => {
    if (route === "list") return <ResearcherList assignment={assignment} state={pilotState} onAccounts={() => openRoute("accounts")} onAssign={saveAssignment} onCreate={openNewAssignment} onEditAssignment={openEditAssignment} onReview={() => openRoute("review")} onStudent={openStudent} onExport={() => openRoute("export")} />;
    if (route === "create") {
      const assignmentForForm = editingAssignmentId === null ? assignment : requireAssignment(pilotState, editingAssignmentId);
      return <CreateAssignment assignment={assignmentForForm} key={`${editingAssignmentId ?? "new"}-${assignmentForForm.id}`} mode={editingAssignmentId === null ? "create" : "edit"} state={pilotState} onBack={() => openRoute("list")} onSave={saveAssignment} />;
    }
    if (route === "review") return <TeacherReview state={pilotState} onBack={() => openRoute("list")} onUpdateReview={updateTeacherReviewForSession} />;
    if (route === "export") return <ExportView fileSync={fileSync} state={pilotState} onStudent={openStudent} />;
    if (route === "accounts") return (
      <AccountManagement
        state={pilotState}
        onBack={() => openRoute("list")}
        onCreateClass={(input: CreateClassGroupInput) => mutateAccountState((state) => createClassGroup(state, input))}
        onCreateStudent={(input: CreateStudentInput) => mutateAccountState((state) => createStudentAccount(state, input))}
        onCreateStudents={(inputs: readonly CreateStudentInput[]) => mutateAccountState((state) => inputs.reduce((nextState, input) => createStudentAccount(nextState, input), state))}
        onCreateTeacher={(input: CreateTeacherInput) => mutateAccountState((state) => createTeacherAccount(state, input))}
        onDeleteClass={(classGroupId: string) => mutateAccountState((state) => deleteClassGroup(state, classGroupId))}
        onDeleteStudent={(studentId: string) => mutateAccountState((state) => deleteStudentAccount(state, studentId))}
        onDeleteTeacher={(teacherId: string) => mutateAccountState((state) => deleteTeacherAccount(state, teacherId))}
      />
    );
    if (route === "student") return renderStudentWorkspace();
    return null;
  };
  const currentStudent = actor?.role === "student" ? selectedStudent() : null;

  return (
      <div className="app-shell" data-testid="app-shell">
      <TopBar actorName={actorName(actor)} onHome={() => openRoute("list")} onLogout={actor?.role === "student" ? switchRole : undefined} onSwitchRole={actor?.role === "teacher" && route !== "student" ? switchRole : undefined} />
      {actor === null || (actor.role !== "teacher" && teacherRoute) ? <RoleEntry mode={teacherRoute ? "teacher" : "entry"} onTeacher={chooseTeacher} onStudentCode={chooseStudentCode} onStudentCredentials={chooseStudentCredentials} /> : null}
      {actor?.role === "teacher" ? renderTeacherRoute() : null}
      {currentStudent !== null && route !== "student" && !teacherRoute ? <StudentAssignments assignments={assignmentsForStudent(pilotState, currentStudent)} state={pilotState} student={currentStudent} onStart={startSelectedStudentAssignment} /> : null}
      {actor?.role === "student" && route === "student" ? renderStudentWorkspace() : null}
    </div>
  );
}
