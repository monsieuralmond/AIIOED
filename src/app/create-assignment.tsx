import { useState } from "react";
import type { ReactElement } from "react";
import { ResearchModes } from "../shared/research";
import type { ResearchMode, UnderstandingTransferChoice } from "../shared/research";
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
const defaultErrorStatement = "양자컴퓨터는 모든 문제를 일반 컴퓨터보다 빠르게 해결한다.";
const defaultTransferChoices: readonly UnderstandingTransferChoice[] = [
  { id: "A", label: "A", text: "오늘의 급식 메뉴 정하기" },
  { id: "B", label: "B", text: "매우 큰 수를 이용한 암호 해독" },
  { id: "C", label: "C", text: "친구 생일 기억하기" },
  { id: "D", label: "D", text: "그림판으로 그림 그리기" }
];

const researchModeFromValue = (value: string): ResearchMode =>
  value === ResearchModes.understandingCalibration ? ResearchModes.understandingCalibration : ResearchModes.writingCoach;

const defaultCalibrationQuestion = (topic: string): string => `${topic}에 대해 읽고 AI와 질문한 뒤, 내 말로 설명하고 적용해 봅니다.`;

const normalizeTransferChoices = (choices: readonly UnderstandingTransferChoice[] | undefined): readonly UnderstandingTransferChoice[] =>
  defaultTransferChoices.map((defaultChoice, index) => {
    const savedChoice = choices?.[index];
    return savedChoice === undefined ? defaultChoice : { ...defaultChoice, text: savedChoice.text };
  });

