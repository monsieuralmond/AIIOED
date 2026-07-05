import { activeSession, assignmentsForStudent, createInitialPilotState, createSession, enterStage, requireAssignment, selectActor, updateDraft, updateOutline } from "../session/session.js";
import { sampleDraft, sampleOutline } from "../shared/fixtures.js";
import type { Assignment, PilotSession, PilotState, SelectedActor, Stage, StudentAccount } from "../shared/types.js";
import { loadPersistedState } from "../session/storage.js";
import { loadBrowserActorIdentity, loadBrowserAdminAuth, loadBrowserTeacherAuth } from "../session/browser-session.js";
import type { DatabaseRoster } from "../session/database-roster.js";

export type Route = "admin" | "list" | "create" | "student" | "review" | "export" | "accounts";

export const currentPath = (): string => window.location.pathname;

export const initialRoute = (): Route => {
  if (currentPath().startsWith("/assignments/new")) return "create";
  if (currentPath().startsWith("/student")) return "student";
  if (currentPath().startsWith("/review")) return "review";
  if (currentPath().startsWith("/export")) return "export";
  if (currentPath().startsWith("/accounts")) return "accounts";
  if (currentPath().startsWith("/admin")) return "admin";
  return "list";
};

export const routePath = (route: Route): string => {
  if (route === "create") return "/assignments/new";
  if (route === "student") return "/student";
  if (route === "review") return "/review";
  if (route === "export") return "/export";
  if (route === "accounts") return "/accounts";
  if (route === "admin") return "/admin";
  return "/";
};

const stageFromPath = (): Stage => {
  if (currentPath().startsWith("/student/thinking")) return "thinking";
  if (currentPath().startsWith("/student/writing")) return "writing";
  if (currentPath().startsWith("/student/review")) return "review";
  return "reading";
};

export const firstStudent = (state: PilotState): StudentAccount => {
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

export const initialPilotState = (): PilotState => {
  const persisted = loadPersistedState();
  const base = persisted ?? createInitialPilotState();
  if (!currentPath().startsWith("/student")) return base;
  const selectedStudent = selectedStudentFromState(base);
  if (selectedStudent === null) return base;
  const assignment = assignmentsForStudent(base, selectedStudent)[0] ?? requireAssignment(base, base.activeAssignmentId);
  const session = seededSession(assignment, selectedStudent);
  return {
    ...base,
    sessions: [...base.sessions, session]
  };
};

export const stateWithServerSession = (state: PilotState, session: PilotSession): PilotState => {
  const assignments = state.assignments.some((assignment) => assignment.id === session.assignment.id)
    ? state.assignments.map((assignment) => (assignment.id === session.assignment.id ? session.assignment : assignment))
    : [...state.assignments, session.assignment];
  return {
    ...state,
    activeAssignmentId: session.assignment.id,
    assignments,
    selectedActor: { accountId: session.student.accountId ?? session.student.anonymousId, role: "student" },
    sessions: [...state.sessions.filter((item) => item.sessionId !== session.sessionId), session]
  };
};

const actorAccountExists = (state: PilotState, actor: SelectedActor): boolean => {
  if (actor.role === "admin") {
    const adminAuth = loadBrowserAdminAuth();
    return adminAuth?.adminId === actor.accountId;
  }
  if (actor.role === "teacher") {
    const teacherAuth = loadBrowserTeacherAuth();
    if (teacherAuth?.teacherId === actor.accountId) return true;
  }
  if (actor.role === "teacher") return state.teachers.some((teacher) => teacher.id === actor.accountId);
  return state.students.some((student) => student.id === actor.accountId);
};

export const stateWithBrowserActor = (state: PilotState): PilotState => {
  const actorIdentity = loadBrowserActorIdentity();
  if (actorIdentity === null || !actorAccountExists(state, actorIdentity)) return state;
  if (actorIdentity.role === "student" && currentPath().startsWith("/student") && activeSession(state) === null) return state;
  return selectActor(state, actorIdentity);
};

export const stateWithDatabaseRoster = (state: PilotState, roster: DatabaseRoster): PilotState => {
  const students = roster.students;
  const classGroups = roster.classGroups.map((classGroup) => ({
    ...classGroup,
    studentIds: students.filter((student) => student.classGroupId === classGroup.id).map((student) => student.id)
  }));
  const assignments = roster.assignments;
  const activeAssignmentId = assignments.some((assignment) => assignment.id === state.activeAssignmentId)
    ? state.activeAssignmentId
    : assignments[0]?.id ?? "";
  return {
    ...state,
    activeAssignmentId,
    assignments,
    classGroups,
    students,
    teachers: roster.teachers.length === 0 ? state.teachers : roster.teachers
  };
};
