import type { Assignment, ClassGroup, PilotSession, PilotState, SelectedActor, Stage, StudentAccount, TeacherAccount, TeacherReviewNote, TeacherReviewStatus } from "../shared/types";
import { TEACHER_LOGIN_ID, TEACHER_PASSWORD } from "./access";

const STORAGE_KEY = "reading-coach-lab:v1";
const DEFAULT_TEACHER_ID = "teacher-research";
const LEGACY_TEACHER_LOGIN_ID = "teacher";
const LEGACY_TEACHER_PASSWORD = "TEACHER-PILOT-2026";

type PersistedState = PilotState;

type PersistedPilotSession = Omit<PilotSession, "teacherReview"> & {
  readonly teacherReview?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isStage = (value: unknown): value is Stage => value === "reading" || value === "thinking" || value === "writing" || value === "review";

const isTeacherReviewStatus = (value: unknown): value is TeacherReviewStatus => value === "not_reviewed" || value === "needs_follow_up" || value === "reviewed";

const isAssignmentMode = (value: unknown): value is Assignment["assignmentMode"] => value === undefined || value === "full_process" || value === "revision_feedback";

const isStringArray = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every(isString);

const isAssignment = (value: unknown): value is Assignment => {
  if (!isRecord(value)) return false;
  return (
    isString(value["id"]) &&
    isString(value["title"]) &&
    isString(value["passage"]) &&
    isString(value["question"]) &&
    isString(value["gradeLevel"]) &&
    isString(value["targetLength"]) &&
    isAssignmentMode(value["assignmentMode"]) &&
    (value["essayType"] === undefined || isString(value["essayType"])) &&
    (value["minimumWordCount"] === undefined || isString(value["minimumWordCount"])) &&
    (value["requirements"] === undefined || isStringArray(value["requirements"])) &&
    (value["sourceGuidance"] === undefined || isString(value["sourceGuidance"])) &&
    (value["startTime"] === undefined || isString(value["startTime"])) &&
    (value["dueTime"] === undefined || isString(value["dueTime"]))
  );
};

const parseTeacher = (value: unknown): TeacherAccount | null => {
  if (!isRecord(value)) return null;
  if (!isString(value["id"]) || !isString(value["displayName"])) return null;
  const teacher = {
    displayName: value["displayName"],
    id: value["id"],
    loginId: isString(value["loginId"]) ? value["loginId"] : TEACHER_LOGIN_ID,
    password: isString(value["password"]) ? value["password"] : TEACHER_PASSWORD
  };
  if (teacher.id === DEFAULT_TEACHER_ID && teacher.loginId === LEGACY_TEACHER_LOGIN_ID && teacher.password === LEGACY_TEACHER_PASSWORD) {
    return { ...teacher, loginId: TEACHER_LOGIN_ID, password: TEACHER_PASSWORD };
  }
  return teacher;
};

const parseStudents = (value: unknown): readonly StudentAccount[] | null => {
  if (!Array.isArray(value)) return null;
  const students: StudentAccount[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) return null;
    if (!isString(item["id"]) || !isString(item["displayName"]) || !isString(item["classGroupId"]) || !isString(item["participantCode"])) return null;
    const studentNumber = typeof item["studentNumber"] === "number" && Number.isInteger(item["studentNumber"]) ? item["studentNumber"] : index + 1;
    const loginId = isString(item["loginId"]) ? item["loginId"] : item["participantCode"].toLowerCase();
    const password = isString(item["password"]) ? item["password"] : item["participantCode"];
    students.push({
      classGroupId: item["classGroupId"],
      displayName: item["displayName"],
      id: item["id"],
      loginId,
      participantCode: item["participantCode"],
      password,
      studentNumber
    });
  }
  return students;
};

const isClassGroup = (value: unknown): value is ClassGroup => {
  if (!isRecord(value)) return false;
  return isString(value["id"]) && isString(value["name"]) && isString(value["teacherId"]) && Array.isArray(value["studentIds"]) && value["studentIds"].every(isString);
};

const isSelectedActor = (value: unknown): value is SelectedActor => {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (value["role"] === "teacher" || value["role"] === "student") && isString(value["accountId"]);
};

const isStudent = (value: unknown): value is PilotSession["student"] => {
  if (!isRecord(value)) return false;
  return isString(value["anonymousId"]) && (value["accountId"] === undefined || isString(value["accountId"])) && (value["displayName"] === undefined || isString(value["displayName"]));
};

const isMetadata = (value: unknown): value is PilotSession["metadata"] => {
  if (!isRecord(value)) return false;
  return isString(value["appVersion"]) && isString(value["llmMode"]) && isString(value["model"]) && isString(value["createdAt"]);
};

