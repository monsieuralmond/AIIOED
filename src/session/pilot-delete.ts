import type { Assignment, PilotState, SelectedActor, TeacherAccount } from "../shared/types.js";
import { PilotStateError } from "./pilot-state.js";

const selectedActorAfterDelete = (selectedActor: SelectedActor | null, role: SelectedActor["role"], accountIds: readonly string[]): SelectedActor | null => {
  if (selectedActor === null) return null;
  if (selectedActor.role !== role) return selectedActor;
  return accountIds.includes(selectedActor.accountId) ? null : selectedActor;
};

const unassignClassGroup = (assignment: Assignment, classGroupId: string, removedStudentIds: ReadonlySet<string>): Assignment => {
  const assignedStudentIds = assignment.assignedStudentIds?.filter((studentId) => !removedStudentIds.has(studentId));
  if (assignment.classGroupId !== classGroupId) {
    return assignedStudentIds === undefined ? assignment : { ...assignment, assignedStudentIds };
  }
  const { assignedStudentIds: removedAssignedStudentIds, classGroupId: removedClassGroupId, ...assignmentWithoutClass } = assignment;
  void removedAssignedStudentIds;
  void removedClassGroupId;
  return assignedStudentIds === undefined || assignedStudentIds.length === 0
    ? assignmentWithoutClass
    : { ...assignmentWithoutClass, assignedStudentIds };
};

export const deleteAssignment = (state: PilotState, assignmentId: string): PilotState => {
  if (!state.assignments.some((assignment) => assignment.id === assignmentId)) throw new PilotStateError("삭제할 과제를 찾을 수 없습니다.");
  const assignments = state.assignments.filter((assignment) => assignment.id !== assignmentId);
  return {
    ...state,
    activeAssignmentId: state.activeAssignmentId === assignmentId ? assignments[0]?.id ?? "" : state.activeAssignmentId,
    assignments,
    sessions: state.sessions.filter((session) => session.assignment.id !== assignmentId)
  };
};

export const deleteStudentAccount = (state: PilotState, studentId: string): PilotState => {
  if (!state.students.some((student) => student.id === studentId)) throw new PilotStateError("삭제할 학생 계정을 찾을 수 없습니다.");
  const sessions = state.sessions.filter((session) => session.student.accountId !== studentId);
  return {
    ...state,
    assignments: state.assignments.map((assignment) => ({
      ...assignment,
      assignedStudentIds: assignment.assignedStudentIds?.filter((item) => item !== studentId) ?? []
    })),
    classGroups: state.classGroups.map((classGroup) =>
      classGroup.studentIds.includes(studentId)
        ? { ...classGroup, studentIds: classGroup.studentIds.filter((item) => item !== studentId) }
        : classGroup
    ),
    selectedActor: selectedActorAfterDelete(state.selectedActor, "student", [studentId]),
    sessions,
    students: state.students.filter((student) => student.id !== studentId)
  };
};

export const deleteClassGroup = (state: PilotState, classGroupId: string): PilotState => {
  if (!state.classGroups.some((classGroup) => classGroup.id === classGroupId)) throw new PilotStateError("삭제할 반을 찾을 수 없습니다.");
  const removedStudentIds = state.students.filter((student) => student.classGroupId === classGroupId).map((student) => student.id);
  const removedStudentIdSet = new Set(removedStudentIds);
  const sessions = state.sessions.filter((session) => session.student.accountId === undefined || !removedStudentIds.includes(session.student.accountId));
  return {
    ...state,
    assignments: state.assignments.map((assignment) => unassignClassGroup(assignment, classGroupId, removedStudentIdSet)),
    classGroups: state.classGroups.filter((classGroup) => classGroup.id !== classGroupId),
    selectedActor: selectedActorAfterDelete(state.selectedActor, "student", removedStudentIds),
    sessions,
    students: state.students.filter((student) => student.classGroupId !== classGroupId)
  };
};

export const deleteTeacherAccount = (state: PilotState, teacherId: string): PilotState => {
  if (!state.teachers.some((teacher) => teacher.id === teacherId)) throw new PilotStateError("삭제할 교사 계정을 찾을 수 없습니다.");
  const remainingTeachers = state.teachers.filter((teacher) => teacher.id !== teacherId);
  const replacementTeacher: TeacherAccount | undefined = remainingTeachers[0];
  if (replacementTeacher === undefined) throw new PilotStateError("마지막 교사 계정은 삭제할 수 없습니다.");
  return {
    ...state,
    classGroups: state.classGroups.map((classGroup) => (classGroup.teacherId === teacherId ? { ...classGroup, teacherId: replacementTeacher.id } : classGroup)),
    selectedActor: selectedActorAfterDelete(state.selectedActor, "teacher", [teacherId]),
    teacher: state.teacher.id === teacherId ? replacementTeacher : state.teacher,
    teachers: remainingTeachers
  };
};
