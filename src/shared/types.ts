import type { PilotEventType } from "./events.js";
import type { ExportPilotSession } from "./calibration-export-types.js";
import type { GuidedWritingStage, ResearchArtifact, ResearchCondition, ResearchMeasure, ResearchMode, ResearchModules, ResearchSessionStatus, UnderstandingCalibrationConfig, UnderstandingCalibrationStage } from "./research.js";

export type { PilotEventType } from "./events.js";
export type { CalibrationAnalysisArtifacts, CalibrationAnalysisProblemArtifact, CalibrationCriterionScoreKey, CalibrationDerivedFeatures, CalibrationManualEvaluation, CalibrationManualEvaluationProblem, CalibrationProblemKey, CalibrationQuestionNumber, CalibrationRubricScore, ExportPilotSession } from "./calibration-export-types.js";

export type WritingStage = "reading" | "thinking" | "writing" | "review";

export type Stage = WritingStage | UnderstandingCalibrationStage | GuidedWritingStage;

export type LlmMode = "mock" | "real";

export type UserRole = "admin" | "teacher" | "student";

export type TeacherAccount = {
  readonly id: string;
  readonly displayName: string;
  readonly loginId: string;
  readonly password: string;
};

export type PublicTeacherAccount = Omit<TeacherAccount, "password">;

export type StudentAccount = {
  readonly id: string;
  readonly displayName: string;
  readonly classGroupId: string;
  readonly studentNumber: number;
  readonly loginId: string;
  readonly password: string;
  readonly participantCode: string;
};

export type PublicStudentAccount = Omit<StudentAccount, "password">;

export type ClassGroup = {
  readonly id: string;
  readonly name: string;
  readonly teacherId: string;
  readonly studentIds: readonly string[];
};

export type SelectedActor = {
  readonly role: UserRole;
  readonly accountId: string;
};

export type Assignment = {
  readonly id: string;
  readonly title: string;
  readonly passage: string;
  readonly question: string;
  readonly gradeLevel: string;
  readonly targetLength: string;
  readonly researchMode?: ResearchMode;
  readonly researchCondition?: ResearchCondition;
  readonly assignmentMode?: "full_process" | "revision_feedback";
  readonly calibrationConfig?: UnderstandingCalibrationConfig;
  readonly essayType?: string;
  readonly minimumWordCount?: string;
  readonly requirements?: readonly string[];
  readonly sourceGuidance?: string;
  readonly classGroupId?: string;
  readonly createdByTeacherId?: string;
  readonly startDate?: string;
  readonly startTime?: string;
  readonly dueDate?: string;
  readonly dueTime?: string;
};

export type Outline = {
  readonly claim: string;
  readonly evidence: readonly string[];
  readonly reasoning: string;
  readonly counterargument: string;
  readonly question: string;
};

export type ChatRole = "student" | "assistant";

export type CoachResponseType = "clarify" | "question" | "evidence_check" | "redirect" | "revision_guidance" | "refusal";

export type ChatTurn = {
  readonly id: string;
  readonly role: ChatRole;
  readonly text: string;
  readonly timestamp: string;
  readonly responseType?: CoachResponseType;
};

export type PilotEvent = {
  readonly id: string;
  readonly type: PilotEventType;
  readonly timestamp: string;
  readonly stage: Stage;
  readonly payload: Record<string, unknown>;
};

export type PasteEvent = {
  readonly id: string;
  readonly timestamp: string;
  readonly stage: "writing";
  readonly target: "draft";
  readonly textLength: number;
  readonly lineCount: number;
  readonly textPreviewFirst80: string;
  readonly fromClipboard: true;
};

export type DraftSnapshot = {
  readonly id: string;
  readonly timestamp: string;
  readonly text: string;
};

export type FinalSubmission = {
  readonly text: string;
  readonly submittedAt: string;
};

export type TeacherReviewStatus = "not_reviewed" | "needs_follow_up" | "reviewed";

export type TeacherReviewNote = {
  readonly status: TeacherReviewStatus;
  readonly note: string;
  readonly updatedAt: string;
  readonly updatedByTeacherId: string | null;
};

export type TeacherReviewUpdate = {
  readonly status: TeacherReviewStatus;
  readonly note: string;
};

