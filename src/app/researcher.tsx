import { useState } from "react";
import type { ReactElement } from "react";
import { ResearchModes } from "../shared/research.js";
import type { Assignment, ClassGroup, PilotState } from "../shared/types.js";
import { AssignmentAssignDialog, AssignmentPreview } from "./assignment-dialogs.js";
import { Button, Field, TextInput } from "./ui.js";

type ResearcherListProps = {
  readonly activeAssignment: Assignment | null;
  readonly state: PilotState;
  readonly onAccounts: () => void;
  readonly onCreate: () => void;
  readonly onEditAssignment: (assignmentId: string) => void;
  readonly onReview: () => void;
  readonly onAssign: (assignment: Assignment) => void;
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

const studentsForAssignment = (state: PilotState, assignment: Assignment) =>
  state.students.filter((student) => assignment.classGroupId === undefined || student.classGroupId === assignment.classGroupId);

const assignmentProgress = (state: PilotState, assignment: Assignment): AssignmentProgress => {
  const sessions = state.sessions.filter((session) => session.assignment.id === assignment.id);
  return {
    assignedStudentCount: studentsForAssignment(state, assignment).length,
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
  const [assignAssignmentId, setAssignAssignmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<readonly string[]>([]);
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("all");
  const previewAssignment = props.state.assignments.find((item) => item.id === previewAssignmentId) ?? null;
  const assignAssignment = props.state.assignments.find((item) => item.id === assignAssignmentId) ?? null;
  const assignments = props.activeAssignment === null
    ? props.state.assignments
    : [props.activeAssignment, ...props.state.assignments.filter((assignment) => assignment.id !== props.activeAssignment?.id)];
  const categoryFilters = uniqueStrings(assignments.map(assignmentCategory));
  const gradeFilters = uniqueStrings(assignments.map((assignment) => assignment.gradeLevel));
  const normalizedSearch = normalizeFilterText(searchQuery);
  const activeFilterCount = (normalizedSearch.length > 0 ? 1 : 0) + selectedCategories.length + (selectedGradeLevel === "all" ? 0 : 1);
  const canOpenStudentPreview = props.activeAssignment !== null && assignmentProgress(props.state, props.activeAssignment).assignedStudentCount > 0;
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
  const openPreview = (assignment: Assignment): void => setPreviewAssignmentId(assignment.id);
  const openAssign = (assignment: Assignment): void => setAssignAssignmentId(assignment.id);
  const clearFilters = (): void => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedGradeLevel("all");
  };
  const saveAssignment = (assignment: Assignment): void => {
    props.onAssign(assignment);
    setAssignAssignmentId(null);
  };
  return (
    <main className="researcher-layout">
      <aside className="researcher-rail" aria-label="연구자 메뉴">
        <Button className="rail-item active" variant="ghost">과제 둘러보기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onCreate}>내 과제 만들기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onReview}>학생 현황</Button>
        <Button className="rail-item" disabled={!canOpenStudentPreview} variant="ghost" onClick={props.onStudent}>학생 화면 보기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onExport}>로그 보기</Button>
        <Button className="rail-item" variant="ghost" onClick={props.onAccounts}>계정 관리</Button>
      </aside>
      <section className="researcher-main">
        <section className="prompt-explorer" aria-label="과제 목록">
          <div className="prompt-toolbar">
            <div className="prompt-toolbar-text">
              <h1>과제 둘러보기</h1>
              <p>학생에게 배정할 과제를 고르거나 직접 만듭니다.</p>
            </div>
            <div className="prompt-toolbar-actions">
              <Button aria-expanded={showFilters} aria-controls="assignment-filter-panel" variant="secondary" onClick={() => setShowFilters((current) => !current)}>
                검색 조건{activeFilterCount === 0 ? "" : ` ${activeFilterCount}`}
              </Button>
              <Button aria-label="새 과제 만들기" variant="ghost" onClick={props.onCreate}>+ 직접 만들기</Button>
            </div>
          </div>
          <div className="prompt-workbench">
            {showFilters ? (
              <section className="prompt-filter-panel" id="assignment-filter-panel" aria-label="검색 조건">
                <div className="prompt-filter-grid">
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
                </div>
                <div className="prompt-filter-actions">
                  <span>{filteredAssignments.length}개 과제 표시</span>
                  <Button disabled={activeFilterCount === 0} variant="ghost" onClick={clearFilters}>초기화</Button>
                </div>
              </section>
            ) : null}
            <div className="prompt-list" aria-label="활성 과제">
              {filteredAssignments.length === 0 ? <p className="prompt-empty-state">{assignments.length === 0 ? "아직 과제가 없습니다. 직접 만들기를 눌러 새 과제를 만드세요." : "조건에 맞는 과제가 없습니다."}</p> : null}
              {filteredAssignments.map((assignment) => {
                const isActive = assignment.id === props.activeAssignment?.id;
                const classGroup = props.state.classGroups.find((item) => item.id === assignment.classGroupId);
                const progress = assignmentProgress(props.state, assignment);
                return (
                  <article aria-label={`${assignment.title} 과제`} className={isActive ? "prompt-row active" : "prompt-row"} key={assignment.id}>
                    <div>
                      <div className="prompt-row-title">
                        <h2>{assignment.title}</h2>
                        {isActive ? <span className="assignment-active-badge">학생 화면에 표시 중</span> : null}
                      </div>
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
                      <Button variant="ghost" onClick={() => props.onEditAssignment(assignment.id)}>수정</Button>
                      <Button variant="secondary" onClick={() => openPreview(assignment)}>미리보기</Button>
                      <Button variant="primary" onClick={() => openAssign(assignment)}>배정</Button>
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
          onClose={() => setPreviewAssignmentId(null)}
        />
      )}
      {assignAssignment === null ? null : <button aria-label="배정 닫기" className="preview-backdrop" type="button" onClick={() => setAssignAssignmentId(null)} />}
      {assignAssignment === null ? null : (
        <AssignmentAssignDialog
          assignment={assignAssignment}
          classGroups={props.state.classGroups}
          onAssign={saveAssignment}
          onClose={() => setAssignAssignmentId(null)}
        />
      )}
    </main>
  );
}
