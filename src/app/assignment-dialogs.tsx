import { useState } from "react";
import type { ReactElement } from "react";
import { ResearchModes } from "../shared/research.js";
import type { Assignment, ClassGroup, StudentAccount } from "../shared/types.js";
import { defaultRequirements } from "./assignment-requirements.js";
import { Button, Field } from "./ui.js";

export function AssignmentPreview(props: { readonly assignment: Assignment; readonly onClose: () => void }): ReactElement {
  const isCalibrationAssignment = props.assignment.researchMode === ResearchModes.understandingCalibration;
  const chatLimitLabel =
    props.assignment.calibrationConfig?.maxChatMinutes === undefined ? "제한 없음" : `${props.assignment.calibrationConfig.maxChatMinutes}분`;

  return (
    <div aria-label="과제 미리보기" className="preview-dialog" role="dialog">
      <button aria-label="닫기" className="preview-close" type="button" onClick={props.onClose}>x</button>
      <h1>{props.assignment.title}</h1>
      <div className="tag-row"><span>비문학</span><span>{isCalibrationAssignment ? "이해 보정 연구" : "글쓰기 코치"}</span><span>{props.assignment.gradeLevel}</span><span>{props.assignment.targetLength}</span><span>{props.assignment.essayType ?? "주장 글쓰기"}</span></div>
      <p>{props.assignment.question}</p>
      {isCalibrationAssignment ? (
        <section className="preview-requirements" aria-label="이해 보정 연구 설정">
          <h2>연구 활동 설정</h2>
          <dl className="preview-config-list">
            <div><dt>주제</dt><dd>{props.assignment.calibrationConfig?.topic ?? props.assignment.title}</dd></div>
            <div><dt>오류 판단 문장</dt><dd>{props.assignment.calibrationConfig?.errorStatement ?? "설정되지 않음"}</dd></div>
            <div><dt>채팅 권장 시간</dt><dd>{chatLimitLabel}</dd></div>
          </dl>
        </section>
      ) : (
        <section className="preview-requirements" aria-label="학생에게 보일 요구사항">
          <h2>학생에게 보일 요구사항</h2>
          <ul>{defaultRequirements(props.assignment).map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
        </section>
      )}
      <h2>지문</h2>
      <p>{props.assignment.passage}</p>
      <div className="preview-actions"><Button variant="primary" onClick={props.onClose}>닫기</Button></div>
    </div>
  );
}

export function AssignmentAssignDialog(props: {
  readonly assignment: Assignment;
  readonly classGroups: readonly ClassGroup[];
  readonly onAssign: (assignment: Assignment) => Promise<string | null | void> | string | null | void;
  readonly onClose: () => void;
  readonly students: readonly StudentAccount[];
}): ReactElement {
  const [classGroupId, setClassGroupId] = useState(props.assignment.classGroupId ?? props.classGroups[0]?.id ?? "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<readonly string[]>(props.assignment.assignedStudentIds ?? []);
  const [saveError, setSaveError] = useState("");
  const [savePending, setSavePending] = useState(false);
  const selectedClassGroup = props.classGroups.find((classGroup) => classGroup.id === classGroupId);
  const classStudents = props.students.filter((student) => student.classGroupId === classGroupId);
  const saveAssignment = async (): Promise<void> => {
    if (selectedClassGroup === undefined) return;
    setSaveError("");
    setSavePending(true);
    try {
      const validStudentIds = new Set(props.students.map((student) => student.id));
      const errorMessage = await props.onAssign({ ...props.assignment, assignedStudentIds: selectedStudentIds.filter((studentId) => validStudentIds.has(studentId)) });
      if (typeof errorMessage === "string" && errorMessage.length > 0) {
        setSaveError(errorMessage);
        setSavePending(false);
        return;
      }
      props.onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "배정 저장에 실패했습니다.");
      setSavePending(false);
    }
  };
  const toggleStudent = (studentId: string): void => {
    setSelectedStudentIds((current) => (
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
    ));
  };
  const selectEveryClassStudent = (): void => {
    setSelectedStudentIds((current) => [...new Set([...current, ...classStudents.map((student) => student.id)])]);
  };
  const clearClassStudents = (): void => {
    const classStudentIds = new Set(classStudents.map((student) => student.id));
    setSelectedStudentIds((current) => current.filter((studentId) => !classStudentIds.has(studentId)));
  };

  return (
    <div aria-label="과제 배정" className="preview-dialog" role="dialog">
      <button aria-label="닫기" className="preview-close" type="button" onClick={props.onClose}>x</button>
      <h1>{props.assignment.title}</h1>
      <p>이 과제를 보여줄 반과 학생을 선택하세요. 체크를 해제하고 저장하면 배정이 취소됩니다.</p>
      <section className="preview-requirements" aria-label="배정 대상">
        <Field label="배정할 반">
          <select className="ui-control" value={classGroupId} onChange={(event) => {
            setClassGroupId(event.currentTarget.value);
          }}>
            {props.classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
          </select>
        </Field>
        {selectedClassGroup === undefined ? <p>계정 관리에서 반을 먼저 만들어야 배정할 수 있습니다.</p> : null}
        {selectedClassGroup === undefined ? null : (
          <>
            <div className="assignment-student-actions">
              <span>{selectedStudentIds.filter((studentId) => classStudents.some((student) => student.id === studentId)).length}명 선택됨</span>
              <Button disabled={classStudents.length === 0} variant="ghost" onClick={selectEveryClassStudent}>전체 선택</Button>
              <Button disabled={classStudents.length === 0} variant="ghost" onClick={clearClassStudents}>배정 취소</Button>
            </div>
            <div className="assignment-student-list" aria-label={`${selectedClassGroup.name} 학생 목록`}>
              {classStudents.length === 0 ? <p>이 반에 등록된 학생이 없습니다.</p> : null}
              {classStudents.map((student) => (
                <label key={student.id}>
                  <input aria-label={`${student.studentNumber}번 ${student.displayName}`} checked={selectedStudentIds.includes(student.id)} type="checkbox" onChange={() => toggleStudent(student.id)} />
                  <span>{student.studentNumber}번 {student.displayName}</span>
                  <small>{student.loginId}</small>
                </label>
              ))}
            </div>
          </>
        )}
      </section>
      <div className="preview-actions">
        {saveError.length === 0 ? null : <p className="assignment-save-error">{saveError}</p>}
        <Button disabled={savePending} onClick={props.onClose}>취소</Button>
        <Button disabled={selectedClassGroup === undefined || savePending} variant="primary" onClick={() => { void saveAssignment(); }}>{savePending ? "저장 중" : "배정 저장"}</Button>
      </div>
    </div>
  );
}
