import { useState } from "react";
import type { ReactElement } from "react";
import { ResearchModes } from "../shared/research.js";
import type { ResearchMode } from "../shared/research.js";
import type { Assignment, PilotState } from "../shared/types.js";
import { parseRequirements, requirementText } from "./assignment-requirements.js";
import { CalibrationAssignmentConfig, calibrationDraftFromAssignment, resolveCalibrationDraft } from "./calibration-assignment-config.js";
import { Button, Field, Surface, TextArea, TextInput } from "./ui.js";

type CreateAssignmentProps = {
  readonly assignment: Assignment;
  readonly mode: "create" | "edit";
  readonly state: PilotState;
  readonly onBack: () => void;
  readonly onDelete: (assignmentId: string) => Promise<string | null | void> | string | null | void;
  readonly onSave: (assignment: Assignment) => Promise<string | null | void> | string | null | void;
};

const newAssignmentId = (): string => `assignment-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const essayTypeOptions = ["주장 글쓰기", "근거 비교", "반론 탐색", "설명 글쓰기", "비교 글쓰기", "문학 분석"] as const;
const examplePlaceholder = (text: string): string => `예: ${text}`;
const assignmentExamples = {
  title: "QR코드는 어떻게 작은 네모 안에 정보를 담을까요?",
  passage: "식당 메뉴판, 택배 상자, 공연 티켓에서 QR코드를 자주 볼 수 있습니다. QR코드는 검은색과 흰색 네모의 배열로 정보를 표현하고, 카메라가 그 무늬를 읽어 웹사이트 주소나 결제 정보 같은 데이터로 바꾸는 기술입니다. 편리하지만 낯선 QR코드를 무심코 찍으면 악성 사이트로 연결될 수도 있어 주의가 필요합니다.",
  guidedQuestion: "책에 없는 IT 기술 하나를 고르고, 십대 독자가 이해할 수 있도록 질문형 제목, 일상 장면, 작동 원리, 쓰임, 주의할 점을 갖춘 설명문을 완성하세요.",
  question: "위 글과 비슷한 형식으로 책에 없는 IT 기술 하나를 골라 설명하는 글을 쓰세요. 기술이 쓰이는 장면, 작동 원리, 장점과 한계, 생각해 볼 질문을 포함하세요.",
  requirements: "질문형 제목과 설명형 부제 만들기\n일상에서 기술을 마주치는 장면으로 시작하기\n핵심 개념과 작동 원리를 쉬운 말로 설명하기\n기술의 쓰임과 주의할 점 함께 다루기\n마지막에 생각해 볼 질문 남기기",
  sourceGuidance: "공공기관 안내, 기술 해설 기사, 기업 개발자 문서처럼 기술의 원리와 사용 사례를 확인할 수 있는 자료를 찾고, 사용한 자료의 제목과 출처를 적으세요."
} as const;

const researchModeFromValue = (value: string): ResearchMode => {
  if (value === ResearchModes.understandingCalibration) return ResearchModes.understandingCalibration;
  if (value === ResearchModes.guidedWriting) return ResearchModes.guidedWriting;
  return ResearchModes.writingCoach;
};

const defaultCalibrationQuestion = (topic: string): string => `${topic}에 대해 읽고 AI와 질문한 뒤, 내 말로 설명하고 적용해 봅니다.`;

export function CreateAssignment(props: CreateAssignmentProps): ReactElement {
  const [assignmentId] = useState(() => (props.mode === "edit" ? props.assignment.id : newAssignmentId()));
  const initialResearchMode = props.assignment.researchMode ?? ResearchModes.writingCoach;
  const initialCalibrationConfig = props.assignment.calibrationConfig;
  const [researchMode, setResearchMode] = useState<ResearchMode>(initialResearchMode);
  const [title, setTitle] = useState(props.mode === "edit" ? props.assignment.title : "");
  const [passage, setPassage] = useState(props.mode === "edit" ? props.assignment.passage : "");
  const [question, setQuestion] = useState(props.mode === "edit" ? props.assignment.question : "");
  const [gradeLevel, setGradeLevel] = useState(props.assignment.gradeLevel);
  const [essayType, setEssayType] = useState(props.assignment.essayType ?? "주장 글쓰기");
  const [targetLength, setTargetLength] = useState(props.assignment.targetLength);
  const [minimumWordCount, setMinimumWordCount] = useState(props.assignment.minimumWordCount ?? props.assignment.targetLength.replace(/[^0-9]/g, ""));
  const [requirements, setRequirements] = useState(props.mode === "edit" ? requirementText(props.assignment) : "");
  const [sourceGuidance, setSourceGuidance] = useState(props.mode === "edit" ? props.assignment.sourceGuidance ?? "" : "");
  const [classGroupId, setClassGroupId] = useState(props.assignment.classGroupId ?? props.state.classGroups[0]?.id ?? "");
  const [startDate, setStartDate] = useState(props.assignment.startDate ?? "");
  const [startTime, setStartTime] = useState(props.assignment.startTime ?? "");
  const [dueDate, setDueDate] = useState(props.assignment.dueDate ?? "");
  const [dueTime, setDueTime] = useState(props.assignment.dueTime ?? "");
  const [calibrationTopic, setCalibrationTopic] = useState(props.mode === "edit" ? initialCalibrationConfig?.topic ?? props.assignment.title : "");
  const [calibrationDraft, setCalibrationDraft] = useState(() => calibrationDraftFromAssignment(props.assignment));
  const [error, setError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const isCalibrationMode = researchMode === ResearchModes.understandingCalibration;
  const isGuidedWritingMode = researchMode === ResearchModes.guidedWriting;
  const isWritingCoachMode = researchMode === ResearchModes.writingCoach;

  const save = async (): Promise<void> => {
    if (title.trim().length === 0) { setError("과제 제목을 입력하세요"); return; }
    if (passage.trim().length === 0) { setError(isGuidedWritingMode ? "활동 안내 또는 참고 자료를 입력하세요" : "비문학 지문을 입력하세요"); return; }
    const parsedRequirements = parseRequirements(requirements);
    const trimmedTopic = calibrationTopic.trim();
    const resolvedCalibrationDraft = resolveCalibrationDraft(calibrationDraft);
    const parsedMaxChatMinutes = resolvedCalibrationDraft.maxChatMinutes.length === 0 ? undefined : Number(resolvedCalibrationDraft.maxChatMinutes);
    if (isCalibrationMode && trimmedTopic.length === 0) { setError("연구 주제명을 입력하세요"); return; }
    if (isCalibrationMode && parsedMaxChatMinutes !== undefined && (!Number.isFinite(parsedMaxChatMinutes) || parsedMaxChatMinutes <= 0)) { setError("최대 채팅 권장 시간은 1 이상의 숫자로 입력하세요"); return; }
    if (isCalibrationMode && resolvedCalibrationDraft.errorStatement.length === 0) { setError("오류 판단 문장을 입력하세요"); return; }
    const problemPostSurveyItems = resolvedCalibrationDraft.independentProblems.flatMap((problem) => problem.postSurveyItems);
    if (isCalibrationMode && [...resolvedCalibrationDraft.preSurveyItems, ...resolvedCalibrationDraft.predictionSurveyItems, ...problemPostSurveyItems, ...resolvedCalibrationDraft.reflectionSurveyItems, ...resolvedCalibrationDraft.finalReflectionSurveyItems].some((item) => item.label.length === 0)) { setError("설문 문항을 모두 입력하세요"); return; }
    if (isCalibrationMode && resolvedCalibrationDraft.independentProblems.length === 0) { setError("실제 수행 문항을 하나 이상 남겨 두세요"); return; }
    if (isCalibrationMode && resolvedCalibrationDraft.independentProblems.some((problem) => problem.title.length === 0 || problem.prompt.length === 0)) { setError("실제 수행 문항의 제목과 지시문을 모두 입력하세요"); return; }
    if (isWritingCoachMode && question.trim().length === 0) { setError("해결할 문제를 입력하세요"); return; }
    if (isWritingCoachMode && parsedRequirements.length === 0) { setError("학생에게 보일 요구사항을 하나 이상 입력하세요"); return; }
    const createdByTeacherId = props.state.selectedActor?.role === "teacher" ? props.state.selectedActor.accountId : props.assignment.createdByTeacherId;
    const guidedQuestion = question.trim().length > 0 ? question.trim() : assignmentExamples.guidedQuestion;
    const saveError = await props.onSave({
      assignmentMode: "full_process",
      id: assignmentId,
      essayType: isCalibrationMode ? "이해 보정 연구" : isGuidedWritingMode ? "단계형 글쓰기" : essayType,
      gradeLevel,
      minimumWordCount,
      passage,
      question: isCalibrationMode ? (question.trim().length > 0 ? question.trim() : defaultCalibrationQuestion(trimmedTopic)) : isGuidedWritingMode ? guidedQuestion : question,
      researchMode,
      requirements: isCalibrationMode ? [] : isGuidedWritingMode ? ["소재 정하기", "주제 정하기", "자료 찾기", "개요 짜기", "AI 도움을 받아 글쓰기"] : parsedRequirements,
      assignedStudentIds: props.mode === "edit" ? props.assignment.assignedStudentIds ?? [] : [],
      sourceGuidance: isCalibrationMode ? "" : sourceGuidance,
      targetLength,
      ...(classGroupId.trim().length > 0 ? { classGroupId } : {}),
      ...(isCalibrationMode
        ? {
            calibrationConfig: {
              ...(resolvedCalibrationDraft.aiContext.length > 0 ? { aiContext: resolvedCalibrationDraft.aiContext } : {}),
              errorStatement: resolvedCalibrationDraft.errorStatement,
              finalReflectionSurveyItems: resolvedCalibrationDraft.finalReflectionSurveyItems,
              independentProblems: resolvedCalibrationDraft.independentProblems,
              ...(parsedMaxChatMinutes === undefined ? {} : { maxChatMinutes: parsedMaxChatMinutes }),
              predictionSurveyItems: resolvedCalibrationDraft.predictionSurveyItems,
              preSurveyItems: resolvedCalibrationDraft.preSurveyItems,
              reflectionSurveyItems: resolvedCalibrationDraft.reflectionSurveyItems,
              sourceText: passage.trim(),
              topic: trimmedTopic
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
    if (saveError !== undefined && saveError !== null) setError(saveError);
  };

  const confirmDeleteAssignment = async (): Promise<void> => {
    const deleteError = await props.onDelete(assignmentId);
    if (deleteError === undefined || deleteError === null) return;
    setDeleteConfirmOpen(false);
    setError(deleteError);
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
              <label className={isWritingCoachMode ? "assignment-type-card selected" : "assignment-type-card"}>
                <input checked={isWritingCoachMode} name="research-mode" type="radio" value={ResearchModes.writingCoach} onChange={(event) => setResearchMode(researchModeFromValue(event.currentTarget.value))} />
                <strong>글쓰기 코치</strong>
                <span>지문을 읽고 개요, 초안, 고쳐쓰기, 제출 과정을 기록합니다.</span>
              </label>
              <label className={isGuidedWritingMode ? "assignment-type-card selected" : "assignment-type-card"}>
                <input checked={isGuidedWritingMode} name="research-mode" type="radio" value={ResearchModes.guidedWriting} onChange={(event) => setResearchMode(researchModeFromValue(event.currentTarget.value))} />
                <strong>단계형 글쓰기</strong>
                <span>소재, 주제, 자료, 개요는 학생이 직접 적고 글쓰기 단계에서만 AI 도움을 받습니다.</span>
              </label>
              <label className={isCalibrationMode ? "assignment-type-card selected" : "assignment-type-card"}>
                <input checked={isCalibrationMode} name="research-mode" type="radio" value={ResearchModes.understandingCalibration} onChange={(event) => setResearchMode(researchModeFromValue(event.currentTarget.value))} />
                <strong>AI 기반 이해 보정 연구</strong>
                <span>AI 대화 뒤 자기 이해 예측과 독립 수행 자료를 수집합니다.</span>
              </label>
            </div>
          </section>
          {isCalibrationMode ? (
            <section className="calibration-mode-note" aria-label="이해 보정 연구 안내">
              이 모드는 학생이 지문을 읽고 AI와 자유롭게 대화한 뒤, 자신의 이해 수준을 예측하고 독립 과제를 수행하는 연구용 플로우입니다.
            </section>
          ) : null}
          {isGuidedWritingMode ? (
            <section className="calibration-mode-note" aria-label="단계형 글쓰기 안내">
              이 임시 모드는 학생이 한 화면에 한 단계씩 소재, 주제, 자료, 개요를 직접 적고 마지막 글쓰기 화면에서만 AI와 대화합니다.
            </section>
          ) : null}
          <Field label="과제 제목"><TextInput placeholder={examplePlaceholder(assignmentExamples.title)} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
          {isCalibrationMode ? <Field label="주제명"><TextInput placeholder="예: 양자컴퓨터, 플라스틱 사용, 소셜미디어와 민주주의" value={calibrationTopic} onChange={(event) => setCalibrationTopic(event.currentTarget.value)} /></Field> : null}
            <div className="assignment-form-grid two">
              <label className="ui-field"><span>학년 또는 난이도</span><select className="ui-control" value={gradeLevel} onChange={(event) => setGradeLevel(event.currentTarget.value)}><option>초등 고학년</option><option>중학생</option><option>고등학생</option></select></label>
            {!isCalibrationMode ? <label className="ui-field"><span>글 유형</span><select className="ui-control" value={essayType} onChange={(event) => setEssayType(event.currentTarget.value)}>{essayTypeOptions.map((option) => <option key={option}>{option}</option>)}</select></label> : <Field label="최대 채팅 권장 시간"><TextInput inputMode="numeric" value={calibrationDraft.maxChatMinutes} onChange={(event) => setCalibrationDraft({ ...calibrationDraft, maxChatMinutes: event.currentTarget.value })} /></Field>}
          </div>
          {!isCalibrationMode ? (
            <div className="assignment-form-grid two">
              <Field label="목표 분량"><TextInput value={targetLength} onChange={(event) => setTargetLength(event.currentTarget.value)} /></Field>
              <Field label="최소 글자 수"><TextInput inputMode="numeric" value={minimumWordCount} onChange={(event) => setMinimumWordCount(event.currentTarget.value)} /></Field>
            </div>
          ) : null}
          <Field label={isGuidedWritingMode ? "활동 안내 또는 참고 자료" : "비문학 지문"}><TextArea placeholder={examplePlaceholder(assignmentExamples.passage)} rows={8} value={passage} onChange={(event) => setPassage(event.currentTarget.value)} /></Field>
          {isWritingCoachMode || isGuidedWritingMode ? (
            <>
              <Field label={isGuidedWritingMode ? "글쓰기 목표" : "해결할 문제"}><TextArea placeholder={examplePlaceholder(isGuidedWritingMode ? assignmentExamples.guidedQuestion : assignmentExamples.question)} rows={4} value={question} onChange={(event) => setQuestion(event.currentTarget.value)} /></Field>
              {isWritingCoachMode ? <Field label="학생에게 보일 요구사항"><TextArea placeholder={examplePlaceholder(assignmentExamples.requirements)} rows={5} value={requirements} onChange={(event) => setRequirements(event.currentTarget.value)} /></Field> : null}
              {isWritingCoachMode ? <Field label="근거와 출처 안내"><TextArea placeholder={examplePlaceholder(assignmentExamples.sourceGuidance)} rows={3} value={sourceGuidance} onChange={(event) => setSourceGuidance(event.currentTarget.value)} /></Field> : null}
            </>
          ) : (
            <CalibrationAssignmentConfig value={calibrationDraft} onChange={setCalibrationDraft} />
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
            <Button className="form-submit" variant="primary" onClick={() => { void save(); }}>{props.mode === "edit" ? "수정 저장" : "과제 저장"}</Button>
            {props.mode === "edit" ? <Button className="assignment-delete-button" variant="ghost" onClick={() => setDeleteConfirmOpen(true)}>과제 삭제</Button> : null}
          </div>
        </div>
      </Surface>
      {deleteConfirmOpen ? (
        <div className="confirm-backdrop">
          <section aria-label="과제 삭제 확인" aria-modal="true" className="confirm-dialog" role="dialog">
            <h2>과제 삭제</h2>
            <p>정말 삭제하시겠습니까?</p>
            <div className="confirm-actions">
              <Button onClick={() => setDeleteConfirmOpen(false)}>아니오</Button>
              <Button className="assignment-delete-button" variant="ghost" onClick={() => { void confirmDeleteAssignment(); }}>예</Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
