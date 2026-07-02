import type { ReactElement } from "react";
import type { PilotSession, WritingStage } from "../shared/types";

const assignmentChecklist: Readonly<Record<WritingStage, { readonly title: string; readonly items: readonly string[] }>> = {
  reading: {
    items: ["문제가 무엇을 묻는지 한 문장으로 말할 수 있나요?", "지문에서 찬성 쪽과 반대 쪽 단서를 모두 찾았나요?", "내가 쓸 글의 길이와 조건을 확인했나요?"],
    title: "읽기 전에 확인"
  },
  review: {
    items: ["AI가 대신 쓴 문장이 아니라 내가 판단해서 쓴 글인가요?", "근거와 출처 표현이 빠지지 않았나요?", "마지막으로 문제에 답하고 있는지 확인했나요?"],
    title: "제출 전에 확인"
  },
  thinking: {
    items: ["중심 생각이 문제에 직접 답하나요?", "근거 두 가지가 지문이나 자료에서 나온 것인가요?", "반론을 하나 이상 떠올렸나요?"],
    title: "개요 쓰기 전에 확인"
  },
  writing: {
    items: ["첫 문단에서 내 주장이 분명히 보이나요?", "각 근거 뒤에 왜 그 근거가 필요한지 설명했나요?", "반론을 인정한 뒤 내 주장이 여전히 필요한 이유를 적었나요?"],
    title: "초안 쓰기 전에 확인"
  }
};

const writingStageForReference = (stage: PilotSession["currentStage"]): WritingStage => {
  if (stage === "thinking" || stage === "writing" || stage === "review") return stage;
  return "reading";
};

export function AssignmentReference(props: { readonly session: PilotSession; readonly onClose: () => void }): ReactElement {
  const checklist = assignmentChecklist[writingStageForReference(props.session.currentStage)];
  const teacherRequirements = props.session.assignment.requirements ?? checklist.items;
  return (
    <div aria-label="과제 내용" className="preview-dialog" role="dialog">
      <button aria-label="닫기" className="preview-close" type="button" onClick={props.onClose}>x</button>
      <h1>{props.session.assignment.title}</h1>
      <div className="tag-row"><span>{props.session.assignment.gradeLevel}</span><span>{props.session.assignment.targetLength}</span><span>{props.session.assignment.essayType ?? "주장 글쓰기"}</span></div>
      <section className="reference-checklist" aria-label={checklist.title}>
        <p className="support-label">{checklist.title}</p>
        <ul>{teacherRequirements.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      {props.session.assignment.sourceGuidance === undefined ? null : <p className="source-guidance">{props.session.assignment.sourceGuidance}</p>}
      <h2>문제</h2>
      <p>{props.session.assignment.question}</p>
      <h2>지문</h2>
      <p>{props.session.assignment.passage}</p>
    </div>
  );
}
