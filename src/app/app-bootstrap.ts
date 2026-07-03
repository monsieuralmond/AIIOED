import { assignmentsForStudent, createInitialPilotState, createSession, enterStage, requireAssignment, updateDraft, updateOutline } from "../session/session";
import { sampleDraft, sampleOutline } from "../shared/fixtures";
import type { Assignment, PilotSession, PilotState, Stage, StudentAccount } from "../shared/types";
import { loadPersistedState } from "../session/storage";

export type Route = "list" | "create" | "student" | "review" | "export" | "accounts";

export const currentPath = (): string => window.location.pathname;

export const initialRoute = (): Route => {
  if (currentPath().startsWith("/assignments/new")) return "create";
  if (currentPath().startsWith("/student")) return "student";
  if (currentPath().startsWith("/review")) return "review";
  if (currentPath().startsWith("/export")) return "export";
  if (currentPath().startsWith("/accounts")) return "accounts";
  return "list";
};

export const routePath = (route: Route): string => {
  if (route === "create") return "/assignments/new";
  if (route === "student") return "/student";
  if (route === "review") return "/review";
  if (route === "export") return "/export";
  if (route === "accounts") return "/accounts";
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
    selectedActor: { accountId: session.student.anonymousId, role: "student" },
    sessions: [...state.sessions.filter((item) => item.sessionId !== session.sessionId), session]
  };
};
