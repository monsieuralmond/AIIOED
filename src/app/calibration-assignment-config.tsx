import type { ReactElement } from "react";
import type { Assignment } from "../shared/types.js";
import {
  configuredIndependentProblems,
  calibrationAudienceOptions,
  finalReflectionSurveyItems,
  independentProblemsForAudience,
  K_ALIGN_CONSTRUCT_FRAMEWORK_VERSION,
  K_ALIGN_KS_VERSION,
  K_ALIGN_PROTOCOL_VERSION,
  K_ALIGN_RUBRIC_VERSION,
  normalizedCalibrationAudienceLevel,
  overallSelfEvaluationItem,
  postProblemSurveyItems,
  predictionSurveyItems,
  preSurveyItems,
  reflectionSurveyItems,
  questionSetVersionForAudience,
  selfKnowledgePrompt
} from "./understanding-calibration-data.js";
import type { CalibrationAudienceLevel, IndependentProblem, IndependentProblemPrompt, LikertItem } from "./understanding-calibration-data.js";
import { Button, Field, TextArea, TextInput } from "./ui.js";

type CalibrationProblemDraft = Omit<IndependentProblemPrompt, "postSurveyItems"> & {
  readonly postSurveyItems: readonly LikertItem[];
};

export type CalibrationAssignmentDraft = {
  readonly aiContext: string;
  readonly audienceLevel: string;
  readonly constructFrameworkVersion: string;
  readonly errorStatement: string;
  readonly finalReflectionSurveyItems: readonly LikertItem[];
  readonly independentProblems: readonly CalibrationProblemDraft[];
  readonly ksVersion: string;
  readonly maxChatMinutes: string;
  readonly overallSelfEvaluationPrompt: string;
  readonly predictionSurveyItems: readonly LikertItem[];
  readonly protocolVersion: string;
  readonly questionSetVersion: string;
  readonly preSurveyItems: readonly LikertItem[];
  readonly reflectionSurveyItems: readonly LikertItem[];
  readonly rubricVersion: string;
  readonly selfKnowledgePrompt: string;
};

const defaultErrorStatement = "양자컴퓨터는 모든 문제를 일반 컴퓨터보다 빠르게 해결한다.";
const examplePlaceholder = (text: string): string => `예: ${text}`;

const surveyDraftItems = (defaults: readonly LikertItem[], configured: readonly LikertItem[] | undefined): readonly LikertItem[] =>
  configured === undefined
    ? defaults.map((defaultItem) => ({ ...defaultItem, label: "" }))
    : configured.map((item) => {
        const defaultItem = defaults.find((candidate) => candidate.id === item.id);
        if (defaultItem === undefined) return item;
        if (item.label === defaultItem.label) return { ...defaultItem, ...item, label: "" };
        return { ...defaultItem, ...item };
      });

const problemDefaultsForAudience = (audienceLevel: string): readonly IndependentProblem[] =>
  independentProblemsForAudience(audienceLevel);

const problemDraftsFromDefaults = (audienceLevel: string): readonly CalibrationProblemDraft[] =>
  problemDefaultsForAudience(audienceLevel).map((problem) => ({
    number: problem.number,
    postSurveyItems: surveyDraftItems(problem.postSurveyItems, undefined),
    prompt: "",
    title: ""
  }));

const problemPrompts = (assignment: Assignment, audienceLevel: string): readonly CalibrationProblemDraft[] =>
  configuredIndependentProblems(assignment.calibrationConfig?.independentProblems, audienceLevel).map((problem) => {
    const defaultProblem = problemDefaultsForAudience(audienceLevel).find((item) => item.number === problem.number);
    return {
      ...(problem.constructKey === undefined ? {} : { constructKey: problem.constructKey }),
      ...(problem.itemRole === undefined ? {} : { itemRole: problem.itemRole }),
      number: problem.number,
      postSurveyItems: surveyDraftItems(defaultProblem?.postSurveyItems ?? postProblemSurveyItems, problem.postSurveyItems),
      prompt: defaultProblem?.prompt === problem.prompt ? "" : problem.prompt,
      title: defaultProblem?.title === problem.title ? "" : problem.title
    };
  });

