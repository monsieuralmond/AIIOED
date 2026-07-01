import { useState } from "react";
import type { ReactElement } from "react";
import type { Assignment, PilotState } from "../shared/types";
import { parseRequirements, requirementText } from "./assignment-requirements";
import { Button, Field, Surface, TextArea, TextInput } from "./ui";

type CreateAssignmentProps = {
  readonly assignment: Assignment;
  readonly mode: "create" | "edit";
  readonly state: PilotState;
  readonly onBack: () => void;
  readonly onSave: (assignment: Assignment) => void;
};

const newAssignmentId = (): string => `assignment-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const essayTypeOptions = ["주장 글쓰기", "근거 비교", "반론 탐색", "설명 글쓰기", "비교 글쓰기", "문학 분석"] as const;

export function CreateAssignment(props: CreateAssignmentProps): ReactElement {
  const [assignmentId] = useState(() => (props.mode === "edit" ? props.assignment.id : newAssignmentId()));
  const [title, setTitle] = useState(props.mode === "edit" ? props.assignment.title : "");
  const [passage, setPassage] = useState(props.mode === "edit" ? props.assignment.passage : "");
  const [question, setQuestion] = useState(props.mode === "edit" ? props.assignment.question : "");
  const [gradeLevel, setGradeLevel] = useState(props.assignment.gradeLevel);
  const [assignmentMode, setAssignmentMode] = useState(props.assignment.assignmentMode ?? "full_process");
  const [essayType, setEssayType] = useState(props.assignment.essayType ?? "주장 글쓰기");
  const [targetLength, setTargetLength] = useState(props.assignment.targetLength);
  const [minimumWordCount, setMinimumWordCount] = useState(props.assignment.minimumWordCount ?? props.assignment.targetLength.replace(/[^0-9]/g, ""));
  const [requirements, setRequirements] = useState(requirementText(props.assignment));
  const [sourceGuidance, setSourceGuidance] = useState(props.assignment.sourceGuidance ?? "지문 근거를 먼저 사용하고, 외부 자료가 필요하면 제목과 출처를 적게 합니다.");
  const [classGroupId, setClassGroupId] = useState(props.assignment.classGroupId ?? props.state.classGroups[0]?.id ?? "");
  const [startDate, setStartDate] = useState(props.assignment.startDate ?? "");
  const [startTime, setStartTime] = useState(props.assignment.startTime ?? "");
  const [dueDate, setDueDate] = useState(props.assignment.dueDate ?? "");
  const [dueTime, setDueTime] = useState(props.assignment.dueTime ?? "");
  const [error, setError] = useState("");

  const save = (): void => {
    if (title.trim().length === 0) { setError("과제 제목을 입력하세요"); return; }
    if (passage.trim().length === 0) { setError("비문학 지문을 입력하세요"); return; }
    if (question.trim().length === 0) { setError("해결할 문제를 입력하세요"); return; }
    const parsedRequirements = parseRequirements(requirements);
    if (parsedRequirements.length === 0) { setError("학생에게 보일 요구사항을 하나 이상 입력하세요"); return; }
    const createdByTeacherId = props.state.selectedActor?.role === "teacher" ? props.state.selectedActor.accountId : props.assignment.createdByTeacherId;
    props.onSave({
      assignmentMode,
      classGroupId,
      id: assignmentId,
      essayType,
      gradeLevel,
      minimumWordCount,
      passage,
      question,
      requirements: parsedRequirements,
      sourceGuidance,
      targetLength,
      title,
      ...(createdByTeacherId === undefined ? {} : { createdByTeacherId }),
      ...(dueDate.trim().length > 0 ? { dueDate } : {}),
      ...(dueTime.trim().length > 0 ? { dueTime } : {}),
      ...(startDate.trim().length > 0 ? { startDate } : {}),
      ...(startTime.trim().length > 0 ? { startTime } : {})
    });
  };

  return (
    <main className="form-page">
      <Surface className="assignment-form">
        <header className="assignment-form-header">
          <div>
            <p className="eyebrow">{props.mode === "edit" ? "기존 과제 수정" : "새 글쓰기 과제"}</p>
            <h1>{props.mode === "edit" ? "과제 수정" : "과제 만들기"}</h1>
            <p>{props.mode === "edit" ? "제목, 지문, 문제, 제출 조건을 고친 뒤 같은 과제로 저장합니다." : "학생이 읽을 지문, 해결할 문제, 제출 조건을 한 번에 정합니다."}</p>
          </div>
          <Button variant="ghost" onClick={props.onBack}>돌아가기</Button>
        </header>
        <div className="assignment-form-body">
          <section className="assignment-type-grid" aria-label="과제 유형">
            <label className={assignmentMode === "full_process" ? "assignment-type-card selected" : "assignment-type-card"}>
              <input checked={assignmentMode === "full_process"} name="assignment-mode" type="radio" value="full_process" onChange={() => setAssignmentMode("full_process")} />
              <strong>전체 글쓰기 과정</strong>
              <span>이해, 개요, 초안, 고쳐쓰기를 모두 기록합니다.</span>
            </label>
            <label className={assignmentMode === "revision_feedback" ? "assignment-type-card selected" : "assignment-type-card"}>
              <input checked={assignmentMode === "revision_feedback"} name="assignment-mode" type="radio" value="revision_feedback" onChange={() => setAssignmentMode("revision_feedback")} />
              <strong>초안 피드백과 수정</strong>
              <span>이미 쓴 글을 가져와 피드백과 수정 기록을 봅니다.</span>
            </label>
          </section>
          <Field label="과제 제목"><TextInput placeholder={props.assignment.title} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
          <div className="assignment-form-grid two">
            <label className="ui-field"><span>학년 또는 난이도</span><select className="ui-control" value={gradeLevel} onChange={(event) => setGradeLevel(event.currentTarget.value)}><option>초등 고학년</option><option>중학생</option><option>고등학생</option></select></label>
            <label className="ui-field"><span>글 유형</span><select className="ui-control" value={essayType} onChange={(event) => setEssayType(event.currentTarget.value)}>{essayTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          </div>
          <div className="assignment-form-grid two">
            <Field label="목표 분량"><TextInput value={targetLength} onChange={(event) => setTargetLength(event.currentTarget.value)} /></Field>
            <Field label="최소 글자 수"><TextInput inputMode="numeric" value={minimumWordCount} onChange={(event) => setMinimumWordCount(event.currentTarget.value)} /></Field>
          </div>
          <Field label="비문학 지문"><TextArea placeholder={props.assignment.passage} rows={8} value={passage} onChange={(event) => setPassage(event.currentTarget.value)} /></Field>
          <Field label="해결할 문제"><TextArea placeholder={props.assignment.question} rows={4} value={question} onChange={(event) => setQuestion(event.currentTarget.value)} /></Field>
          <Field label="학생에게 보일 요구사항"><TextArea rows={5} value={requirements} onChange={(event) => setRequirements(event.currentTarget.value)} /></Field>
          <Field label="근거와 출처 안내"><TextArea rows={3} value={sourceGuidance} onChange={(event) => setSourceGuidance(event.currentTarget.value)} /></Field>
          <section className="assignment-schedule" aria-label="반 배정과 기간">
            <label className="ui-field"><span>배정할 반</span><select className="ui-control" value={classGroupId} onChange={(event) => setClassGroupId(event.currentTarget.value)}>{props.state.classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}</select></label>
            <Field label="시작일"><TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} /></Field>
            <Field label="시작 시간"><TextInput type="time" value={startTime} onChange={(event) => setStartTime(event.currentTarget.value)} /></Field>
            <Field label="마감일"><TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.currentTarget.value)} /></Field>
            <Field label="마감 시간"><TextInput type="time" value={dueTime} onChange={(event) => setDueTime(event.currentTarget.value)} /></Field>
          </section>
          {error.length > 0 ? <p className="error-text">{error}</p> : null}
          <div className="assignment-form-footer">
            <Button variant="ghost" onClick={props.onBack}>취소</Button>
            <Button className="form-submit" variant="primary" onClick={save}>{props.mode === "edit" ? "수정 저장" : "과제 저장"}</Button>
          </div>
        </div>
      </Surface>
    </main>
  );
}
