import type { ReactElement } from "react";
import type { ChatTurn } from "../shared/types.js";

type TranscriptItem = {
  readonly label: string;
  readonly turn: ChatTurn;
};

const transcriptItems = (turns: readonly ChatTurn[]): readonly TranscriptItem[] => {
  let assistantCount = 0;
  let studentCount = 0;
  return turns.map((turn) => {
    if (turn.role === "student") {
      studentCount += 1;
      return { label: `학생 질문 ${studentCount}`, turn };
    }
    assistantCount += 1;
    return { label: `AI 응답 ${assistantCount}`, turn };
  });
};

export function TeacherChatTranscript(props: { readonly turns: readonly ChatTurn[] }): ReactElement {
  const items = transcriptItems(props.turns);
  const studentQuestions = props.turns.filter((turn) => turn.role === "student").length;
  const assistantResponses = props.turns.filter((turn) => turn.role === "assistant").length;

  return (
    <section aria-label="AI 대화 기록" className="teacher-chat-log-section teacher-chat-transcript-section">
      <h3>AI 대화 기록</h3>
      {items.length === 0 ? (
        <p>아직 대화가 없습니다.</p>
      ) : (
        <>
          <p className="teacher-chat-transcript-summary">학생 질문 {studentQuestions}개, AI 응답 {assistantResponses}개가 기록되었습니다.</p>
          <ol className="teacher-chat-transcript">
            {items.map((item, index) => (
              <li className={`teacher-chat-turn ${item.turn.role}`} key={item.turn.id}>
                {item.turn.role === "student" ? (
                  <>
                    <strong>{item.label}</strong>
                    <p>{item.turn.text}</p>
                  </>
                ) : (
                  <details>
                    <summary>{item.label} 보기</summary>
                    <p>{item.turn.text}</p>
                  </details>
                )}
                <span className="teacher-chat-turn-order">#{index + 1}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
