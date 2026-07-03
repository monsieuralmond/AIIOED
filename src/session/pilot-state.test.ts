import { describe, expect, it } from "vitest";
import { exportDataset } from "../export/export.js";
import { sampleAssignment } from "../shared/fixtures.js";
import { ResearchConditions, ResearchModes } from "../shared/research.js";
import { activeSession, createClassGroup, createStudentAccount, createTeacherAccount, deleteClassGroup, deleteStudentAccount, deleteTeacherAccount, teacherByCredentials, createInitialPilotState, saveAssignmentInState, sessionStatus, startStudentSession, studentByCredentials, studentByParticipantCode, submitFinal, updatePilotSession } from "./session.js";

describe("local pilot state", () => {
  it("keeps student sessions distinct for the same assignment", () => {
    const initial = createInitialPilotState();
    const firstStudent = initial.students[0];
    const secondStudent = initial.students[1];
    if (firstStudent === undefined || secondStudent === undefined) throw new Error("fixture students missing");

    const firstStarted = startStudentSession(initial, firstStudent.id, sampleAssignment.id);
    const secondStarted = startStudentSession(firstStarted.state, secondStudent.id, sampleAssignment.id);

    expect(firstStarted.session.student.accountId).toBe(firstStudent.id);
    expect(secondStarted.session.student.accountId).toBe(secondStudent.id);
    expect(firstStarted.session.sessionId).not.toBe(secondStarted.session.sessionId);
    expect(secondStarted.state.sessions).toHaveLength(2);
  });

  it("starts a fresh session when the same student re-enters an assignment", () => {
    const initial = createInitialPilotState();
    const student = initial.students[0];
    if (student === undefined) throw new Error("fixture student missing");

    const firstStarted = startStudentSession(initial, student.id, sampleAssignment.id);
    const secondStarted = startStudentSession(firstStarted.state, student.id, sampleAssignment.id);

    expect(firstStarted.session.student.accountId).toBe(student.id);
    expect(secondStarted.session.student.accountId).toBe(student.id);
    expect(firstStarted.session.sessionId).not.toBe(secondStarted.session.sessionId);
    expect(secondStarted.state.sessions).toHaveLength(2);
    expect(activeSession(secondStarted.state)?.sessionId).toBe(secondStarted.session.sessionId);
  });

  it("defaults legacy assignments to writing-coach research sessions", () => {
    const initial = createInitialPilotState();
    const student = initial.students[0];
    if (student === undefined) throw new Error("fixture student missing");

    const started = startStudentSession(initial, student.id, sampleAssignment.id);

    expect(started.session.researchMode).toBe(ResearchModes.writingCoach);
    expect(started.session.researchCondition).toBe(ResearchConditions.singleGroupBaseline);
    expect(started.session.assignment.researchMode).toBe(ResearchModes.writingCoach);
    expect(started.session.assignment.researchCondition).toBe(ResearchConditions.singleGroupBaseline);
    expect(started.session.status).toBe("in_progress");
    expect(started.session.artifacts).toEqual([]);
    expect(started.session.measures).toEqual([]);
    expect(started.session.modules).toEqual({});
    expect(started.session.createdAt).toBe(started.session.metadata.createdAt);
    expect(started.session.updatedAt).toBe(started.session.createdAt);
  });

  it("starts an understanding-calibration session with a blank module shell", () => {
    const initial = createInitialPilotState();
    const student = initial.students[0];
    if (student === undefined) throw new Error("fixture student missing");
    const assignment = {
      ...sampleAssignment,
      id: "assignment-understanding-calibration",
      researchMode: ResearchModes.understandingCalibration,
      title: "플라스틱 사용 이해 점검",
      calibrationConfig: {
        independentTasks: ["핵심 근거 두 가지 쓰기"],
        topic: "일회용 플라스틱 사용",
        transferChoices: [{ id: "A", label: "A", text: "새로운 기사에 적용하기" }]
      }
    };

    const withAssignment = saveAssignmentInState(initial, assignment);
    const started = startStudentSession(withAssignment, student.id, assignment.id);

    expect(started.session.researchMode).toBe(ResearchModes.understandingCalibration);
    expect(started.session.researchCondition).toBe(ResearchConditions.singleGroupBaseline);
    expect(started.session.currentStage).toBe("pre_survey");
    expect(started.session.status).toBe("in_progress");
    expect(started.session.artifacts).toEqual([]);
    expect(started.session.measures).toEqual([]);
    expect(started.session.modules.understandingCalibration).toEqual({
      independentTasks: ["핵심 근거 두 가지 쓰기"],
      topic: "일회용 플라스틱 사용",
      transferChoices: [{ id: "A", label: "A", text: "새로운 기사에 적용하기" }],
      version: "1.0"
    });
  });

  it("keeps reserved research conditions inactive when saving assignments", () => {
    const initial = createInitialPilotState();
    const assignment = {
      ...sampleAssignment,
      id: "assignment-reserved-condition",
      researchCondition: ResearchConditions.evidenceCheck
    };

    const withAssignment = saveAssignmentInState(initial, assignment);

    expect(withAssignment.assignments.find((item) => item.id === assignment.id)?.researchCondition).toBe(ResearchConditions.singleGroupBaseline);
  });

  it("reports not-started, in-progress, and submitted student statuses", () => {
    const initial = createInitialPilotState();
    const firstStudent = initial.students[0];
    const secondStudent = initial.students[1];
    if (firstStudent === undefined || secondStudent === undefined) throw new Error("fixture students missing");

    const firstStarted = startStudentSession(initial, firstStudent.id, sampleAssignment.id);
    const submittedSession = submitFinal(firstStarted.session, "학생이 직접 쓴 최종 글입니다.");
    const submittedState = updatePilotSession(firstStarted.state, submittedSession);

    expect(sessionStatus(initial, firstStudent.id, sampleAssignment.id)).toBe("not_started");
    expect(sessionStatus(firstStarted.state, firstStudent.id, sampleAssignment.id)).toBe("in_progress");
    expect(sessionStatus(submittedState, firstStudent.id, sampleAssignment.id)).toBe("submitted");
    expect(sessionStatus(submittedState, secondStudent.id, sampleAssignment.id)).toBe("not_started");
  });

  it("exports the full class-level dataset rather than a single anonymous session", () => {
    const initial = createInitialPilotState();
    const student = initial.students[0];
    if (student === undefined) throw new Error("fixture student missing");

    const started = startStudentSession(initial, student.id, sampleAssignment.id);
    const submittedState = updatePilotSession(started.state, submitFinal(started.session, "최종 글입니다."));
    const exported = exportDataset(submittedState);

    expect(exported.teacher.displayName).toBe("연구 교사");
    expect(exported.students).toHaveLength(2);
    expect(exported.classGroups[0]?.studentIds).toContain(student.id);
    expect(exported.assignments[0]?.id).toBe(sampleAssignment.id);
    expect(exported.sessions[0]?.student.accountId).toBe(student.id);
    expect(exported.sessions[0]?.finalSubmission?.text).toBe("최종 글입니다.");
  });

  it("creates teacher, class, and numbered student accounts for the pilot roster", () => {
    const initial = createInitialPilotState();

    const withTeacher = createTeacherAccount(initial, {
      displayName: "박교사",
      loginId: "park",
      password: "park-pass"
    });
    const createdTeacher = teacherByCredentials(withTeacher, "park", "park-pass");
    if (createdTeacher === null) throw new Error("created teacher missing");

    const withClass = createClassGroup(withTeacher, {
      name: "3반",
      teacherId: createdTeacher.id
    });
    const createdClass = withClass.classGroups.find((classGroup) => classGroup.name === "3반");
    if (createdClass === undefined) throw new Error("created class missing");

    const withStudent = createStudentAccount(withClass, {
      classGroupId: createdClass.id,
      displayName: "최하늘",
      loginId: "haneul",
      participantCode: "S-HANEUL",
      password: "haneul-pass",
      studentNumber: 7
    });

    expect(withStudent.students).toContainEqual(expect.objectContaining({
      classGroupId: createdClass.id,
      displayName: "최하늘",
      loginId: "haneul",
      participantCode: "S-HANEUL",
      password: "haneul-pass",
      studentNumber: 7
    }));
    expect(withStudent.classGroups.find((classGroup) => classGroup.id === createdClass.id)?.studentIds).toContain("student-s-haneul");
    expect(studentByParticipantCode(withStudent, "s-haneul")?.displayName).toBe("최하늘");
    expect(studentByCredentials(withStudent, "HANEUL", "haneul-pass")?.displayName).toBe("최하늘");
  });

  it("deletes a student account and its linked session", () => {
    const initial = createInitialPilotState();
    const student = initial.students[0];
    if (student === undefined) throw new Error("fixture student missing");

    const started = startStudentSession(initial, student.id, sampleAssignment.id);
    const deleted = deleteStudentAccount(started.state, student.id);

    expect(deleted.students.find((item) => item.id === student.id)).toBeUndefined();
    expect(deleted.classGroups[0]?.studentIds).not.toContain(student.id);
    expect(deleted.sessions).toHaveLength(0);
    expect(activeSession(deleted)).toBeNull();
  });

  it("deletes a class with its students and unassigns the class assignment", () => {
    const initial = createInitialPilotState();

    const deleted = deleteClassGroup(initial, "class-pilot");
    const exported = exportDataset(deleted);

    expect(deleted.classGroups.find((classGroup) => classGroup.id === "class-pilot")).toBeUndefined();
    expect(deleted.students).toHaveLength(0);
    expect(deleted.assignments[0]?.classGroupId).toBeUndefined();
    expect(exported.classGroups).toHaveLength(0);
    expect(exported.students).toHaveLength(0);
    expect(exported.assignments[0]?.classGroupId).toBeUndefined();
  });

  it("deletes a teacher account while keeping at least one teacher available", () => {
    const initial = createInitialPilotState();
    const withTeacher = createTeacherAccount(initial, {
      displayName: "박교사",
      loginId: "park",
      password: "park-pass"
    });
    const createdTeacher = teacherByCredentials(withTeacher, "park", "park-pass");
    if (createdTeacher === null) throw new Error("created teacher missing");

    const withClass = createClassGroup(withTeacher, {
      name: "3반",
      teacherId: createdTeacher.id
    });
    const deleted = deleteTeacherAccount(withClass, createdTeacher.id);

    expect(deleted.teachers.find((teacher) => teacher.id === createdTeacher.id)).toBeUndefined();
    expect(deleted.classGroups.find((classGroup) => classGroup.name === "3반")?.teacherId).toBe("teacher-research");
    expect(() => deleteTeacherAccount(initial, "teacher-research")).toThrow("마지막 교사 계정은 삭제할 수 없습니다.");
  });
});
