import type { RosterUpsertInput } from "./schemas.js";
import { inList } from "./supabase-session-rows.js";
import type { SupabaseRestClient } from "./supabase-rest.js";

export const sanitizedRosterSnapshot = (input: RosterUpsertInput): Record<string, unknown> => ({
  assignments: input.assignments,
  classes: input.classes,
  deletedAssignmentIds: input.deletedAssignmentIds,
  deletedClassIds: input.deletedClassIds,
  deletedStudentIds: input.deletedStudentIds,
  deletedTeacherIds: input.deletedTeacherIds,
  students: input.students.map((student) => ({
    classGroupId: student.classGroupId,
    displayLabel: student.displayLabel ?? null,
    id: student.id,
    loginId: student.loginId ?? null,
    studentAnonymousId: student.studentAnonymousId,
    studentNumber: student.studentNumber ?? null
  })),
  teacherId: input.teacherId ?? null,
  teachers: input.teachers.map((teacher) => ({
    displayName: teacher.displayName,
    id: teacher.id,
    loginId: teacher.loginId
  }))
});

const deleteByIds = async (db: SupabaseRestClient, table: string, ids: readonly string[]): Promise<void> => {
  if (ids.length === 0) return;
  await db.delete(table, `id=${inList(ids)}`);
};

const deleteStudentsInClasses = async (db: SupabaseRestClient, classIds: readonly string[]): Promise<void> => {
  if (classIds.length === 0) return;
  await db.delete("students", `class_group_id=${inList(classIds)}`);
};

export const deleteRosterRows = async (db: SupabaseRestClient, input: RosterUpsertInput): Promise<void> => {
  await Promise.all([
    deleteByIds(db, "students", input.deletedStudentIds),
    deleteStudentsInClasses(db, input.deletedClassIds),
    deleteByIds(db, "assignments", input.deletedAssignmentIds)
  ]);
  await deleteByIds(db, "classes", input.deletedClassIds);
  await deleteByIds(db, "teachers", input.deletedTeacherIds);
};
