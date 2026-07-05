import { createHash } from "node:crypto";
import { researchServerEnv } from "./env.js";
import type { JsonHandler } from "./http.js";
import { ApiError } from "./http.js";
import { rosterLoadSchema, rosterUpsertSchema } from "./schemas.js";
import type { RosterUpsertInput } from "./schemas.js";
import { credentialHash } from "./credentials.js";
import { participantCodeHash } from "./store.js";
import { encode, inList } from "./supabase-session-rows.js";
import { SupabaseRestClient } from "./supabase-rest.js";
import { assertNoLockedResearchDataDeletion } from "./roster-locked-sessions.js";
import { deleteRosterRows, sanitizedRosterSnapshot } from "./roster-snapshot.js";
import type { RosterAssignmentRow, RosterClassRow, RosterStudentRow, RosterTeacherRow } from "./roster-row-types.js";

const rosterDb = (): SupabaseRestClient => {
  const env = researchServerEnv();
  return new SupabaseRestClient({ serviceRoleKey: env.supabaseServiceRoleKey, url: env.supabaseUrl });
};

const teacherIdForRoster = (input: RosterUpsertInput): string | null =>
  input.teacherId ?? input.teachers[0]?.id ?? input.classes[0]?.teacherId ?? input.assignments[0]?.createdByTeacherId ?? null;

type RosterScope = {
  readonly assignmentIds: ReadonlySet<string>;
  readonly classIds: ReadonlySet<string>;
  readonly revision: string;
};

type RosterTeacherInput = RosterUpsertInput["teachers"][number];
type RosterStudentInput = RosterUpsertInput["students"][number];

const unique = (values: readonly string[]): readonly string[] => [...new Set(values.filter((value) => value.length > 0))];

const hasProvidedPassword = <T extends { readonly password?: string | undefined }>(item: T): item is T & { readonly password: string } =>
  item.password !== undefined && item.password.length > 0;

const teacherPatchBody = (item: RosterTeacherInput): Record<string, string> => ({
  display_name: item.displayName,
  login_id: item.loginId
});

const studentPatchBody = (item: RosterStudentInput): Record<string, number | string | null> => ({
  class_group_id: item.classGroupId,
  display_label: item.displayLabel ?? null,
  login_id: item.loginId ?? null,
  participant_code_hash: participantCodeHash(item.participantCode),
  student_anonymous_id: item.studentAnonymousId,
  student_number: item.studentNumber ?? null
});

const rowsByIds = async <T>(db: SupabaseRestClient, table: string, columns: string, ids: readonly string[]): Promise<readonly T[]> => {
  const uniqueIds = unique(ids);
  if (uniqueIds.length === 0) return [];
  return db.get<readonly T[]>(table, `select=${columns}&id=${inList(uniqueIds)}`);
};

const revisionHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const rosterScopeForTeacher = async (db: SupabaseRestClient, teacherId: string): Promise<RosterScope> => {
  const [classes, assignments, teachers] = await Promise.all([
    db.get<readonly RosterClassRow[]>("classes", `select=id,teacher_id,updated_at&teacher_id=eq.${encode(teacherId)}&order=id.asc`),
    db.get<readonly RosterAssignmentRow[]>("assignments", `select=id,created_by_teacher_id,updated_at&created_by_teacher_id=eq.${encode(teacherId)}&order=id.asc`),
    db.get<readonly RosterTeacherRow[]>("teachers", "select=id,updated_at&order=id.asc")
  ]);
  const classIds = classes.map((classGroup) => classGroup.id);
  const students = classIds.length === 0
    ? []
    : await db.get<readonly RosterStudentRow[]>("students", `select=id,class_group_id,updated_at&class_group_id=${inList(classIds)}&order=id.asc`);
  return {
    assignmentIds: new Set(assignments.map((assignment) => assignment.id)),
    classIds: new Set(classIds),
    revision: revisionHash({ assignments, classes, students, teachers })
  };
};

const assertEveryOwned = (ids: readonly string[], ownedIds: ReadonlySet<string>, entityName: string): void => {
  const foreignId = ids.find((id) => !ownedIds.has(id));
  if (foreignId !== undefined) throw new ApiError(403, `${entityName} does not belong to this teacher: ${foreignId}`);
};

