import { z } from "zod";
import type { Assignment, StudentAccount } from "../../shared/types.js";
import { credentialHash } from "./credentials.js";
import { researchServerEnv } from "./env.js";
import { ApiError } from "./http.js";
import { participantCodeHash } from "./store.js";
import type { AssignmentRow, StudentRow } from "./supabase-session-rows.js";
import { encode } from "./supabase-session-rows.js";
import { SupabaseRestClient } from "./supabase-rest.js";

const studentLoginSchema = z.object({
  loginId: z.string().min(1),
  participantCode: z.string().min(1),
  password: z.string().min(1)
});

type StudentAuthRow = StudentRow & {
  readonly initial_participant_code?: string | null;
  readonly initial_password?: string | null;
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
  classGroupId: row.class_group_id,
  createdByTeacherId: row.created_by_teacher_id,
  id: row.id,
  researchCondition: row.research_condition,
  researchMode: row.research_mode
});

export const authenticateStudent = async (payload: unknown): Promise<StudentAuthResponse> => {
  const input = studentLoginSchema.parse(payload);
  const env = researchServerEnv();
  const db = new SupabaseRestClient({ serviceRoleKey: env.supabaseServiceRoleKey, url: env.supabaseUrl });
  const students = await db.get<readonly StudentAuthRow[]>(
    "students",
    `select=id,class_group_id,display_label,initial_participant_code,initial_password,login_id,password_hash,student_anonymous_id,student_number&participant_code_hash=eq.${participantCodeHash(input.participantCode)}&limit=1`
  );
  const student = students[0];
  if (student === undefined) throw new ApiError(401, "Student credentials are invalid.");
  if (student.login_id !== null && input.loginId.trim().toLowerCase() !== student.login_id.trim().toLowerCase()) {
    throw new ApiError(401, "Student credentials are invalid.");
  }
  if (student.password_hash !== null && credentialHash(input.password) !== student.password_hash) {
    throw new ApiError(401, "Student credentials are invalid.");
  }
  const assignments = await db.get<readonly AssignmentRow[]>(
    "assignments",
    `select=id,class_group_id,created_by_teacher_id,research_condition,research_mode,assignment&class_group_id=eq.${encode(student.class_group_id)}&order=created_at.desc`
  );
  const loginId = student.login_id ?? input.loginId.trim();
  return {
    assignments: assignments.map(assignmentFromRow),
    student: {
      classGroupId: student.class_group_id,
      displayName: student.display_label ?? loginId,
      id: student.id,
      loginId,
      participantCode: student.initial_participant_code ?? input.participantCode.trim(),
      studentNumber: studentNumberFromRow(student)
    }
  };
};
