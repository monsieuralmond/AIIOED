import type { Assignment, ClassGroup, StudentAccount, TeacherAccount } from "../shared/types.js";

export type DatabaseRoster = {
  readonly assignments: readonly Assignment[];
  readonly classGroups: readonly ClassGroup[];
  readonly rosterRevision?: string;
  readonly students: readonly StudentAccount[];
  readonly teachers: readonly TeacherAccount[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const requiredString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Roster field ${key} is missing.`);
  return value;
};

const optionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const isAssignment = (value: unknown): value is Assignment => {
  if (!isRecord(value)) return false;
  return typeof value["id"] === "string" &&
    typeof value["title"] === "string" &&
    typeof value["passage"] === "string" &&
    typeof value["question"] === "string" &&
    typeof value["gradeLevel"] === "string" &&
    typeof value["targetLength"] === "string";
};

const participantCodeFromStudentId = (studentId: string, anonymousId: string): string => {
  if (studentId.startsWith("student-")) return studentId.slice("student-".length).toUpperCase();
  return anonymousId.toUpperCase();
};

const studentNumberFromRecord = (record: Record<string, unknown>, fallbackIndex: number): number => {
  const numberValue = record["studentNumber"];
  if (typeof numberValue === "number" && Number.isInteger(numberValue) && numberValue > 0) return numberValue;
  const anonymousId = optionalString(record, "studentAnonymousId") ?? "";
  const match = /(\d+)$/.exec(anonymousId);
  if (match?.[1] !== undefined) return Number.parseInt(match[1], 10);
  return fallbackIndex + 1;
};

const parseRosterAssignment = (value: unknown): Assignment => {
  if (!isRecord(value) || !isAssignment(value["payload"])) throw new Error("Roster assignment payload is invalid.");
  return value["payload"];
};

const parseRosterStudent = (value: unknown, index: number): StudentAccount => {
  if (!isRecord(value)) throw new Error("Roster student payload is invalid.");
  const id = requiredString(value, "id");
  const classGroupId = requiredString(value, "classGroupId");
  const studentAnonymousId = requiredString(value, "studentAnonymousId");
  const participantCode = optionalString(value, "participantCode") ?? participantCodeFromStudentId(id, studentAnonymousId);
  const loginId = optionalString(value, "loginId") ?? participantCode.toLowerCase();
  return {
    anonymousId: studentAnonymousId,
    classGroupId,
    displayName: optionalString(value, "displayLabel") ?? loginId,
    id,
    loginId,
    participantCode,
    password: optionalString(value, "password") ?? "",
    studentNumber: studentNumberFromRecord(value, index)
  };
};

const parseRosterTeacher = (value: unknown): TeacherAccount => {
  if (!isRecord(value)) throw new Error("Roster teacher payload is invalid.");
  const loginId = requiredString(value, "loginId");
  return {
    displayName: optionalString(value, "displayName") ?? loginId,
    id: requiredString(value, "id"),
    loginId,
    password: optionalString(value, "password") ?? ""
  };
};

export const parseDatabaseRoster = (value: unknown): DatabaseRoster => {
  if (!isRecord(value) || !Array.isArray(value["assignments"]) || !Array.isArray(value["classes"]) || !Array.isArray(value["students"])) {
    throw new Error("DB roster 응답 형식이 올바르지 않습니다.");
  }
  const students = value["students"].map(parseRosterStudent);
  const classGroups = value["classes"].map((item): ClassGroup => {
    if (!isRecord(item)) throw new Error("Roster class payload is invalid.");
    const id = requiredString(item, "id");
    return {
      id,
      name: requiredString(item, "name"),
      studentIds: students.filter((student) => student.classGroupId === id).map((student) => student.id),
      teacherId: requiredString(item, "teacherId")
    };
  });
  return {
    assignments: value["assignments"].map(parseRosterAssignment),
    classGroups,
    ...(typeof value["rosterRevision"] === "string" ? { rosterRevision: value["rosterRevision"] } : {}),
    students,
    teachers: Array.isArray(value["teachers"]) ? value["teachers"].map(parseRosterTeacher) : []
  };
};
