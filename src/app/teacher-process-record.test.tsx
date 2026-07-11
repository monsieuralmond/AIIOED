import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createReviewSuggestions } from "../review/review.js";
import { createSession, recordFeedbackGenerated, recordSuggestionCheck, updateOutline, warnWeakOutline } from "../session/session.js";
import { sampleAssignment, sampleOutline, sampleStudents } from "../shared/fixtures.js";
import { ResearchModes } from "../shared/research.js";
import type { TeacherReviewUpdate } from "../shared/types.js";
import { recordGuidedDraft, recordGuidedWritingTitle, saveGuidedOutlinePlan, saveGuidedSources, saveGuidedStep, saveGuidedTopicPlan, submitGuidedWriting } from "./guided-writing-model.js";
import { processSignalsForSession } from "./teacher-process-record.js";
import { TeacherProcessRecord } from "./teacher-process-record.js";

describe("processSignalsForSession", () => {
  it("surfaces source, feedback, and revision-check events for teacher labeling", () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("Sample student missing.");
    const draft = "일회용 플라스틱은 줄여야 한다. 분해가 오래 걸리기 때문이다.";
    const sourceSuggestion = createReviewSuggestions({ draft, outline: sampleOutline }).find((suggestion) => suggestion.id === "source");
    if (sourceSuggestion === undefined) throw new Error("Expected source suggestion.");

    const withOutline = updateOutline(updateOutline(createSession(sampleAssignment, student), sampleOutline), sampleOutline);
    const withOutlineCheck = warnWeakOutline(withOutline, sampleOutline);
    const withFeedback = recordFeedbackGenerated(withOutlineCheck, [sourceSuggestion]);
    const withRevisionCheck = recordSuggestionCheck(withFeedback, sourceSuggestion, {
      message: "초안에 출처 표시가 아직 보이지 않습니다.",
      resolved: false
    });

    const signals = processSignalsForSession(withRevisionCheck);

    expect(signals.map((signal) => signal.label)).toEqual(expect.arrayContaining(["출처 메모", "개요 점검", "제안 보기", "수정 확인"]));
    expect(signals.filter((signal) => signal.label === "출처 메모")).toHaveLength(1);
    expect(signals.find((signal) => signal.label === "출처 메모")?.value).toBe("2회");
    expect(signals.find((signal) => signal.label === "수정 확인")).toEqual(expect.objectContaining({
      tone: "warning",
      value: "미해결"
    }));
  });
});

describe("TeacherProcessRecord", () => {
  it("shows all guided writing stages and the submitted essay", () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("Sample student missing.");
    const assignment = {
      ...sampleAssignment,
      id: "assignment-guided-writing",
      researchMode: ResearchModes.guidedWriting,
      title: "IT 설명문"
    };
    const baseSession = createSession(assignment, student);
    const withMaterial = saveGuidedStep(baseSession, "material", "해저케이블", "topic");
    const withTopic = saveGuidedTopicPlan(withMaterial, { focus: "해저케이블이 인터넷을 연결하는 방식을 쉽게 설명한다.", title: "" }, "sources");
    const withSources = saveGuidedSources(withTopic, [{ content: "해저케이블은 대륙 사이 데이터를 빛 신호로 보낸다.", id: "source-1", source: "통신 기술 해설 자료" }], "outline");
    const withOutline = saveGuidedOutlinePlan(withSources, {
      body: [{ id: "body-1", text: "바다 아래 케이블이 데이터를 보내는 과정을 설명한다." }],
      conclusion: "인터넷은 보이지 않는 연결망 위에서 움직인다는 생각으로 마무리한다.",
      introduction: "친구와 영상 통화를 하는 장면으로 시작한다."
    }, "writing");
    const withTitle = recordGuidedWritingTitle(withOutline, "바다 아래 인터넷 길");
    const withDraft = recordGuidedDraft(withTitle, "초안 글입니다.");
    const submitted = submitGuidedWriting(withDraft, "최종 제출 글입니다.");

    render(<TeacherProcessRecord session={submitted} onUpdateReview={vi.fn<(sessionId: string, input: TeacherReviewUpdate) => void>()} />);

    expect(screen.getByRole("heading", { name: "단계형 글쓰기 기록" })).toBeInTheDocument();
    expect(screen.getByText("소재 정하기")).toBeInTheDocument();
    expect(screen.getByText("주제 정하기")).toBeInTheDocument();
    expect(screen.getByText("자료 찾기")).toBeInTheDocument();
    expect(screen.getByText("개요 짜기")).toBeInTheDocument();
    expect(screen.getByText("글쓰기")).toBeInTheDocument();
    expect(screen.getAllByText("고쳐쓰기").length).toBeGreaterThan(0);
    expect(screen.getByText("6/6")).toBeInTheDocument();
    expect(screen.getByText("해저케이블")).toBeInTheDocument();
    expect(screen.getByText("통신 기술 해설 자료", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("바다 아래 인터넷 길")).toBeInTheDocument();
    expect(screen.getAllByText("최종 제출 글입니다.").length).toBeGreaterThan(0);
  });
});