const validateRosterOwnership = async (db: SupabaseRestClient, input: RosterUpsertInput, teacherId: string, scope: RosterScope): Promise<void> => {
  if (input.expectedRosterRevision !== undefined && input.expectedRosterRevision !== scope.revision) {
    throw new ApiError(409, "Roster changed on the server. Reload before saving again.");
  }

  const incomingClassIds = input.classes.map((classGroup) => classGroup.id);
  const allowedClassIds = new Set([...scope.classIds, ...incomingClassIds]);
  const existingClasses = await rowsByIds<RosterClassRow>(db, "classes", "id,teacher_id", [...incomingClassIds, ...input.deletedClassIds]);
  const foreignClass = existingClasses.find((classGroup) => classGroup.teacher_id !== teacherId);
  if (foreignClass !== undefined) throw new ApiError(403, `Class does not belong to this teacher: ${foreignClass.id}`);
  assertEveryOwned(input.deletedClassIds, scope.classIds, "Class");

  const incomingAssignmentIds = input.assignments.map((assignment) => assignment.id);
  const existingAssignments = await rowsByIds<RosterAssignmentRow>(db, "assignments", "id,created_by_teacher_id", [...incomingAssignmentIds, ...input.deletedAssignmentIds]);
  const foreignAssignment = existingAssignments.find((assignment) => assignment.created_by_teacher_id !== teacherId);
  if (foreignAssignment !== undefined) throw new ApiError(403, `Assignment does not belong to this teacher: ${foreignAssignment.id}`);
  assertEveryOwned(input.deletedAssignmentIds, scope.assignmentIds, "Assignment");

  const invalidAssignmentClass = input.assignments.find((assignment) => assignment.classGroupId !== undefined && !allowedClassIds.has(assignment.classGroupId));
  if (invalidAssignmentClass !== undefined) throw new ApiError(403, `Assignment class does not belong to this teacher: ${invalidAssignmentClass.id}`);

  const incomingStudentIds = input.students.map((student) => student.id);
  const existingStudents = await rowsByIds<RosterStudentRow>(db, "students", "id,class_group_id,student_anonymous_id", [...incomingStudentIds, ...input.deletedStudentIds]);
  const foreignStudent = existingStudents.find((student) => !scope.classIds.has(student.class_group_id));
  if (foreignStudent !== undefined) throw new ApiError(403, `Student does not belong to this teacher: ${foreignStudent.id}`);

  const invalidStudentClass = input.students.find((student) => !allowedClassIds.has(student.classGroupId));
  if (invalidStudentClass !== undefined) throw new ApiError(403, `Student class does not belong to this teacher: ${invalidStudentClass.id}`);

  await assertNoLockedResearchDataDeletion(db, input, existingStudents);
};

export const loadRoster: JsonHandler = async (payload) => {
  const input = rosterLoadSchema.parse(payload);
  const db = rosterDb();
  const teacherFilter = input.teacherId === undefined ? "" : `&teacher_id=eq.${encode(input.teacherId)}`;
  const assignmentTeacherFilter = input.teacherId === undefined ? "" : `&created_by_teacher_id=eq.${encode(input.teacherId)}`;
  const [classes, assignments, teachers] = await Promise.all([
    db.get<readonly RosterClassRow[]>("classes", `select=id,name,teacher_id${teacherFilter}`),
    db.get<readonly RosterAssignmentRow[]>("assignments", `select=id,class_group_id,created_by_teacher_id,title,research_mode,research_condition,assignment${assignmentTeacherFilter}`),
    db.get<readonly RosterTeacherRow[]>("teachers", "select=id,display_name,initial_password,login_id&order=id.asc")
  ]);
  const classIds = classes.map((classGroup) => classGroup.id);
  const students = input.teacherId === undefined
    ? await db.get<readonly RosterStudentRow[]>("students", "select=id,class_group_id,display_label,initial_participant_code,initial_password,login_id,student_anonymous_id,student_number")
    : classIds.length === 0
      ? []
      : await db.get<readonly RosterStudentRow[]>(`students`, `select=id,class_group_id,display_label,initial_participant_code,initial_password,login_id,student_anonymous_id,student_number&class_group_id=${inList(classIds)}`);
  const roster = rosterUpsertSchema.parse({
    assignments: assignments.map((assignment) => ({
      createdByTeacherId: assignment.created_by_teacher_id,
      id: assignment.id,
      payload: assignment.assignment ?? {},
      researchCondition: assignment.research_condition ?? "single_group_baseline",
      researchMode: assignment.research_mode ?? "writing_coach",
      title: assignment.title ?? assignment.id,
      ...(assignment.class_group_id === null ? {} : { classGroupId: assignment.class_group_id })
    })),
    classes: classes.map((classGroup) => ({
      id: classGroup.id,
      name: classGroup.name,
      teacherId: classGroup.teacher_id
    })),
    students: students.map((student) => ({
      classGroupId: student.class_group_id,
      displayLabel: student.display_label ?? undefined,
      id: student.id,
      loginId: student.login_id ?? undefined,
      participantCode: student.initial_participant_code ?? (student.id.startsWith("student-") ? student.id.slice("student-".length).toUpperCase() : (student.student_anonymous_id ?? student.id).toUpperCase()),
      ...(student.initial_password === undefined || student.initial_password === null ? {} : { password: student.initial_password }),
      studentAnonymousId: student.student_anonymous_id ?? student.id,
      studentNumber: student.student_number ?? undefined
    })),
    teachers: teachers.map((teacher) => ({
      displayName: teacher.display_name ?? teacher.id,
      id: teacher.id,
      loginId: teacher.login_id ?? teacher.id,
      ...(teacher.initial_password === undefined || teacher.initial_password === null ? {} : { password: teacher.initial_password })
    }))
  });
  const scope = input.teacherId === undefined ? null : await rosterScopeForTeacher(db, input.teacherId);
  return {
    ...roster,
    ...(scope === null ? {} : { rosterRevision: scope.revision })
  };
};

