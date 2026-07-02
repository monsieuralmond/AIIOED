import { useState } from "react";
import type { ReactElement } from "react";
import { ResearchModes } from "../shared/research";
import type { Assignment, ClassGroup, PilotState } from "../shared/types";
import { defaultRequirements } from "./assignment-requirements";
import { Button, Field, TextInput } from "./ui";

const defaultCategoryFilters = ["주장 글쓰기", "근거 비교", "반론 탐색"] as const;

type ResearcherListProps = {
  readonly assignment: Assignment;
  readonly state: PilotState;
  readonly onAccounts: () => void;
  readonly onCreate: () => void;
  readonly onEditAssignment: (assignmentId: string) => void;
  readonly onReview: () => void;
  readonly onAssign: (assignment: Assignment) => void;
  readonly onSelectAssignment: (assignmentId: string) => void;
  readonly onStudent: () => void;
  readonly onExport: () => void;
};

const normalizeFilterText = (value: string): string => value.trim().toLocaleLowerCase("ko-KR");

const assignmentCategory = (assignment: Assignment): string =>
  assignment.researchMode === ResearchModes.understandingCalibration ? "이해 보정 연구" : assignment.essayType ?? "주장 글쓰기";

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values.filter((value) => value.trim().length > 0))];

type AssignmentProgress = {
  readonly assignedStudentCount: number;
  readonly inProgressCount: number;
  readonly submittedCount: number;
};

const assignmentProgress = (state: PilotState, assignment: Assignment): AssignmentProgress => {
  const classGroup = state.classGroups.find((item) => item.id === assignment.classGroupId);
  const assignedStudentCount = classGroup === undefined ? state.students.length : classGroup.studentIds.length;
  const sessions = state.sessions.filter((session) => session.assignment.id === assignment.id);
  return {
    assignedStudentCount,
    inProgressCount: sessions.filter((session) => session.finalSubmission === null && session.events.length > 0).length,
    submittedCount: sessions.filter((session) => session.finalSubmission !== null).length
  };
};

const assignmentMatchesSearch = (assignment: Assignment, classGroup: ClassGroup | undefined, normalizedSearch: string): boolean => {
  if (normalizedSearch.length === 0) return true;
  const searchableText = [
    assignment.title,
    assignment.question,
    assignment.passage,
    assignment.gradeLevel,
    assignment.targetLength,
    assignmentCategory(assignment),
    assignment.calibrationConfig?.topic ?? "",
    assignment.calibrationConfig?.errorStatement ?? "",
    classGroup?.name ?? "전체 학생"
  ].join(" ");
  return normalizeFilterText(searchableText).includes(normalizedSearch);
};

