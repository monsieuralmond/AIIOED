import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { failedFileSync, syncPilotStateToFile, unavailableFileSync } from "../session/file-sync";
import { activeSession, assignmentsForStudent, createClassGroup, createInitialPilotState, createSession, createStudentAccount, createTeacherAccount, deleteClassGroup, deleteStudentAccount, deleteTeacherAccount, enterStage, PilotStateError, requireAssignment, saveAssignmentInState, selectActor, sessionForStudent, startStudentSession, studentByCredentials, studentByParticipantCode, teacherByCredentials, updateDraft, updateOutline, updatePilotSession, updateTeacherReview } from "../session/session";
import type { CreateClassGroupInput, CreateStudentInput, CreateTeacherInput } from "../session/session";
import { loadPersistedState, savePersistedState } from "../session/storage";
import { sampleDraft, sampleOutline } from "../shared/fixtures";
import type { Assignment, FileSyncStatus, PilotSession, PilotState, SelectedActor, Stage, StudentAccount, TeacherReviewUpdate } from "../shared/types";
import { AccountManagement } from "./account-management";
import { CreateAssignment } from "./create-assignment";
import { ExportView } from "./export-view";
import { TopBar } from "./layout";
import { ResearcherList } from "./researcher";
import { RoleEntry } from "./role-entry";
import { StudentAssignments } from "./student-assignments";
import { StudentWorkspace } from "./student-workspace";
import { TeacherReview } from "./teacher-review";

type Route = "list" | "create" | "student" | "review" | "export" | "accounts";

const path = (): string => window.location.pathname;

const initialRoute = (): Route => {
  if (path().startsWith("/assignments/new")) return "create";
  if (path().startsWith("/student")) return "student";
  if (path().startsWith("/review")) return "review";
  if (path().startsWith("/export")) return "export";
  if (path().startsWith("/accounts")) return "accounts";
  return "list";
};

const routePath = (route: Route): string => {
  if (route === "create") return "/assignments/new";
  if (route === "student") return "/student";
  if (route === "review") return "/review";
  if (route === "export") return "/export";
  if (route === "accounts") return "/accounts";
  return "/";
};

const stageFromPath = (): Stage => {
  if (path().startsWith("/student/thinking")) return "thinking";
  if (path().startsWith("/student/writing")) return "writing";
  if (path().startsWith("/student/review")) return "review";
  return "reading";
};

const firstStudent = (state: PilotState): StudentAccount => {
  const student = state.students[0];
  if (student === undefined) throw new Error("Pilot state requires at least one student.");
  return student;
};

const selectedStudentFromState = (state: PilotState): StudentAccount | null => {
  if (state.selectedActor?.role !== "student") return null;
  const student = state.students.find((item) => item.id === state.selectedActor?.accountId);
  if (student === undefined) throw new Error(`Unknown selected student: ${state.selectedActor.accountId}`);
  return student;
};

const seededSession = (assignment: Assignment, student?: StudentAccount): PilotSession => {
  const requestedStage = stageFromPath();
  const session = createSession(assignment, student);
  if (requestedStage === "reading") return session;

  const withOutline = updateOutline(session, sampleOutline);
  if (requestedStage === "thinking") return enterStage(withOutline, "thinking");
  if (requestedStage === "writing") return enterStage(withOutline, "writing");
  return enterStage(updateDraft(withOutline, sampleDraft), "review");
};

const initialPilotState = (): PilotState => {
  const persisted = loadPersistedState();
  const base = persisted ?? createInitialPilotState();
  if (!path().startsWith("/student")) return base;
  const selectedStudent = selectedStudentFromState(base);
  if (selectedStudent === null) return base;
  const assignment = assignmentsForStudent(base, selectedStudent)[0] ?? requireAssignment(base, base.activeAssignmentId);
  const session = seededSession(assignment, selectedStudent);
  return {
    ...base,
    activeSessionId: session.sessionId,
    sessions: [...base.sessions, session]
  };
};

export function App(): ReactElement {
  const [pilotState, setPilotState] = useState<PilotState>(initialPilotState);
  const [route, setRoute] = useState(initialRoute);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [fileSync, setFileSync] = useState<FileSyncStatus>(unavailableFileSync);
  const assignment = requireAssignment(pilotState, pilotState.activeAssignmentId);
  const session = activeSession(pilotState);
  const actor = pilotState.selectedActor;
  const teacherRoute = route === "create" || route === "review" || route === "export" || route === "accounts";

  useEffect(() => {
    savePersistedState(pilotState);
    syncPilotStateToFile(pilotState).then(setFileSync, (error: unknown) => setFileSync(failedFileSync(error)));
  }, [pilotState]);

  const openRoute = (next: Route): void => {
    if (next !== "create") setEditingAssignmentId(null);
    window.history.pushState({}, "", routePath(next));
    setRoute(next);
  };

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

  const selectTeacherAssignment = (assignmentId: string): void => {
    setPilotState((state) => {
      const active = state.sessions.find((session) => session.sessionId === state.activeSessionId);
      return {
        ...state,
        activeAssignmentId: assignmentId,
        activeSessionId: active?.assignment.id === assignmentId ? active.sessionId : null
      };
    });
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

  const chooseStudentCode = (code: string): boolean => {
    const student = studentByParticipantCode(pilotState, code);
    if (student === null) return false;
    return chooseStudent(student);
  };

  const chooseStudentCredentials = (loginId: string, password: string): boolean => {
    const student = studentByCredentials(pilotState, loginId, password);
    if (student === null) return false;
    return chooseStudent(student);
  };

  const switchRole = (): void => {
    setPilotState((state) => selectActor(state, null));
    openRoute("list");
  };

  const setSession = (updater: (session: PilotSession) => PilotSession): void => {
    setPilotState((state) => {
      const currentSession = activeSession(state);
      if (currentSession === null) throw new Error("Student workspace requires an active persisted session.");
      return updatePilotSession(state, updater(currentSession));
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
    if (route === "list") return <ResearcherList assignment={assignment} state={pilotState} onAccounts={() => openRoute("accounts")} onAssign={saveAssignment} onCreate={openNewAssignment} onEditAssignment={openEditAssignment} onReview={() => openRoute("review")} onSelectAssignment={selectTeacherAssignment} onStudent={openStudent} onExport={() => openRoute("export")} />;
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
