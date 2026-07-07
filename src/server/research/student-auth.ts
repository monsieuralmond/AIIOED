import { z } from "zod";
import { isAssignmentAssignedToStudent } from "../../shared/assignment-access.js";
import type { Assignment, StudentAccount } from "../../shared/types.js";
import { authSupabaseClient } from "./auth-db.js";
import { credentialHash } from "./credentials.js";
import { ApiError } from "./http.js";
import { participantCodeHash } from "./store.js";
import type { AssignmentRow, StudentRow } from "./supabase-session-rows.js";
import { encode } from "./supabase-session-rows.js";

const studentLoginSchema = z.object({
  loginId: z.string().optional().default(""),
  participantCode: z.string().optional().default(""),
  password: z.string().optional().default("")
}).refine((input) => input.participantCode.trim().length > 0 || (input.loginId.trim().length > 0 && input.password.trim().length > 0), {
  message: "Participant code or student credentials are required."
});

type StudentAuthRow = StudentRow & {
  readonly initial_participant_code?: string | null;
};

type StudentAuthResponse = {
  readonly assignments: readonly Assignment[];
  readonly student: Omit<StudentAccount, "password">;
};

const studentNumberFromRow = (student: StudentAuthRow): number => {
  if (student.student_number !== null && student.student_number > 0) return student.student_number;
  const match = /(\d+)$/.exec(student.student_anonymous_id);
  return match?.[1] === undefined ? 1 : Number.parseInt(match[1], 10);
};

const assignmentFromRow = (row: AssignmentRow): Assignment => ({
  ...row.assignment,
  assignedStudentIds: row.assignment.assignedStudentIds ?? [],
  classGroupId: row.class_group_id,
  createdByTeacherId: row.created_by_teacher_id,
  id: row.id,
  researchCondition: row.research_condition,
  researchMode: row.research_mode
});

const participantCodeFromRow = (student: StudentAuthRow, inputCode: string): string => {
  if (student.initial_participant_code !== undefined && student.initial_participant_code !== null) return student.initial_participant_code;
  const trimmedInputCode = inputCode.trim();
  if (trimmedInputCode.length > 0) return trimmedInputCode;
  if (student.id.startsWith("student-")) return student.id.slice("student-".length).toUpperCase();
  return (student.student_anonymous_id ?? student.id).toUpperCase();
};

export const authenticateStudent = async (payload: unknown): Promise<StudentAuthResponse> => {
  const input = studentLoginSchema.parse(payload);
  const db = authSupabaseClient();
  const isParticipantCodeLogin = input.participantCode.trim().length > 0;
  const studentQuery = isParticipantCodeLogin
    ? `select=id,class_group_id,display_label,initial_participant_code,login_id,password_hash,student_anonymous_id,student_number&participant_code_hash=eq.${participantCodeHash(input.participantCode)}&limit=1`
    : `select=id,class_group_id,display_label,initial_participant_code,login_id,password_hash,student_anonymous_id,student_number&login_id=eq.${encode(input.loginId.trim())}&limit=1`;
  const students = await db.get<readonly StudentAuthRow[]>(
    "students",
    studentQuery
  );
  const student = students[0];
  if (student === undefined) throw new ApiError(401, "Student credentials are invalid.");
  if (!isParticipantCodeLogin) {
    if (student.login_id === null || input.loginId.trim().toLowerCase() !== student.login_id.trim().toLowerCase()) {
      throw new ApiError(401, "Student credentials are invalid.");
    }
    if (student.password_hash === null || credentialHash(input.password) !== student.password_hash) {
      throw new ApiError(401, "Student credentials are invalid.");
    }
  }
  const assignments = await db.get<readonly AssignmentRow[]>(
    "assignments",
    `select=id,class_group_id,created_by_teacher_id,research_condition,research_mode,assignment&class_group_id=eq.${encode(student.class_group_id)}&order=created_at.desc`
  );
  const loginId = student.login_id ?? input.loginId.trim();
  const studentAccount = {
    anonymousId: student.student_anonymous_id,
    classGroupId: student.class_group_id,
    displayName: student.display_label ?? loginId,
    id: student.id,
    loginId,
    participantCode: participantCodeFromRow(student, input.participantCode),
    studentNumber: studentNumberFromRow(student)
  };
  return {
    assignments: assignments.map(assignmentFromRow).filter((assignment) => isAssignmentAssignedToStudent(assignment, studentAccount)),
    student: studentAccount
  };
};
