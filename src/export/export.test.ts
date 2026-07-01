import { describe, expect, it } from "vitest";
import { DATASET_SCHEMA_ID, LABELING_CODEBOOK_ID, exportDataset, exportLabelingRows, exportSession, stringifyLabelingCsv } from "./export";
import { createInitialPilotState } from "../session/session";
import { addAssistantCoachTurn, addChatTurn, createSession, recordFeedbackGenerated, recordSuggestionCheck, resolveSuggestion, submitFinal, updateTeacherReview } from "../session/session";
import { sampleAssignment, sampleStudents } from "../shared/fixtures";

describe("session export", () => {
  it("exports the research dataset shape with final submission separated", () => {
    const session = submitFinal(createSession(sampleAssignment), "최종 글입니다.");
    const exported = exportSession(session);

    expect(exported.assignment.title).toBe(sampleAssignment.title);
    expect(exported.chatTurns).toEqual([]);
    expect(exported.outlineSnapshots).toEqual([]);
    expect(exported.draftSnapshots).toEqual([]);
    expect(exported.pasteEvents).toEqual([]);
    expect(exported.finalSubmission?.text).toBe("최종 글입니다.");
    expect(exported.metadata.llmMode).toBe("mock");
  });

  it("exports a fixed schema id, codebook id, and file sync metadata", () => {
    const exported = exportDataset(createInitialPilotState(), {
      path: ".omo/evidence/khan-parity-auth-persistence/file-sync/pilot-state.json",
      status: "saved",
      syncedAt: "2026-06-30T00:00:00.000Z"
    });

    expect(exported.exportMetadata.schemaId).toBe(DATASET_SCHEMA_ID);
    expect(exported.exportMetadata.codebookId).toBe(LABELING_CODEBOOK_ID);
    expect(exported.exportMetadata.fileSync.status).toBe("saved");
    expect(exported.exportMetadata.fileSync.path).toContain("pilot-state.json");
  });

  it("omits teacher and student passwords from the research dataset export", () => {
    const exported = exportDataset(createInitialPilotState());
    const serialized = JSON.stringify(exported);

    expect(exported.teacher).not.toHaveProperty("password");
    expect(exported.teachers[0]).not.toHaveProperty("password");
    expect(exported.students[0]).toHaveProperty("loginId", "minseo");
    expect(exported.students[0]).not.toHaveProperty("password");
    expect(serialized).not.toContain("MINSEO-2026");
  });

  it("flattens event logs into labeling-ready rows and CSV", () => {
    const student = sampleStudents[0];
    if (student === undefined) throw new Error("Expected a sample student.");
    const session = addChatTurn(createSession(sampleAssignment, student), "student", "근거를 어떻게 확인할까?");
    const state = { ...createInitialPilotState(), sessions: [session] };

    const rows = exportLabelingRows(state);
    const csv = stringifyLabelingCsv(state);
    const firstRow = rows[0];

    expect(rows).toHaveLength(1);
    if (firstRow === undefined) throw new Error("Expected one labeling row.");
    expect(firstRow).toEqual(expect.objectContaining({
      assignmentId: sampleAssignment.id,
      criticalThinkingLabel: "none",
      evidenceText: "근거를 어떻게 확인할까?",
      offloadingLabel: "none",
      speaker: "student",
      stage: "reading",
      studentAnonymousId: student.id,
      sycophancyLabel: "none"
    }));
    expect(csv.split("\n")[0]).toBe("sessionId,studentAnonymousId,assignmentId,turnOrEventId,timestamp,stage,speaker,criticalThinkingLabel,offloadingLabel,sycophancyLabel,evidenceText,raterNotes");
    expect(csv).toContain("\"근거를 어떻게 확인할까?\"");
  });

  it("keeps assistant response type in chat turns and event payloads", () => {
    const session = addAssistantCoachTurn(createSession(sampleAssignment), "대신 네 생각을 먼저 적어볼래요?", "refusal");
    const assistantTurn = session.chatTurns[0];
    const assistantEvent = session.events[0];

    if (assistantTurn === undefined) throw new Error("Expected one assistant turn.");
    if (assistantEvent === undefined) throw new Error("Expected one assistant event.");
    expect(assistantTurn.responseType).toBe("refusal");
    expect(assistantEvent.payload).toHaveProperty("responseType", "refusal");
  });

  it("keeps review feedback and teacher review events available for labeling", () => {
    const suggestion = {
      category: "근거와 설명",
      focusLabel: "근거가 들어가야 할 문장",
      id: "evidence",
      resolved: false,
      text: "근거 두 가지가 초안에 모두 들어갔는지 확인하세요."
    } as const;
    const session = updateTeacherReview(resolveSuggestion(recordSuggestionCheck(recordFeedbackGenerated(createSession(sampleAssignment), [suggestion]), suggestion, {
      message: "아직 근거가 하나만 확인됩니다.",
      resolved: false
    }), suggestion), "teacher-research", {
      note: "근거 요청과 반론 작성 확인",
      status: "reviewed"
    });
    const state = { ...createInitialPilotState(), sessions: [session] };

    const rows = exportLabelingRows(state);
    const eventEvidence = rows.map((row) => row.evidenceText).join("\n");

    expect(rows.map((row) => row.speaker)).toEqual(["system_event", "system_event", "system_event", "system_event", "system_event"]);
    expect(eventEvidence).toContain("근거 두 가지가 초안에 모두 들어갔는지 확인하세요.");
    expect(eventEvidence).toContain("아직 근거가 하나만 확인됩니다.");
    expect(eventEvidence).toContain("suggestionId");
    expect(eventEvidence).toContain("teacher-research");
    expect(eventEvidence).toContain("근거 요청과 반론 작성 확인");
  });
});