export const calibrationDraftFromAssignment = (assignment: Assignment): CalibrationAssignmentDraft => {
  const audienceLevel = normalizedCalibrationAudienceLevel(assignment.calibrationConfig?.audienceLevel);
  return {
    aiContext: assignment.calibrationConfig?.aiContext ?? "",
    audienceLevel,
    constructFrameworkVersion: assignment.calibrationConfig?.constructFrameworkVersion ?? K_ALIGN_CONSTRUCT_FRAMEWORK_VERSION,
    errorStatement: assignment.calibrationConfig?.errorStatement === defaultErrorStatement ? "" : assignment.calibrationConfig?.errorStatement ?? "",
    finalReflectionSurveyItems: surveyDraftItems(finalReflectionSurveyItems, assignment.calibrationConfig?.finalReflectionSurveyItems),
    independentProblems: problemPrompts(assignment, audienceLevel),
    ksVersion: assignment.calibrationConfig?.ksVersion ?? K_ALIGN_KS_VERSION,
    maxChatMinutes: assignment.calibrationConfig?.maxChatMinutes?.toString() ?? "10",
    overallSelfEvaluationPrompt: assignment.calibrationConfig?.overallSelfEvaluationPrompt ?? overallSelfEvaluationItem.label,
    predictionSurveyItems: surveyDraftItems(predictionSurveyItems, assignment.calibrationConfig?.predictionSurveyItems),
    protocolVersion: assignment.calibrationConfig?.protocolVersion ?? K_ALIGN_PROTOCOL_VERSION,
    questionSetVersion: assignment.calibrationConfig?.questionSetVersion ?? questionSetVersionForAudience(audienceLevel),
    preSurveyItems: surveyDraftItems(preSurveyItems, assignment.calibrationConfig?.preSurveyItems),
    reflectionSurveyItems: surveyDraftItems(reflectionSurveyItems, assignment.calibrationConfig?.reflectionSurveyItems),
    rubricVersion: assignment.calibrationConfig?.rubricVersion ?? K_ALIGN_RUBRIC_VERSION,
    selfKnowledgePrompt: assignment.calibrationConfig?.selfKnowledgePrompt ?? selfKnowledgePrompt
  };
};

const resolveSurveyItems = (defaults: readonly LikertItem[], items: readonly LikertItem[]): readonly LikertItem[] =>
  items.map((item) => {
    const defaultItem = defaults.find((candidate) => candidate.id === item.id);
    const label = item.label.trim();
    const resolvedLabel = label.length > 0 ? label : defaultItem?.label ?? "";
    return defaultItem === undefined ? { ...item, label: resolvedLabel } : { ...defaultItem, ...item, label: resolvedLabel };
  });

const resolveProblemPrompts = (items: readonly CalibrationProblemDraft[], audienceLevel: string): readonly CalibrationProblemDraft[] =>
  items.flatMap((problem) => {
    const defaultProblem = problemDefaultsForAudience(audienceLevel).find((candidate) => candidate.number === problem.number);
    if (defaultProblem === undefined) return [];
    const title = problem.title.trim();
    const prompt = problem.prompt.trim();
    return [{
      number: defaultProblem.number,
      ...(defaultProblem.constructKey === undefined ? {} : { constructKey: defaultProblem.constructKey }),
      ...(defaultProblem.itemRole === undefined ? {} : { itemRole: defaultProblem.itemRole }),
      postSurveyItems: resolveSurveyItems(defaultProblem.postSurveyItems, problem.postSurveyItems),
      prompt: prompt.length === 0 ? defaultProblem.prompt : prompt,
      title: title.length === 0 ? defaultProblem.title : title
    }];
  });