export const upsertRoster: JsonHandler = async (payload) => {
  const input = rosterUpsertSchema.parse(payload);
  const db = rosterDb();
  const teacherId = teacherIdForRoster(input);
  if (teacherId === null) throw new ApiError(401, "Teacher authorization is required.");
  const scope = await rosterScopeForTeacher(db, teacherId);
  await validateRosterOwnership(db, input, teacherId, scope);
  await db.insert("exports", {
    anonymized: false,
    assignment_id: null,
    class_group_id: null,
    completed_only: false,
    export_kind: "app_roster_snapshot",
    generated_by_teacher_id: teacherId,
    payload: sanitizedRosterSnapshot(input)
  });
  await deleteRosterRows(db, input);
  const teachersWithPasswords = input.teachers.filter(hasProvidedPassword);
  const teachersWithoutPasswords = input.teachers.filter((item) => !hasProvidedPassword(item));
  if (teachersWithPasswords.length > 0) {
    await db.upsert("teachers", teachersWithPasswords.map((item) => ({
      ...teacherPatchBody(item),
      id: item.id,
      initial_password: item.password,
      password_hash: credentialHash(item.password)
    })), "id");
  }
  if (teachersWithoutPasswords.length > 0) {
    await Promise.all(teachersWithoutPasswords.map((item) =>
      db.patch("teachers", `id=eq.${encode(item.id)}`, teacherPatchBody(item))
    ));
  }
  if (input.classes.length > 0) {
    await db.upsert("classes", input.classes.map((item) => ({
      id: item.id,
      name: item.name,
      teacher_id: teacherId
    })), "id");
  }
  if (input.assignments.length > 0) {
    await db.upsert("assignments", input.assignments.map((item) => ({
      assignment: item.payload,
      class_group_id: item.classGroupId ?? null,
      created_by_teacher_id: teacherId,
      id: item.id,
      research_condition: item.researchCondition,
      research_mode: item.researchMode,
      title: item.title
    })), "id");
  }
  const studentsWithPasswords = input.students.filter(hasProvidedPassword);
  const studentsWithoutPasswords = input.students.filter((item) => !hasProvidedPassword(item));
  if (studentsWithPasswords.length > 0) {
    await db.upsert("students", studentsWithPasswords.map((item) => ({
      ...studentPatchBody(item),
      id: item.id,
      initial_participant_code: item.participantCode,
      initial_password: item.password,
      password_hash: credentialHash(item.password)
    })), "id");
  }
  if (studentsWithoutPasswords.length > 0) {
    await Promise.all(studentsWithoutPasswords.map((item) =>
      db.patch("students", `id=eq.${encode(item.id)}`, studentPatchBody(item))
    ));
  }
  return {
    counts: { assignments: input.assignments.length, classes: input.classes.length, students: input.students.length },
    ok: true,
    rosterRevision: (await rosterScopeForTeacher(db, teacherId)).revision
  };
};