export function CreateAssignment(props: CreateAssignmentProps): ReactElement {
  const [assignmentId] = useState(() => (props.mode === "edit" ? props.assignment.id : newAssignmentId()));
  const initialResearchMode = props.assignment.researchMode ?? ResearchModes.writingCoach;
  const initialCalibrationConfig = props.assignment.calibrationConfig;
  const [researchMode, setResearchMode] = useState<ResearchMode>(initialResearchMode);
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
  const [calibrationTopic, setCalibrationTopic] = useState(props.mode === "edit" ? initialCalibrationConfig?.topic ?? props.assignment.title : "");
  const [aiContext, setAiContext] = useState(initialCalibrationConfig?.aiContext ?? "");
  const [maxChatMinutes, setMaxChatMinutes] = useState(initialCalibrationConfig?.maxChatMinutes?.toString() ?? "10");
  const [errorStatement, setErrorStatement] = useState(initialCalibrationConfig?.errorStatement ?? defaultErrorStatement);
  const [transferChoices, setTransferChoices] = useState<readonly UnderstandingTransferChoice[]>(() => normalizeTransferChoices(initialCalibrationConfig?.transferChoices));
  const [error, setError] = useState("");
  const isCalibrationMode = researchMode === ResearchModes.understandingCalibration;

  const updateTransferChoice = (choiceId: string, text: string): void => {
    setTransferChoices((current) => current.map((choice) => (choice.id === choiceId ? { ...choice, text } : choice)));
  };

  const save = (): void => {
    if (title.trim().length === 0) { setError("과제 제목을 입력하세요"); return; }
    if (passage.trim().length === 0) { setError("비문학 지문을 입력하세요"); return; }
    const parsedRequirements = parseRequirements(requirements);
    const trimmedTopic = calibrationTopic.trim();
    const parsedMaxChatMinutes = maxChatMinutes.trim().length === 0 ? undefined : Number(maxChatMinutes);
    const cleanedTransferChoices = transferChoices.map((choice) => ({ ...choice, text: choice.text.trim() }));
    if (isCalibrationMode && trimmedTopic.length === 0) { setError("연구 주제명을 입력하세요"); return; }
    if (isCalibrationMode && parsedMaxChatMinutes !== undefined && (!Number.isFinite(parsedMaxChatMinutes) || parsedMaxChatMinutes <= 0)) { setError("최대 채팅 권장 시간은 1 이상의 숫자로 입력하세요"); return; }
    if (isCalibrationMode && errorStatement.trim().length === 0) { setError("오류 판단 문장을 입력하세요"); return; }
    if (isCalibrationMode && cleanedTransferChoices.some((choice) => choice.text.length === 0)) { setError("적용 과제 선택지를 모두 입력하세요"); return; }
    if (!isCalibrationMode && question.trim().length === 0) { setError("해결할 문제를 입력하세요"); return; }
    if (!isCalibrationMode && parsedRequirements.length === 0) { setError("학생에게 보일 요구사항을 하나 이상 입력하세요"); return; }
    const createdByTeacherId = props.state.selectedActor?.role === "teacher" ? props.state.selectedActor.accountId : props.assignment.createdByTeacherId;
    props.onSave({
      assignmentMode,
      classGroupId,
      id: assignmentId,
      essayType: isCalibrationMode ? "이해 보정 연구" : essayType,
      gradeLevel,
      minimumWordCount,
      passage,
      question: isCalibrationMode ? (question.trim().length > 0 ? question.trim() : defaultCalibrationQuestion(trimmedTopic)) : question,
      researchMode,
      requirements: isCalibrationMode ? [] : parsedRequirements,
      sourceGuidance: isCalibrationMode ? "" : sourceGuidance,
      targetLength,
      ...(isCalibrationMode
        ? {
            calibrationConfig: {
              ...(aiContext.trim().length > 0 ? { aiContext: aiContext.trim() } : {}),
              errorStatement: errorStatement.trim(),
              ...(parsedMaxChatMinutes === undefined ? {} : { maxChatMinutes: parsedMaxChatMinutes }),
              sourceText: passage.trim(),
              topic: trimmedTopic,
              transferChoices: cleanedTransferChoices
            }
          }
        : {}),
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
          <section className="research-mode-section" aria-label="과제 모드">
            <h2>과제 모드</h2>
            <div className="assignment-type-grid">
              <label className={researchMode === ResearchModes.writingCoach ? "assignment-type-card selected" : "assignment-type-card"}>
                <input checked={researchMode === ResearchModes.writingCoach} name="research-mode" type="radio" value={ResearchModes.writingCoach} onChange={(event) => setResearchMode(researchModeFromValue(event.currentTarget.value))} />
                <strong>기존 글쓰기 코치</strong>
                <span>지문을 읽고 개요, 초안, 고쳐쓰기, 제출 과정을 기록합니다.</span>
              </label>
              <label className={isCalibrationMode ? "assignment-type-card selected" : "assignment-type-card"}>
                <input checked={isCalibrationMode} name="research-mode" type="radio" value={ResearchModes.understandingCalibration} onChange={(event) => setResearchMode(researchModeFromValue(event.currentTarget.value))} />
                <strong>AI 기반 이해 보정 연구</strong>
                <span>AI 대화 뒤 자기 이해 예측과 독립 수행 자료를 수집합니다.</span>
              </label>
            </div>
          </section>
          {!isCalibrationMode ? (
            <section className="assignment-type-grid" aria-label="글쓰기 과정 유형">
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
          ) : (
            <section className="calibration-mode-note" aria-label="이해 보정 연구 안내">
              이 모드는 학생이 지문을 읽고 AI와 자유롭게 대화한 뒤, 자신의 이해 수준을 예측하고 독립 과제를 수행하는 연구용 플로우입니다.
            </section>
          )}
          <Field label="과제 제목"><TextInput placeholder={props.assignment.title} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
          {isCalibrationMode ? <Field label="주제명"><TextInput placeholder="예: 양자컴퓨터, 플라스틱 사용, 소셜미디어와 민주주의" value={calibrationTopic} onChange={(event) => setCalibrationTopic(event.currentTarget.value)} /></Field> : null}
          <div className="assignment-form-grid two">
            <label className="ui-field"><span>학년 또는 난이도</span><select className="ui-control" value={gradeLevel} onChange={(event) => setGradeLevel(event.currentTarget.value)}><option>초등 고학년</option><option>중학생</option><option>고등학생</option></select></label>
            {!isCalibrationMode ? <label className="ui-field"><span>글 유형</span><select className="ui-control" value={essayType} onChange={(event) => setEssayType(event.currentTarget.value)}>{essayTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label> : <Field label="최대 채팅 권장 시간"><TextInput inputMode="numeric" value={maxChatMinutes} onChange={(event) => setMaxChatMinutes(event.currentTarget.value)} /></Field>}
          </div>
          {!isCalibrationMode ? (
            <div className="assignment-form-grid two">
              <Field label="목표 분량"><TextInput value={targetLength} onChange={(event) => setTargetLength(event.currentTarget.value)} /></Field>
              <Field label="최소 글자 수"><TextInput inputMode="numeric" value={minimumWordCount} onChange={(event) => setMinimumWordCount(event.currentTarget.value)} /></Field>
            </div>
          ) : null}
          <Field label="비문학 지문"><TextArea placeholder={props.assignment.passage} rows={8} value={passage} onChange={(event) => setPassage(event.currentTarget.value)} /></Field>
          {!isCalibrationMode ? (
            <>
              <Field label="해결할 문제"><TextArea placeholder={props.assignment.question} rows={4} value={question} onChange={(event) => setQuestion(event.currentTarget.value)} /></Field>
              <Field label="학생에게 보일 요구사항"><TextArea rows={5} value={requirements} onChange={(event) => setRequirements(event.currentTarget.value)} /></Field>
              <Field label="근거와 출처 안내"><TextArea rows={3} value={sourceGuidance} onChange={(event) => setSourceGuidance(event.currentTarget.value)} /></Field>
            </>
          ) : (
            <section className="calibration-config-section" aria-label="이해 보정 연구 설정">
              <Field label="AI 보조자료 또는 설명 자료"><TextArea placeholder="지문만으로 부족한 배경 설명이 있으면 입력하세요. 없으면 비워 둡니다." rows={4} value={aiContext} onChange={(event) => setAiContext(event.currentTarget.value)} /></Field>
              <Field label="오류 판단 문장"><TextArea rows={3} value={errorStatement} onChange={(event) => setErrorStatement(event.currentTarget.value)} /></Field>
              <div className="transfer-choice-list">
                <h2>적용 과제 선택지</h2>
                <p>학생이 AI 없이 고를 선택지입니다. 주제에 맞게 네 문장을 수정하세요.</p>
                {transferChoices.map((choice) => (
                  <label className="transfer-choice-row" key={choice.id}>
                    <span>{choice.label}</span>
                    <TextInput value={choice.text} onChange={(event) => updateTransferChoice(choice.id, event.currentTarget.value)} />
                  </label>
                ))}
              </div>
            </section>
          )}
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
