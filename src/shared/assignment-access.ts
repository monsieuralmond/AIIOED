import type { Assignment, StudentAccount } from "./types.js";

type AssignmentAccess = Pick<Assignment, "assignedStudentIds" | "classGroupId">;
type StudentAccess = Pick<StudentAccount, "classGroupId" | "id">;

export const isAssignmentAssignedToStudent = (assignment: AssignmentAccess, student: StudentAccess): boolean =>
  assignment.assignedStudentIds === undefined
    ? assignment.classGroupId === student.classGroupId
    : assignment.assignedStudentIds.includes(student.id);
