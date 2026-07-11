import { ApiError } from "./http.js";
import type { RosterUpsertInput } from "./schemas.js";
import { inList } from "./supabase-session-rows.js";
import type { SupabaseRestClient } from "./supabase-rest.js";

export type LockedRosterStudent = {
  readonly student_anonymous_id?: string;
};

type LockedSessionRow = {
  readonly session_id: string;
};

const lockedSessionQueryFor = (field: string, values: readonly string[]): string | null =>
  values.length === 0 ? null : `select=session_id&${field}=${inList(values)}&limit=1`;

const lockedSessionExists = async (db: SupabaseRestClient, query: string | null): Promise<boolean> => {
  if (query === null) return false;
  return (await db.get<readonly LockedSessionRow[]>("sessions", query)).length > 0;
};

export const assertNoLockedResearchDataDeletion = async (
  db: SupabaseRestClient,
  input: RosterUpsertInput,
  existingStudents: readonly LockedRosterStudent[]
): Promise<void> => {
  const studentAnonymousIds = existingStudents
    .map((student) => student.student_anonymous_id)
    .filter((id): id is string => id !== undefined && id.length > 0);
  const hasLockedSession = await Promise.all([
    lockedSessionExists(db, lockedSessionQueryFor("assignment_id", input.deletedAssignmentIds)),
    lockedSessionExists(db, lockedSessionQueryFor("class_group_id", input.deletedClassIds)),
    lockedSessionExists(db, lockedSessionQueryFor("student_anonymous_id", studentAnonymousIds))
  ]);
  if (hasLockedSession.some((item) => item)) throw new ApiError(409, "이미 수집된 연구 데이터가 있어 일반 화면에서 삭제할 수 없습니다.");
};