export type PilotSession = {
  readonly sessionId: string;
  readonly assignment: Assignment;
  readonly researchMode: ResearchMode;
  readonly researchCondition: ResearchCondition;
  readonly status: ResearchSessionStatus;
  readonly student: {
    readonly anonymousId: string;
    readonly accountId?: string;
    readonly displayName?: string;
  };
  readonly currentStage: Stage;
  readonly events: readonly PilotEvent[];
  readonly chatTurns: readonly ChatTurn[];
  readonly outlineSnapshots: readonly Outline[];
  readonly draftSnapshots: readonly DraftSnapshot[];
  readonly pasteEvents: readonly PasteEvent[];
  readonly artifacts: readonly ResearchArtifact[];
  readonly measures: readonly ResearchMeasure[];
  readonly modules: ResearchModules;
  readonly finalSubmission: FinalSubmission | null;
  readonly teacherReview: TeacherReviewNote;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly metadata: {
    readonly appVersion: string;
    readonly llmMode: LlmMode;
    readonly model: string;
    readonly createdAt: string;
  };
};

export type StudentWorkStatus = "not_started" | "in_progress" | "submitted";

export type PilotState = {
  readonly schemaVersion: 1;
  readonly teacher: TeacherAccount;
  readonly teachers: readonly TeacherAccount[];
  readonly students: readonly StudentAccount[];
  readonly classGroups: readonly ClassGroup[];
  readonly assignments: readonly Assignment[];
  readonly sessions: readonly PilotSession[];
  readonly selectedActor: SelectedActor | null;
  readonly activeAssignmentId: string;
  readonly metadata: {
    readonly appVersion: string;
    readonly createdAt: string;
  };
};

export type FileSyncStatus =
  | {
      readonly status: "pending" | "unavailable";
      readonly path?: undefined;
      readonly syncedAt?: undefined;
      readonly message?: string;
    }
  | {
      readonly status: "saved";
      readonly path: string;
      readonly syncedAt: string;
      readonly message?: undefined;
    }
  | {
      readonly status: "failed";
      readonly path?: string;
      readonly syncedAt?: string;
      readonly message: string;
    };

export type ExportMetadata = {
  readonly schemaId: string;
  readonly codebookId: string;
  readonly generatedAt: string;
  readonly fileSync: FileSyncStatus;
};

export type PilotDataset = Omit<PilotState, "teacher" | "teachers" | "students"> & {
  readonly teacher: PublicTeacherAccount;
  readonly teachers: readonly PublicTeacherAccount[];
  readonly students: readonly PublicStudentAccount[];
  readonly sessions: readonly ExportPilotSession[];
  readonly exportMetadata: ExportMetadata;
};

export type LabelingSpeaker = "student" | "assistant" | "system_event";

export type InitialLabel = "none";

export type LabelingRow = {
  readonly sessionId: string;
  readonly studentAnonymousId: string;
  readonly assignmentId: string;
  readonly researchMode: string;
  readonly researchCondition: string;
  readonly turnOrEventId: string;
  readonly timestamp: string;
  readonly stage: Stage;
  readonly speaker: LabelingSpeaker;
  readonly criticalThinkingLabel: InitialLabel;
  readonly offloadingLabel: InitialLabel;
  readonly sycophancyLabel: InitialLabel;
  readonly evidenceText: string;
  readonly raterNotes: string;
};

export type CoachRequest = {
  readonly assignment: Assignment;
  readonly outline: Outline;
  readonly draft: string;
  readonly history?: readonly ChatTurn[];
  readonly message: string;
};

export type CoachResponse = {
  readonly llmMode?: LlmMode;
  readonly model?: string;
  readonly text: string;
  readonly type: CoachResponseType;
};

export type ReviewSuggestion = {
  readonly id: string;
  readonly category: "내용과 초점" | "자료와 설명" | "구조와 흐름" | "문장 표현" | "좋은 점검";
  readonly text: string;
  readonly focusLabel: string;
  readonly resolved: boolean;
};

export type ReviewSuggestionsResponse = {
  readonly llmMode?: LlmMode;
  readonly model?: string;
  readonly suggestions: readonly ReviewSuggestion[];
};

export type ReviewSuggestionCheckResponse = {
  readonly llmMode?: LlmMode;
  readonly message: string;
  readonly model?: string;
  readonly resolved: boolean;
  readonly suggestionId: string;
};
