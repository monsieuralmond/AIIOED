import { z } from "zod";
import { credentialHash } from "./credentials.js";
import { researchServerEnv } from "./env.js";
import { ApiError } from "./http.js";
import { issueTeacherToken } from "./auth.js";
import { encode } from "./supabase-session-rows.js";
import { SupabaseRestClient } from "./supabase-rest.js";

const teacherLoginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1)
});

type TeacherRow = {
  readonly display_name: string;
  readonly id: string;
  readonly initial_password?: string | null;
  readonly login_id: string;
  readonly password_hash: string;
};

export const authenticateTeacher = async (payload: unknown): Promise<{
  readonly displayName: string;
  readonly teacherId: string;
  readonly teacherToken: string;
}> => {
  const input = teacherLoginSchema.parse(payload);
  const env = researchServerEnv();
  const db = new SupabaseRestClient({ serviceRoleKey: env.supabaseServiceRoleKey, url: env.supabaseUrl });
  const rows = await db.get<readonly TeacherRow[]>("teachers", `select=id,display_name,initial_password,login_id,password_hash&login_id=eq.${encode(input.loginId)}&limit=1`);
  const teacher = rows[0];
  if (teacher === undefined || teacher.password_hash !== credentialHash(input.password)) throw new ApiError(401, "Teacher login failed.");
  if (teacher.initial_password !== input.password) {
    await db.patch("teachers", `id=eq.${encode(teacher.id)}`, { initial_password: input.password });
  }
  return {
    displayName: teacher.display_name,
    teacherId: teacher.id,
    teacherToken: issueTeacherToken(teacher.id)
  };
};
