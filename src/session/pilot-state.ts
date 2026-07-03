import { sampleAssignment, sampleClassGroups, sampleStudents, sampleTeacher, sampleTeachers } from "../shared/fixtures.js";
import type { Assignment, ClassGroup, PilotSession, PilotState, SelectedActor, StudentAccount, StudentWorkStatus, TeacherAccount } from "../shared/types.js";
import { normalizeAssignmentResearchMode } from "./research-session.js";
import { createSession } from "./session.js";

const APP_VERSION = "0.1.0";

type StartedStudentSession = {
  readonly state: PilotState;
  readonly session: PilotSession;
};

export type CreateTeacherInput = {
  readonly displayName: string;
  readonly loginId: string;
  readonly password: string;
};

export type CreateClassGroupInput = {
  readonly name: string;
  readonly teacherId: string;
};

export type CreateStudentInput = {
  readonly classGroupId: string;
  readonly displayName: string;
  readonly loginId: string;
  readonly password: string;
  readonly participantCode: string;
  readonly studentNumber: number;
};

export class PilotStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotStateError";
  }
}

const nowIso = (): string => new Date().toISOString();

export const createInitialPilotState = (): PilotState => ({
  schemaVersion: 1,
  teacher: sampleTeacher,
  teachers: sampleTeachers,
  students: sampleStudents,
  classGroups: sampleClassGroups,
  assignments: [sampleAssignment],
  sessions: [],
  selectedActor: null,
  activeAssignmentId: sampleAssignment.id,
  metadata: {
    appVersion: APP_VERSION,
    createdAt: nowIso()
  }
});

const requireStudent = (state: PilotState, studentId: string): StudentAccount => {
  const student = state.students.find((item) => item.id === studentId);
  if (student === undefined) throw new PilotStateError(`Unknown student: ${studentId}`);
  return student;
};

export const requireAssignment = (state: PilotState, assignmentId: string): Assignment => {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (assignment === undefined) throw new PilotStateError(`Unknown assignment: ${assignmentId}`);
  return assignment;
};

export const assignmentsForStudent = (state: PilotState, student: StudentAccount): readonly Assignment[] =>
  state.assignments.filter((assignment) => assignment.classGroupId === undefined || assignment.classGroupId === student.classGroupId);

const normalizeParticipantCode = (code: string): string => code.trim().toUpperCase();
const normalizeLoginId = (loginId: string): string => loginId.trim().toLowerCase();
const requiredText = (value: string, message: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new PilotStateError(message);
  return trimmed;
};

const slug = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized.length === 0) throw new PilotStateError("식별자를 만들 수 없습니다.");
  return normalized;
};

const uniqueId = (base: string, existingIds: readonly string[]): string => {
  if (!existingIds.includes(base)) return base;
  let next = 2;
  while (existingIds.includes(`${base}-${next}`)) next += 1;
  return `${base}-${next}`;
};

export const studentByParticipantCode = (state: PilotState, code: string): StudentAccount | null => {
  const normalized = normalizeParticipantCode(code);
  return state.students.find((student) => student.participantCode === normalized) ?? null;
};

export const studentByCredentials = (state: PilotState, loginId: string, password: string): StudentAccount | null => {
  const normalized = normalizeLoginId(loginId);
  return state.students.find((student) => normalizeLoginId(student.loginId) === normalized && student.password === password) ?? null;
};

export const teacherByCredentials = (state: PilotState, loginId: string, password: string): TeacherAccount | null => {
  const normalized = normalizeLoginId(loginId);
  return state.teachers.find((teacher) => normalizeLoginId(teacher.loginId) === normalized && teacher.password === password) ?? null;
};

export const createTeacherAccount = (state: PilotState, input: CreateTeacherInput): PilotState => {
  const displayName = requiredText(input.displayName, "교사 이름을 입력하세요.");
  const loginId = normalizeLoginId(requiredText(input.loginId, "교사 아이디를 입력하세요."));
  const password = requiredText(input.password, "교사 비밀번호를 입력하세요.");
  if (state.teachers.some((teacher) => normalizeLoginId(teacher.loginId) === loginId)) throw new PilotStateError("이미 있는 교사 아이디입니다.");
  const id = uniqueId(`teacher-${slug(loginId)}`, state.teachers.map((teacher) => teacher.id));
  return {
    ...state,
    teachers: [...state.teachers, { id, displayName, loginId, password }]
  };
};

