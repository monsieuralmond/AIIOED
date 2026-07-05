import { useState } from "react";
import type { ReactElement } from "react";
import { ResearchModes } from "../shared/research.js";
import type { Assignment, ClassGroup } from "../shared/types.js";
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
  readonly onAssign: (assignment: Assignment) => void;
  readonly onClose: () => void;
}): ReactElement {
  const [classGroupId, setClassGroupId] = useState(props.assignment.classGroupId ?? props.classGroups[0]?.id ?? "");
  const selectedClassGroup = props.classGroups.find((classGroup) => classGroup.id === classGroupId);
  const saveAssignment = (): void => {
    if (selectedClassGroup === undefined) return;
    props.onAssign({ ...props.assignment, classGroupId: selectedClassGroup.id });
  };

  return (
    <div aria-label="과제 배정" className="preview-dialog" role="dialog">
      <button aria-label="닫기" className="preview-close" type="button" onClick={props.onClose}>x</button>
      <h1>{props.assignment.title}</h1>
      <p>이 과제를 어떤 반에 보여줄지 선택하세요.</p>
      <section className="preview-requirements" aria-label="배정 대상">
        <Field label="배정할 반">
          <select className="ui-control" value={classGroupId} onChange={(event) => setClassGroupId(event.currentTarget.value)}>
            {props.classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
          </select>
        </Field>
        <p>{selectedClassGroup === undefined ? "계정 관리에서 반을 먼저 만들어야 배정할 수 있습니다." : `${selectedClassGroup.name} 학생 ${selectedClassGroup.studentIds.length}명에게 보입니다.`}</p>
      </section>
      <div className="preview-actions">
        <Button onClick={props.onClose}>취소</Button>
        <Button disabled={selectedClassGroup === undefined} variant="primary" onClick={saveAssignment}>배정 저장</Button>
      </div>
    </div>
  );
}
