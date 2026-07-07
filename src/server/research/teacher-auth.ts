import { z } from "zod";
import { authSupabaseClient } from "./auth-db.js";
import { credentialHash } from "./credentials.js";
import { ApiError } from "./http.js";
import { issueTeacherToken } from "./auth.js";
import { encode } from "./supabase-session-rows.js";

const teacherLoginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1)
});

type TeacherRow = {
  readonly display_name: string;
  readonly id: string;
  readonly login_id: string;
  readonly password_hash: string;
};

export const authenticateTeacher = async (payload: unknown): Promise<{
  readonly displayName: string;
  readonly teacherId: string;
  readonly teacherToken: string;
}> => {
  const input = teacherLoginSchema.parse(payload);
  const db = authSupabaseClient();
  const rows = await db.get<readonly TeacherRow[]>("teachers", `select=id,display_name,login_id,password_hash&login_id=eq.${encode(input.loginId)}&limit=1`);
  const teacher = rows[0];
  if (teacher === undefined || teacher.password_hash !== credentialHash(input.password)) throw new ApiError(401, "Teacher login failed.");
  return {
    displayName: teacher.display_name,
    teacherId: teacher.id,
    teacherToken: issueTeacherToken(teacher.id)
  };
};