export const resolveCalibrationDraft = (draft: CalibrationAssignmentDraft): CalibrationAssignmentDraft => {
  const audienceLevel = normalizedCalibrationAudienceLevel(draft.audienceLevel);
  return {
    aiContext: draft.aiContext.trim(),
    audienceLevel,
    constructFrameworkVersion: draft.constructFrameworkVersion.trim().length === 0 ? K_ALIGN_CONSTRUCT_FRAMEWORK_VERSION : draft.constructFrameworkVersion.trim(),
    errorStatement: draft.errorStatement.trim().length === 0 ? defaultErrorStatement : draft.errorStatement.trim(),
    finalReflectionSurveyItems: resolveSurveyItems(finalReflectionSurveyItems, draft.finalReflectionSurveyItems),
    independentProblems: resolveProblemPrompts(draft.independentProblems, audienceLevel),
    ksVersion: draft.ksVersion.trim().length === 0 ? K_ALIGN_KS_VERSION : draft.ksVersion.trim(),
    maxChatMinutes: draft.maxChatMinutes.trim(),
    overallSelfEvaluationPrompt: draft.overallSelfEvaluationPrompt.trim().length === 0 ? overallSelfEvaluationItem.label : draft.overallSelfEvaluationPrompt.trim(),
    predictionSurveyItems: resolveSurveyItems(predictionSurveyItems, draft.predictionSurveyItems),
    protocolVersion: draft.protocolVersion.trim().length === 0 ? K_ALIGN_PROTOCOL_VERSION : draft.protocolVersion.trim(),
    questionSetVersion: draft.questionSetVersion.trim().length === 0 ? questionSetVersionForAudience(audienceLevel) : draft.questionSetVersion.trim(),
    preSurveyItems: resolveSurveyItems(preSurveyItems, draft.preSurveyItems),
    reflectionSurveyItems: resolveSurveyItems(reflectionSurveyItems, draft.reflectionSurveyItems),
    rubricVersion: draft.rubricVersion.trim().length === 0 ? K_ALIGN_RUBRIC_VERSION : draft.rubricVersion.trim(),
    selfKnowledgePrompt: draft.selfKnowledgePrompt.trim().length === 0 ? selfKnowledgePrompt : draft.selfKnowledgePrompt.trim()
  };
};

const updateLikertItem = (items: readonly LikertItem[], id: string, label: string): readonly LikertItem[] =>
  items.map((item) => (item.id === id ? { ...item, label } : item));

const updateSurveyItemType = (items: readonly LikertItem[], id: string, responseType: NonNullable<LikertItem["responseType"]>): readonly LikertItem[] =>
  items.map((item) => (item.id === id ? { ...item, responseType } : item));

const surveyResponseTypeFromValue = (value: string): NonNullable<LikertItem["responseType"]> => {
  if (value === "slider_0_100" || value === "text" || value === "yes_no") return value;
  return "likert";
};

const nextSurveyItemId = (items: readonly LikertItem[], prefix: string): string => {
  const ids = new Set(items.map((item) => item.id));
  let index = 1;
  let candidate = `${prefix}_custom_${index}`;
  while (ids.has(candidate)) {
    index += 1;
    candidate = `${prefix}_custom_${index}`;
  }
  return candidate;
};

const addSurveyItem = (items: readonly LikertItem[], prefix: string): readonly LikertItem[] => [
  ...items,
  { id: nextSurveyItemId(items, prefix), label: "", responseType: "likert" }
];

const removeSurveyItem = (items: readonly LikertItem[], id: string): readonly LikertItem[] =>
  items.filter((item) => item.id !== id);

const compareProblemNumber = (left: CalibrationProblemDraft, right: CalibrationProblemDraft): number => left.number - right.number;

const addProblemPromptForAudience = (items: readonly CalibrationProblemDraft[], audienceLevel: string): readonly CalibrationProblemDraft[] => {
  const existingNumbers = new Set(items.map((item) => item.number));
  const defaultProblem = problemDefaultsForAudience(audienceLevel).find((problem) => !existingNumbers.has(problem.number));
  if (defaultProblem === undefined) return items;
  return [...items, { number: defaultProblem.number, postSurveyItems: surveyDraftItems(defaultProblem.postSurveyItems, undefined), prompt: "", title: "" }].sort(compareProblemNumber);
};

const removeProblemPrompt = (items: readonly CalibrationProblemDraft[], number: CalibrationProblemDraft["number"]): readonly CalibrationProblemDraft[] =>
  items.length <= 1 ? items : items.filter((item) => item.number !== number);

const updateProblemTitle = (items: readonly CalibrationProblemDraft[], number: CalibrationProblemDraft["number"], title: string): readonly CalibrationProblemDraft[] =>
  items.map((item) => (item.number === number ? { ...item, title } : item));

const updateProblemPrompt = (items: readonly CalibrationProblemDraft[], number: CalibrationProblemDraft["number"], prompt: string): readonly CalibrationProblemDraft[] =>
  items.map((item) => (item.number === number ? { ...item, prompt } : item));

