import { describe, expect, it } from "vitest";
import { createInitialPilotState } from "../session/session.js";
import { sampleAssignment, sampleClassGroups, sampleStudents, sampleTeacher } from "../shared/fixtures.js";
import { stateForTeacherScope, stateWithDatabaseRoster } from "./app-bootstrap.js";

describe("app bootstrap", () => {
  it("uses the database roster as the source of truth for assignments", () => {
    const restoredAssignment = {
      ...sampleAssignment,
      id: "assignment-restored-only",
      title: "복원된 과제만 표시"
    };

    const restored = stateWithDatabaseRoster(createInitialPilotState(), {
      assignments: [restoredAssignment],
      classGroups: [],
      students: [],
      teachers: []
    });

    expect(restored.assignments.map((assignment) => assignment.id)).toEqual([restoredAssignment.id]);
    expect(restored.assignments.find((assignment) => assignment.id === sampleAssignment.id)).toBeUndefined();
    expect(restored.activeAssignmentId).toBe(restoredAssignment.id);
  });

  it("preserves empty class and student lists from a database roster with assignments", () => {
    const restoredAssignment = {
      ...sampleAssignment,
      id: "assignment-restored-only",
      title: "복원된 과제만 표시"
    };

    const restored = stateWithDatabaseRoster(createInitialPilotState(), {
      assignments: [restoredAssignment],
      classGroups: [],
      students: [],
      teachers: []
    });

    expect(restored.classGroups).toEqual([]);
    expect(restored.students).toEqual([]);
  });

  it("preserves an empty database assignment list when roster data exists", () => {
    const restored = stateWithDatabaseRoster(createInitialPilotState(), {
      assignments: [],
      classGroups: [{ id: "class-empty", name: "빈 과제 반", studentIds: [], teacherId: "teacher-research" }],
      students: [],
      teachers: []
    });

    expect(restored.assignments).toEqual([]);
    expect(restored.activeAssignmentId).toBe("");
    expect(restored.classGroups.map((classGroup) => classGroup.id)).toEqual(["class-empty"]);
  });

  it("treats an empty database roster as an intentionally empty roster", () => {
    const restored = stateWithDatabaseRoster(createInitialPilotState(), {
      assignments: [],
      classGroups: [],
      students: [],
      teachers: []
    });

    expect(restored.assignments).toEqual([]);
    expect(restored.classGroups).toEqual([]);
    expect(restored.students).toEqual([]);
    expect(restored.activeAssignmentId).toBe("");
  });

  it("scopes visible roster data to the selected teacher", () => {
    const otherTeacher = { displayName: "다른 교사", id: "teacher-other", loginId: "other", password: "" };
    const ownClass = sampleClassGroups[0];
    const ownStudent = sampleStudents[0];
    if (ownClass === undefined || ownStudent === undefined) throw new Error("Missing sample roster fixture.");
    const otherClass = { id: "class-other", name: "다른 반", studentIds: ["student-other"], teacherId: otherTeacher.id };
    const otherStudent = {
      classGroupId: otherClass.id,
      displayName: "다른 학생",
      id: "student-other",
      loginId: "other-student",
      participantCode: "OTHER",
      password: "",
      studentNumber: 1
    };
    const ownAssignment = {
      ...sampleAssignment,
      assignedStudentIds: [ownStudent.id],
      classGroupId: ownClass.id,
      createdByTeacherId: sampleTeacher.id,
      id: "assignment-own"
    };
    const otherAssignment = {
      ...sampleAssignment,
      assignedStudentIds: [otherStudent.id],
      classGroupId: otherClass.id,
      createdByTeacherId: otherTeacher.id,
      id: "assignment-other"
    };

    const scoped = stateForTeacherScope({
      ...createInitialPilotState(),
      activeAssignmentId: otherAssignment.id,
      assignments: [ownAssignment, otherAssignment],
      classGroups: [ownClass, otherClass],
      students: [ownStudent, otherStudent],
      teachers: [sampleTeacher, otherTeacher]
    }, sampleTeacher.id);

    expect(scoped.teachers.map((teacher) => teacher.id)).toEqual([sampleTeacher.id]);
    expect(scoped.classGroups.map((classGroup) => classGroup.id)).toEqual([ownClass.id]);
    expect(scoped.students.map((student) => student.id)).toEqual([ownStudent.id]);
    expect(scoped.assignments.map((assignment) => assignment.id)).toEqual([ownAssignment.id]);
    expect(scoped.activeAssignmentId).toBe(ownAssignment.id);
  });
});