const isFinalSubmission = (value: unknown): value is PilotSession["finalSubmission"] => {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return isString(value["text"]) && isString(value["submittedAt"]);
};

const defaultTeacherReview = (updatedAt: string): TeacherReviewNote => ({
  note: "",
  status: "not_reviewed",
  updatedAt,
  updatedByTeacherId: null
});

const parseTeacherReview = (value: unknown, fallbackUpdatedAt: string): TeacherReviewNote | null => {
  if (value === undefined) return defaultTeacherReview(fallbackUpdatedAt);
  if (!isRecord(value)) return null;
  const updatedByTeacherId = value["updatedByTeacherId"];
  if (!isTeacherReviewStatus(value["status"]) || !isString(value["note"]) || !isString(value["updatedAt"])) return null;
  if (updatedByTeacherId !== null && !isString(updatedByTeacherId)) return null;
  return {
    note: value["note"],
    status: value["status"],
    updatedAt: value["updatedAt"],
    updatedByTeacherId
  };
};

const isPersistedPilotSession = (value: unknown): value is PersistedPilotSession => {
  if (!isRecord(value)) return false;
  return (
    isString(value["sessionId"]) &&
    isAssignment(value["assignment"]) &&
    isStudent(value["student"]) &&
    isStage(value["currentStage"]) &&
    Array.isArray(value["events"]) &&
    Array.isArray(value["chatTurns"]) &&
    Array.isArray(value["outlineSnapshots"]) &&
    Array.isArray(value["draftSnapshots"]) &&
    Array.isArray(value["pasteEvents"]) &&
    isFinalSubmission(value["finalSubmission"]) &&
    isMetadata(value["metadata"])
  );
};

const parsePilotSession = (value: unknown): PilotSession | null => {
  if (!isPersistedPilotSession(value)) return null;
  const teacherReview = parseTeacherReview(value.teacherReview, value.metadata.createdAt);
  if (teacherReview === null) return null;
  return { ...value, teacherReview };
};

const parseSessions = (value: unknown): readonly PilotSession[] | null => {
  if (!Array.isArray(value)) return null;
  const sessions: PilotSession[] = [];
  for (const item of value) {
    const session = parsePilotSession(item);
    if (session === null) return null;
    sessions.push(session);
  }
  return sessions;
};

const parseTeachers = (value: unknown, primaryTeacher: TeacherAccount): readonly TeacherAccount[] | null => {
  if (value === undefined) return [primaryTeacher];
  if (!Array.isArray(value)) return null;
  const teachers: TeacherAccount[] = [];
  for (const item of value) {
    const teacher = parseTeacher(item);
    if (teacher === null) return null;
    teachers.push(teacher);
  }
  return teachers.some((teacher) => teacher.id === primaryTeacher.id) ? teachers : [primaryTeacher, ...teachers];
};

const parsePersistedState = (value: unknown): PersistedState | null => {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== 1) return null;
  const teacher = parseTeacher(value["teacher"]);
  if (teacher === null) return null;
  const teachers = parseTeachers(value["teachers"], teacher);
  if (teachers === null) return null;
  const students = parseStudents(value["students"]);
  if (students === null) return null;
  if (!Array.isArray(value["classGroups"]) || !value["classGroups"].every(isClassGroup)) return null;
  if (!Array.isArray(value["assignments"]) || !value["assignments"].every(isAssignment)) return null;
  const sessions = parseSessions(value["sessions"]);
  if (sessions === null) return null;
  if (!isSelectedActor(value["selectedActor"])) return null;
  if (!isString(value["activeAssignmentId"])) return null;
  if (value["activeSessionId"] !== null && !isString(value["activeSessionId"])) return null;
  if (!isRecord(value["metadata"]) || !isString(value["metadata"]["appVersion"]) || !isString(value["metadata"]["createdAt"])) return null;
  return {
    activeAssignmentId: value["activeAssignmentId"],
    activeSessionId: value["activeSessionId"],
    assignments: value["assignments"],
    classGroups: value["classGroups"],
    metadata: {
      appVersion: value["metadata"]["appVersion"],
      createdAt: value["metadata"]["createdAt"]
    },
    schemaVersion: 1,
    selectedActor: value["selectedActor"],
    sessions,
    students,
    teacher,
    teachers
  };
};

export const loadPersistedState = (): PersistedState | null => {
  if (typeof window.localStorage.getItem !== "function") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsePersistedState(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
};

export const savePersistedState = (state: PersistedState): void => {
  if (typeof window.localStorage.setItem !== "function") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