const updateProblemPostSurveyItems = (items: readonly CalibrationProblemDraft[], number: CalibrationProblemDraft["number"], postSurveyItems: readonly LikertItem[]): readonly CalibrationProblemDraft[] =>
  items.map((item) => (item.number === number ? { ...item, postSurveyItems } : item));

const applyAudiencePreset = (draft: CalibrationAssignmentDraft, audienceLevel: CalibrationAudienceLevel): CalibrationAssignmentDraft => ({
  ...draft,
  audienceLevel,
  independentProblems: problemDraftsFromDefaults(audienceLevel),
  questionSetVersion: questionSetVersionForAudience(audienceLevel)
});

function TrashIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

type SurveyListProps = {
  readonly customIdPrefix: string;
  readonly defaults: readonly LikertItem[];
  readonly items: readonly LikertItem[];
  readonly label: string;
  readonly onChange: (items: readonly LikertItem[]) => void;
};

function SurveyList(props: SurveyListProps): ReactElement {
  return (
    <div className="transfer-choice-list">
      <div className="config-list-heading">
        <h2>{props.label}</h2>
        <Button className="config-small-button" variant="secondary" onClick={() => props.onChange(addSurveyItem(props.items, props.customIdPrefix))}>문항 추가</Button>
      </div>
      {props.items.map((item, index) => (
        <div className="survey-item-row" key={item.id}>
          <span className="survey-item-key"><strong>문항 {index + 1}</strong><small>{item.id}</small></span>
          <select aria-label={`${props.label} ${item.id} 응답 방식`} className="survey-type-select" value={item.responseType ?? "likert"} onChange={(event) => props.onChange(updateSurveyItemType(props.items, item.id, surveyResponseTypeFromValue(event.currentTarget.value)))}>
            <option value="likert">1~5점</option>
            <option value="slider_0_100">0~100점</option>
            <option value="yes_no">예/아니오</option>
            <option value="text">자유 서술</option>
          </select>
          <TextInput aria-label={`${props.label} ${item.id}`} className="reference-input" placeholder={examplePlaceholder(props.defaults.find((defaultItem) => defaultItem.id === item.id)?.label ?? "새 문항을 입력하세요.")} value={item.label} onChange={(event) => props.onChange(updateLikertItem(props.items, item.id, event.currentTarget.value))} />
          <Button aria-label={`${props.label} ${item.id} 삭제`} className="config-delete-button" title={`${props.label} ${item.id} 삭제`} variant="ghost" onClick={() => props.onChange(removeSurveyItem(props.items, item.id))}><TrashIcon /></Button>
        </div>
      ))}
    </div>
  );
}

type CalibrationAssignmentConfigProps = {
  readonly value: CalibrationAssignmentDraft;
  readonly onChange: (value: CalibrationAssignmentDraft) => void;
};