export function ResearcherList(props: ResearcherListProps): ReactElement {
  const [previewAssignmentId, setPreviewAssignmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<readonly string[]>([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("all");
  const previewAssignment = props.state.assignments.find((item) => item.id === previewAssignmentId) ?? null;
  const assignments = [
    props.assignment,
    ...props.state.assignments.filter((assignment) => assignment.id !== props.assignment.id)
  ];
  const categoryFilters = uniqueStrings([...defaultCategoryFilters, ...assignments.map(assignmentCategory)]);
  const gradeFilters = uniqueStrings(assignments.map((assignment) => assignment.gradeLevel));
  const normalizedSearch = normalizeFilterText(searchQuery);
  const filteredAssignments = assignments.filter((assignment) => {
    const classGroup = props.state.classGroups.find((item) => item.id === assignment.classGroupId);
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(assignmentCategory(assignment));
    const matchesGrade = selectedGradeLevel === "all" || assignment.gradeLevel === selectedGradeLevel;
    return matchesCategory && matchesGrade && assignmentMatchesSearch(assignment, classGroup, normalizedSearch);
  });
  const toggleCategory = (category: string): void => {
    setSelectedCategories((current) => (
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category]
    ));
  };
  const openPreview = (assignment: Assignment): void => {
    props.onSelectAssignment(assignment.id);
    setPreviewAssignmentId(assignment.id);
  };
  const assignPreview = (assignment: Assignment): void => {
    props.onAssign(assignment);
    setPreviewAssignmentId(null);
  };
  return (
    <main className="researcher-layout">
      <aside className="researcher-rail" aria-label="연구자 메뉴">
        <Button className="rail-item active" variant="ghost">과제 둘러보기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onCreate}>내 과제 만들기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onReview}>학생 현황</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onStudent}>학생 화면 보기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onExport}>로그 보기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onAccounts}>계정 관리</Button>
      </aside>
      <section className="researcher-main">
        <section className="prompt-explorer" aria-label="과제 목록">
          <div className="prompt-tabs" role="tablist" aria-label="과제 범주">
            <button aria-selected="true" role="tab" type="button">현재 과제</button>
            <button aria-selected="false" role="tab" type="button">사회 · 과학</button>
            <button aria-selected="false" role="tab" type="button">내 보관함</button>
            <Button className="prompt-create" aria-label="새 과제 만들기" variant="ghost" onClick={props.onCreate}>+ 직접 만들기</Button>
          </div>
          <div className="prompt-workbench">
            <aside className="prompt-filter" aria-label="과제 필터">
              <Field label="검색"><TextInput placeholder="예: 환경, 미디어" value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} /></Field>
              <div className="filter-group" aria-label="범주">
                <strong>범주</strong>
                {categoryFilters.map((category) => (
                  <label key={category}>
                    <input checked={selectedCategories.includes(category)} type="checkbox" onChange={() => toggleCategory(category)} />
                    {category}
                  </label>
                ))}
              </div>
              <div className="filter-group" aria-label="학년 필터">
                <div className="ui-field">
                  <label htmlFor="assignment-grade-filter">학년</label>
                  <select className="ui-control" id="assignment-grade-filter" value={selectedGradeLevel} onChange={(event) => setSelectedGradeLevel(event.currentTarget.value)}>
                    <option value="all">전체 학년</option>
                    {gradeFilters.map((gradeLevel) => <option key={gradeLevel} value={gradeLevel}>{gradeLevel}</option>)}
                  </select>
                </div>
              </div>
            </aside>
            <div className="prompt-list" aria-label="활성 과제">
              {filteredAssignments.length === 0 ? <p className="prompt-empty-state">조건에 맞는 과제가 없습니다.</p> : null}
              {filteredAssignments.map((assignment) => {
                const isActive = assignment.id === props.assignment.id;
                const classGroup = props.state.classGroups.find((item) => item.id === assignment.classGroupId);
                const progress = assignmentProgress(props.state, assignment);
                return (
                  <article aria-label={`${assignment.title} 과제`} className={isActive ? "prompt-row active" : "prompt-row"} key={assignment.id}>
                    <div>
                      <h2>{assignment.title}</h2>
                      <p>{assignment.question}</p>
                      <dl className="assignment-row-progress" aria-label="문제별 진행 요약">
                        <div><dt>배정 학생</dt><dd>{progress.assignedStudentCount}명</dd></div>
                        <div><dt>진행 중</dt><dd>{progress.inProgressCount}명</dd></div>
                        <div><dt>제출 완료</dt><dd>{progress.submittedCount}명</dd></div>
                      </dl>
                      <div className="tag-row">
                        <span>비문학</span>
                        <span>{assignment.researchMode === ResearchModes.understandingCalibration ? "이해 보정 연구" : "글쓰기 코치"}</span>
                        <span>{assignment.gradeLevel}</span>
                        <span>{assignment.essayType ?? "주장 글쓰기"}</span>
                        <span>{classGroup?.name ?? "전체 학생"}</span>
                      </div>
                    </div>
                    <div className="prompt-row-actions">
                      <span className="heart-button" aria-hidden="true">♡</span>
                      <Button variant="ghost" onClick={() => props.onEditAssignment(assignment.id)}>수정</Button>
                      <Button onClick={() => openPreview(assignment)}>{isActive ? "미리보기 및 배정" : "선택 및 미리보기"}</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </section>
      {previewAssignment === null ? null : <button aria-label="미리보기 닫기" className="preview-backdrop" type="button" onClick={() => setPreviewAssignmentId(null)} />}
      {previewAssignment === null ? null : (
        <AssignmentPreview
          assignment={previewAssignment}
          classGroups={props.state.classGroups}
          onAssign={assignPreview}
          onClose={() => setPreviewAssignmentId(null)}
        />
      )}
    </main>
  );
}

function AssignmentPreview(props: { readonly assignment: Assignment; readonly classGroups: readonly ClassGroup[]; readonly onAssign: (assignment: Assignment) => void; readonly onClose: () => void }): ReactElement {
  const [classGroupId, setClassGroupId] = useState(props.assignment.classGroupId ?? props.classGroups[0]?.id ?? "");
  const selectedClassGroup = props.classGroups.find((classGroup) => classGroup.id === classGroupId);
  const isCalibrationAssignment = props.assignment.researchMode === ResearchModes.understandingCalibration;
  const chatLimitLabel =
    props.assignment.calibrationConfig?.maxChatMinutes === undefined ? "제한 없음" : `${props.assignment.calibrationConfig.maxChatMinutes}분`;
  const saveAssignment = (): void => {
    props.onAssign({ ...props.assignment, classGroupId });
  };

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
          <h2>적용 선택지</h2>
          <ul>
            {props.assignment.calibrationConfig?.transferChoices?.map((choice) => <li key={choice.id}>{choice.label}. {choice.text}</li>)}
          </ul>
        </section>
      ) : (
        <section className="preview-requirements" aria-label="학생에게 보일 요구사항">
          <h2>학생에게 보일 요구사항</h2>
          <ul>
            {defaultRequirements(props.assignment).map((requirement) => <li key={requirement}>{requirement}</li>)}
          </ul>
        </section>
      )}
      <h2>지문</h2>
      <p>{props.assignment.passage}</p>
      <section className="preview-requirements" aria-label="배정 대상">
        <Field label="배정할 반">
          <select className="ui-control" value={classGroupId} onChange={(event) => setClassGroupId(event.currentTarget.value)}>
            {props.classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
          </select>
        </Field>
        <p>{selectedClassGroup === undefined ? "계정 관리에서 반을 먼저 만들어야 배정할 수 있습니다." : `${selectedClassGroup.name} 학생 ${selectedClassGroup.studentIds.length}명에게 보입니다.`}</p>
      </section>
      <div className="preview-actions">
        <Button onClick={props.onClose}>닫기</Button>
        <Button disabled={selectedClassGroup === undefined} variant="primary" onClick={saveAssignment}>선택한 반에 배정</Button>
      </div>
    </div>
  );
}