export const createClassGroup = (state: PilotState, input: CreateClassGroupInput): PilotState => {
  const name = requiredText(input.name, "반 이름을 입력하세요.");
  if (!state.teachers.some((teacher) => teacher.id === input.teacherId)) throw new PilotStateError("담당 교사를 찾을 수 없습니다.");
  if (state.classGroups.some((classGroup) => classGroup.name === name)) throw new PilotStateError("이미 있는 반 이름입니다.");
  const id = uniqueId(`class-${slug(name)}`, state.classGroups.map((classGroup) => classGroup.id));
  const classGroup: ClassGroup = { id, name, teacherId: input.teacherId, studentIds: [] };
  return {
    ...state,
    classGroups: [...state.classGroups, classGroup]
  };
};

export const createStudentAccount = (state: PilotState, input: CreateStudentInput): PilotState => {
  const displayName = requiredText(input.displayName, "학생 이름을 입력하세요.");
  const loginId = normalizeLoginId(requiredText(input.loginId, "학생 아이디를 입력하세요."));
  const password = requiredText(input.password, "학생 비밀번호를 입력하세요.");
  const participantCode = normalizeParticipantCode(requiredText(input.participantCode, "참여자 코드를 입력하세요."));
  if (!Number.isInteger(input.studentNumber) || input.studentNumber <= 0) throw new PilotStateError("학생 번호는 1 이상의 정수여야 합니다.");
  const classGroup = state.classGroups.find((item) => item.id === input.classGroupId);
  if (classGroup === undefined) throw new PilotStateError("반을 찾을 수 없습니다.");
  if (state.students.some((student) => normalizeLoginId(student.loginId) === loginId)) throw new PilotStateError("이미 있는 학생 아이디입니다.");
  if (state.students.some((student) => student.participantCode === participantCode)) throw new PilotStateError("이미 있는 참여자 코드입니다.");
  if (state.students.some((student) => student.classGroupId === input.classGroupId && student.studentNumber === input.studentNumber)) throw new PilotStateError("같은 반에 이미 있는 번호입니다.");
  const id = uniqueId(`student-${slug(participantCode)}`, state.students.map((student) => student.id));
  const student: StudentAccount = {
    classGroupId: input.classGroupId,
    displayName,
    id,
    loginId,
    participantCode,
    password,
    studentNumber: input.studentNumber
  };
  return {
    ...state,
    classGroups: state.classGroups.map((item) => (item.id === input.classGroupId ? { ...item, studentIds: [...item.studentIds, student.id] } : item)),
    students: [...state.students, student]
  };
};

export const selectActor = (state: PilotState, actor: SelectedActor | null): PilotState => ({
  ...state,
  selectedActor: actor
});

export const saveAssignmentInState = (state: PilotState, assignment: Assignment): PilotState => {
  const normalizedAssignment = normalizeAssignmentResearchMode(assignment);
  const existingIndex = state.assignments.findIndex((item) => item.id === normalizedAssignment.id);
  const assignments =
    existingIndex === -1
      ? [...state.assignments, normalizedAssignment]
      : state.assignments.map((item) => (item.id === normalizedAssignment.id ? normalizedAssignment : item));
  return {
    ...state,
    assignments,
    activeAssignmentId: normalizedAssignment.id
  };
};

export const startStudentSession = (state: PilotState, studentId: string, assignmentId: string): StartedStudentSession => {
  const student = requireStudent(state, studentId);
  const assignment = requireAssignment(state, assignmentId);
  const session = createSession(assignment, student);
  return {
    session,
    state: {
      ...state,
      activeAssignmentId: assignmentId,
      sessions: [...state.sessions, session]
    }
  };
};

export const updatePilotSession = (state: PilotState, session: PilotSession): PilotState => {
  const existing = state.sessions.find((item) => item.sessionId === session.sessionId);
  if (existing === undefined) throw new PilotStateError(`Unknown session: ${session.sessionId}`);
  return {
    ...state,
    activeAssignmentId: session.assignment.id,
    sessions: state.sessions.map((item) => (item.sessionId === session.sessionId ? session : item))
  };
};

export const sessionForStudent = (state: PilotState, studentId: string, assignmentId: string): PilotSession | null =>
  [...state.sessions].reverse().find((session) => session.assignment.id === assignmentId && session.student.accountId === studentId) ?? null;

export const activeSession = (state: PilotState): PilotSession | null => {
  const selected = state.selectedActor;
  if (selected?.role === "student") {
    return [...state.sessions].reverse().find((session) => session.assignment.id === state.activeAssignmentId && (session.student.accountId === selected.accountId || session.student.anonymousId === selected.accountId)) ?? null;
  }
  return [...state.sessions].reverse().find((session) => session.assignment.id === state.activeAssignmentId) ?? null;
};

export const sessionStatus = (state: PilotState, studentId: string, assignmentId: string): StudentWorkStatus => {
  const session = sessionForStudent(state, studentId, assignmentId);
  if (session === null) return "not_started";
  if (session.finalSubmission !== null || session.status === "submitted" || session.status === "completed") return "submitted";
  return "in_progress";
};