export function CalibrationAssignmentConfig(props: CalibrationAssignmentConfigProps): ReactElement {
  const audienceLevel = normalizedCalibrationAudienceLevel(props.value.audienceLevel);
  const audienceDescription = calibrationAudienceOptions.find((option) => option.value === audienceLevel)?.description;
  const problemDefaults = problemDefaultsForAudience(audienceLevel);
  return (
    <section className="calibration-config-section" aria-label="이해 보정 연구 설정">
      <Field label="AI 보조자료 또는 설명 자료"><TextArea placeholder={examplePlaceholder("지문만으로 부족한 배경 설명이 있으면 입력하세요. 없으면 비워 둡니다.")} rows={4} value={props.value.aiContext} onChange={(event) => props.onChange({ ...props.value, aiContext: event.currentTarget.value })} /></Field>
      <div className="account-form-grid">
        <label className="ui-field"><span>대상</span><select className="ui-control" value={audienceLevel} onChange={(event) => props.onChange(applyAudiencePreset(props.value, event.currentTarget.value as CalibrationAudienceLevel))}>{calibrationAudienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{audienceDescription === undefined ? null : <small className="field-helper">{audienceDescription}</small>}</label>
        <Field label="프로토콜 버전"><TextInput className="reference-input" value={props.value.protocolVersion} onChange={(event) => props.onChange({ ...props.value, protocolVersion: event.currentTarget.value })} /></Field>
        <Field label="문항 세트 버전"><TextInput className="reference-input" value={props.value.questionSetVersion} onChange={(event) => props.onChange({ ...props.value, questionSetVersion: event.currentTarget.value })} /></Field>
        <Field label="KS 버전"><TextInput className="reference-input" value={props.value.ksVersion} onChange={(event) => props.onChange({ ...props.value, ksVersion: event.currentTarget.value })} /></Field>
      </div>
      <Field label="오류 판단 문장"><TextArea className="reference-input" placeholder={examplePlaceholder(defaultErrorStatement)} rows={3} value={props.value.errorStatement} onChange={(event) => props.onChange({ ...props.value, errorStatement: event.currentTarget.value })} /></Field>
      <SurveyList customIdPrefix="pre" defaults={preSurveyItems} items={props.value.preSurveyItems} label="사전 설문 문항" onChange={(items) => props.onChange({ ...props.value, preSurveyItems: items })} />
      <SurveyList customIdPrefix="pred" defaults={predictionSurveyItems} items={props.value.predictionSurveyItems} label="수행 예측 설문 문항" onChange={(items) => props.onChange({ ...props.value, predictionSurveyItems: items })} />
      <div className="transfer-choice-list">
        <div className="config-list-heading">
          <h2>실제 수행 문항</h2>
          <Button className="config-small-button" disabled={props.value.independentProblems.length >= problemDefaults.length} variant="secondary" onClick={() => props.onChange({ ...props.value, independentProblems: addProblemPromptForAudience(props.value.independentProblems, audienceLevel) })}>문항 추가</Button>
        </div>
        {props.value.independentProblems.map((problem) => (
          <div className="calibration-problem-editor" key={problem.number}>
            <div className="calibration-problem-editor-header">
              <span>문제 {problem.number}</span>
              <Button aria-label={`문제 ${problem.number} 삭제`} className="config-delete-button" disabled={props.value.independentProblems.length <= 1} title={`문제 ${problem.number} 삭제`} variant="ghost" onClick={() => props.onChange({ ...props.value, independentProblems: removeProblemPrompt(props.value.independentProblems, problem.number) })}><TrashIcon /></Button>
            </div>
            <Field label={`문제 ${problem.number} 제목`}><TextInput className="reference-input" placeholder={examplePlaceholder(problemDefaults.find((item) => item.number === problem.number)?.title ?? "문제 제목을 입력하세요.")} value={problem.title} onChange={(event) => props.onChange({ ...props.value, independentProblems: updateProblemTitle(props.value.independentProblems, problem.number, event.currentTarget.value) })} /></Field>
            <Field label={`문제 ${problem.number} 지시문`}><TextArea className="reference-input" placeholder={examplePlaceholder(problemDefaults.find((item) => item.number === problem.number)?.prompt ?? "문제 지시문을 입력하세요.")} rows={4} value={problem.prompt} onChange={(event) => props.onChange({ ...props.value, independentProblems: updateProblemPrompt(props.value.independentProblems, problem.number, event.currentTarget.value) })} /></Field>
            <SurveyList customIdPrefix={`problem${problem.number}_post`} defaults={problemDefaults.find((item) => item.number === problem.number)?.postSurveyItems ?? postProblemSurveyItems} items={problem.postSurveyItems} label={`문제 ${problem.number} 직후 설문 문항`} onChange={(items) => props.onChange({ ...props.value, independentProblems: updateProblemPostSurveyItems(props.value.independentProblems, problem.number, items) })} />
          </div>
        ))}
      </div>
      <Field label="Q6 Self-Knowledge 문항"><TextArea className="reference-input" placeholder={examplePlaceholder(selfKnowledgePrompt)} rows={4} value={props.value.selfKnowledgePrompt} onChange={(event) => props.onChange({ ...props.value, selfKnowledgePrompt: event.currentTarget.value })} /></Field>
      <Field label="전체 자기평가 문항"><TextInput className="reference-input" placeholder={examplePlaceholder(overallSelfEvaluationItem.label)} value={props.value.overallSelfEvaluationPrompt} onChange={(event) => props.onChange({ ...props.value, overallSelfEvaluationPrompt: event.currentTarget.value })} /></Field>
      <SurveyList customIdPrefix="reflection" defaults={reflectionSurveyItems} items={props.value.reflectionSurveyItems} label="문제 후 회고 설문 문항" onChange={(items) => props.onChange({ ...props.value, reflectionSurveyItems: items })} />
    </section>
  );
}
