import { GuidedWritingStages } from "../shared/research.js";
import type { Outline, PasteEvent, PilotEvent, PilotEventType, PilotSession, ReviewSuggestion, Stage } from "../shared/types.js";

export const guidedStepOrder = ["material", "topic", "sources", "outline", "writing", "revision"] as const;
export type GuidedStep = (typeof guidedStepOrder)[number];
export type GuidedTextStep = "material";

export type GuidedSourceEntry = {
  readonly content: string;
  readonly id: string;
  readonly source: string;
};

export type GuidedOutlineBodyEntry = {
  readonly id: string;
  readonly text: string;
};

export type GuidedOutlinePlan = {
  readonly body: readonly GuidedOutlineBodyEntry[];
  readonly conclusion: string;
  readonly introduction: string;
};

export type GuidedTopicPlan = {
  readonly focus: string;
  readonly title: string;
};

export type GuidedStepSpec = {
  readonly helper: string;
  readonly label: string;
  readonly placeholder: string;
  readonly prompts: readonly string[];
  readonly stage: Stage;
  readonly title: string;
};

export const guidedStepSpecs: Readonly<Record<GuidedStep, GuidedStepSpec>> = {
  material: {
    helper: "양자컴퓨터, 반도체, 해저케이블처럼 설명하고 싶은 IT·과학기술 대상을 하나 고릅니다. 아직 제목이나 주장으로 만들지 말고 글의 재료가 될 큰 대상을 먼저 정합니다.",
    label: "소재",
    placeholder: "예: 양자컴퓨터\n예: 반도체\n예: 해저케이블\n예: 데이터센터\n예: 위성 인터넷",
    prompts: [
      "컴퓨터를 움직이는 기술: 반도체, 운영체제, 그래픽카드, 데이터센터",
      "세계를 연결하는 기술: 해저케이블, 위성 인터넷, 5G, 와이파이",
      "새롭게 주목받는 기술: 양자컴퓨터, 생성형 AI, 로봇, 자율주행",
      "보이지 않지만 중요한 기술: 암호화, 클라우드, 검색 엔진, 추천 시스템",
      "글 한 편에서 충분히 설명할 수 있을 만큼 하나의 대상을 고르세요."
    ],
    stage: GuidedWritingStages.material,
    title: "소재 정하기"
  },
  outline: {
    helper: "책의 글처럼 일상 장면, 핵심 개념, 작동 원리, 쓰이는 곳, 주의할 점, 생각할 질문을 순서대로 놓아 봅니다.",
    label: "개요",
    placeholder: "예: 1. 식당 메뉴판이나 택배 상자에서 QR코드를 본 경험\n2. QR코드가 정보를 담는 방식\n3. 바코드와 다른 점\n4. 편리한 사용 사례\n5. 잘못된 QR코드를 찍을 때 생길 수 있는 위험\n6. 생각 나누기 질문",
    prompts: [
      "첫 문단에서 독자가 바로 떠올릴 수 있는 장면을 넣었나요?",
      "원리 설명이 너무 전문 용어로만 이어지지 않도록 비유나 비교를 넣을 수 있나요?",
      "마지막에는 기술을 어떻게 바라볼지 생각할 질문이 남나요?"
    ],
    stage: GuidedWritingStages.outline,
    title: "개요 짜기"
  },
  sources: {
    helper: "고른 기술의 뜻, 작동 원리, 실제 사용 사례, 주의할 점을 확인할 수 있는 자료를 찾습니다.",
    label: "자료",
    placeholder: "예: 기술 해설 기사: 양자컴퓨터가 큐비트와 중첩을 이용하는 방식\n예: 과학 해설 자료: 반도체가 전기 신호를 조절하는 방식\n예: 통신 자료: 해저케이블이 대륙 사이 데이터를 보내는 방식",
    prompts: [
      "이 자료는 개념 설명, 원리 설명, 사례, 위험 중 무엇을 보여주나요?",
      "제품 광고문이 아니라 기술을 설명하거나 검증하는 자료인가요?",
      "자료 내용을 십대 독자가 이해할 말로 바꾸면 어떻게 되나요?"
    ],
    stage: GuidedWritingStages.sources,
    title: "자료 찾기"
  },
  topic: {
    helper: "고른 소재를 책의 한 꼭지처럼 설명할 초점으로 좁힙니다. 제목을 짓기보다 무엇을 어떤 관점에서 쉽게 풀어 설명할지 먼저 정합니다.",
    label: "주제",
    placeholder: "예: 큐비트와 일반 비트의 차이를 중심으로 양자컴퓨터의 원리를 쉽게 설명한다.",
    prompts: [
      "소재가 너무 넓다면 어떤 원리나 사례를 중심으로 설명할지 좁혔나요?",
      "설명할 핵심 기술 이름이 들어가 있나요?",
      "하나의 기술을 충분히 깊게 설명할 수 있을 만큼 주제가 좁혀졌나요?"
    ],
    stage: GuidedWritingStages.topic,
    title: "주제 정하기"
  },
  writing: {
    helper: "제목을 정하고, 앞에서 정리한 소재, 주제, 자료, 개요를 보면서 십대를 위한 IT 설명문을 씁니다. 이 단계에서만 AI에게 질문할 수 있습니다.",
    label: "글쓰기",
    placeholder: "일상 장면에서 시작해 기술의 뜻과 원리를 쉽게 설명하고, 쓰임과 주의할 점, 생각할 질문까지 이어서 써 보세요.",
    prompts: [
      "처음 읽는 친구도 기술이 왜 필요한지 떠올릴 수 있나요?",
      "작동 원리를 그림 없이도 이해할 수 있게 비유나 비교를 넣었나요?",
      "AI에게 묻는다면 글을 대신 쓰게 하기보다 어려운 원리를 더 쉬운 비유로 바꿀 방법을 물어보세요."
    ],
    stage: GuidedWritingStages.writing,
    title: "글쓰기"
  },
  revision: {
    helper: "AI가 제안한 점검 항목을 보며 직접 고쳐 쓴 뒤 최종 제출합니다.",
    label: "고쳐쓰기",
    placeholder: "",
    prompts: [
      "AI 제안은 정답이 아니라 점검할 위치입니다.",
      "문장을 대신 바꾸게 하기보다 설명이 부족한 부분을 직접 고쳐 보세요.",
      "고친 뒤에는 내 글의 흐름을 처음부터 다시 읽어보세요."
    ],
    stage: GuidedWritingStages.feedback,
    title: "고쳐쓰기"
  }
};

const makeId = (prefix: string): string => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
export const guidedNowIso = (): string => new Date().toISOString();

export const hasText = (value: string): boolean => value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const createGuidedSourceEntry = (): GuidedSourceEntry => ({ content: "", id: makeId("source"), source: "" });

export const createGuidedOutlineBodyEntry = (): GuidedOutlineBodyEntry => ({ id: makeId("outline-body"), text: "" });

export const emptyGuidedTopicPlan = (): GuidedTopicPlan => ({ focus: "", title: "" });

export const emptyGuidedOutlinePlan = (): GuidedOutlinePlan => ({
  body: [createGuidedOutlineBodyEntry()],
  conclusion: "",
  introduction: ""
});

const isGuidedSourceEntry = (value: unknown): value is GuidedSourceEntry =>
  isRecord(value) && typeof value["id"] === "string" && typeof value["content"] === "string" && typeof value["source"] === "string";

const isGuidedOutlineBodyEntry = (value: unknown): value is GuidedOutlineBodyEntry =>
  isRecord(value) && typeof value["id"] === "string" && typeof value["text"] === "string";

const isGuidedOutlinePlan = (value: unknown): value is GuidedOutlinePlan =>
  isRecord(value) && typeof value["introduction"] === "string" && typeof value["conclusion"] === "string" && Array.isArray(value["body"]) && value["body"].every(isGuidedOutlineBodyEntry);

const isGuidedTopicPlan = (value: unknown): value is GuidedTopicPlan =>
  isRecord(value) && typeof value["title"] === "string" && typeof value["focus"] === "string";

const isReviewSuggestionCategory = (value: unknown): value is ReviewSuggestion["category"] =>
  value === "내용과 초점" || value === "자료와 설명" || value === "구조와 흐름" || value === "문장 표현" || value === "좋은 점검";

const isReviewSuggestion = (value: unknown): value is ReviewSuggestion =>
  isRecord(value) && typeof value["id"] === "string" && isReviewSuggestionCategory(value["category"]) && typeof value["text"] === "string" && typeof value["focusLabel"] === "string" && typeof value["resolved"] === "boolean";

export const guidedEvent = (type: PilotEventType, stage: Stage, payload: Record<string, unknown>): PilotEvent => ({
  id: makeId("event"),
  payload,
  stage,
  timestamp: guidedNowIso(),
  type
});

export const stepForGuidedStage = (stage: Stage): GuidedStep => {
  if (stage === GuidedWritingStages.topic) return "topic";
  if (stage === GuidedWritingStages.sources) return "sources";
  if (stage === GuidedWritingStages.outline) return "outline";
  if (stage === GuidedWritingStages.feedback || stage === GuidedWritingStages.completed) return "revision";
  if (stage === GuidedWritingStages.writing) return "writing";
  return "material";
};

export const latestGuidedStepText = (session: PilotSession, step: GuidedStep): string => {
  const artifact = [...session.artifacts].reverse().find((item) => item.kind === "guided_writing_step" && item.payload["step"] === step);
  const text = artifact?.payload["text"];
  return typeof text === "string" ? text : "";
};

export const latestGuidedSources = (session: PilotSession): readonly GuidedSourceEntry[] => {
  const artifact = [...session.artifacts].reverse().find((item) => item.kind === "guided_writing_step" && item.payload["step"] === "sources");
  const sources = artifact?.payload["sources"];
  if (Array.isArray(sources) && sources.every(isGuidedSourceEntry)) return sources.length > 0 ? sources : [createGuidedSourceEntry()];
  const text = typeof artifact?.payload["text"] === "string" ? artifact.payload["text"] : "";
  const legacySources = text.split(/\r?\n/u).map((line) => line.trim()).filter(hasText).map((line) => ({ content: line, id: makeId("source"), source: "" }));
  return legacySources.length > 0 ? legacySources : [createGuidedSourceEntry()];
};

export const latestGuidedTopicPlan = (session: PilotSession): GuidedTopicPlan => {
  const artifact = [...session.artifacts].reverse().find((item) => item.kind === "guided_writing_step" && item.payload["step"] === "topic");
  const topic = artifact?.payload["topic"];
  if (isGuidedTopicPlan(topic)) return topic;
  const text = typeof artifact?.payload["text"] === "string" ? artifact.payload["text"] : "";
  return text.trim().length === 0 ? emptyGuidedTopicPlan() : { focus: text, title: "" };
};

export const latestGuidedWritingTitle = (session: PilotSession): string => {
  const artifact = [...session.artifacts].reverse().find((item) => item.kind === "guided_writing_title");
  const title = artifact?.payload["title"];
  if (typeof title === "string") return title;
  return latestGuidedTopicPlan(session).title;
};

export const latestGuidedOutlinePlan = (session: PilotSession): GuidedOutlinePlan => {
  const artifact = [...session.artifacts].reverse().find((item) => item.kind === "guided_writing_step" && item.payload["step"] === "outline");
  const outline = artifact?.payload["outline"];
  if (isGuidedOutlinePlan(outline)) return outline.body.length > 0 ? outline : { ...outline, body: [createGuidedOutlineBodyEntry()] };
  const text = typeof artifact?.payload["text"] === "string" ? artifact.payload["text"] : "";
  return text.trim().length === 0 ? emptyGuidedOutlinePlan() : { body: [{ id: makeId("outline-body"), text }], conclusion: "", introduction: "" };
};

export const latestGuidedFeedbackSuggestions = (session: PilotSession): readonly ReviewSuggestion[] => {
  const event = [...session.events].reverse().find((item) => item.type === "feedback_generated" && item.stage === GuidedWritingStages.feedback);
  const suggestions = event?.payload["suggestions"];
  return Array.isArray(suggestions) && suggestions.every(isReviewSuggestion) ? suggestions : [];
};

export const latestGuidedDraftText = (session: PilotSession): string => session.draftSnapshots.at(-1)?.text ?? "";

const sourceLines = (sources: string): readonly string[] => sources.split(/\r?\n/u).map((line) => line.trim()).filter(hasText);

export const guidedSourcesHaveText = (sources: readonly GuidedSourceEntry[]): boolean =>
  sources.some((source) => source.content.trim().length > 0 || source.source.trim().length > 0);

export const guidedOutlineHasText = (outline: GuidedOutlinePlan): boolean =>
  outline.introduction.trim().length > 0 || outline.conclusion.trim().length > 0 || outline.body.some((item) => item.text.trim().length > 0);

export const guidedTopicHasText = (topic: GuidedTopicPlan): boolean =>
  topic.focus.trim().length > 0;

export const guidedSourcesToText = (sources: readonly GuidedSourceEntry[]): string =>
  sources
    .map((entry, index) => {
      const content = entry.content.trim();
      const source = entry.source.trim();
      if (content.length === 0 && source.length === 0) return "";
      return [`자료 ${index + 1}`, content.length > 0 ? `내용: ${content}` : "", source.length > 0 ? `출처: ${source}` : ""].filter(hasText).join("\n");
    })
    .filter(hasText)
    .join("\n\n");

export const guidedOutlineToText = (outline: GuidedOutlinePlan): string =>
  [
    outline.introduction.trim().length > 0 ? `서론: ${outline.introduction.trim()}` : "",
    ...outline.body.map((entry, index) => entry.text.trim().length > 0 ? `본론 ${index + 1}: ${entry.text.trim()}` : ""),
    outline.conclusion.trim().length > 0 ? `결론: ${outline.conclusion.trim()}` : ""
  ]
    .filter(hasText)
    .join("\n");

export const guidedTopicToText = (topic: GuidedTopicPlan): string =>
  topic.focus.trim().length > 0 ? `주제: ${topic.focus.trim()}` : "";

export const guidedOutlineForCoach = (values: Readonly<Record<GuidedStep, string>>): Outline => ({
  claim: values.topic,
  counterargument: "",
  evidence: sourceLines(values.sources),
  question: values.material,
  reasoning: values.outline
});

export const saveGuidedStep = (session: PilotSession, step: GuidedStep, text: string, nextStep: GuidedStep | null): PilotSession => {
  const savedAt = guidedNowIso();
  const stage = guidedStepSpecs[step].stage;
  const artifact = {
    createdAt: savedAt,
    id: makeId("artifact"),
    kind: "guided_writing_step",
    payload: { step, text },
    stage,
    updatedAt: savedAt
  };
  const nextStage = nextStep === null ? stage : guidedStepSpecs[nextStep].stage;
  const transition = nextStage === session.currentStage ? [] : [guidedEvent("stage_completed", session.currentStage, { stage: session.currentStage }), guidedEvent("stage_entered", nextStage, { stage: nextStage })];
  return {
    ...session,
    artifacts: [...session.artifacts, artifact],
    currentStage: nextStage,
    events: [...session.events, guidedEvent("guided_step_saved", stage, { length: text.length, step }), ...transition],
    updatedAt: savedAt
  };
};

export const saveGuidedSources = (session: PilotSession, sources: readonly GuidedSourceEntry[], nextStep: GuidedStep | null): PilotSession =>
  saveGuidedStructuredStep(session, "sources", guidedSourcesToText(sources), { sources }, nextStep);

export const saveGuidedTopicPlan = (session: PilotSession, topic: GuidedTopicPlan, nextStep: GuidedStep | null): PilotSession => {
  const topicWithoutTitle = { focus: topic.focus, title: "" };
  return saveGuidedStructuredStep(session, "topic", guidedTopicToText(topicWithoutTitle), { topic: topicWithoutTitle }, nextStep);
};

export const saveGuidedOutlinePlan = (session: PilotSession, outline: GuidedOutlinePlan, nextStep: GuidedStep | null): PilotSession =>
  saveGuidedStructuredStep(session, "outline", guidedOutlineToText(outline), { outline }, nextStep);

const saveGuidedStructuredStep = (session: PilotSession, step: GuidedStep, text: string, structuredPayload: Record<string, unknown>, nextStep: GuidedStep | null): PilotSession => {
  const savedAt = guidedNowIso();
  const stage = guidedStepSpecs[step].stage;
  const artifact = {
    createdAt: savedAt,
    id: makeId("artifact"),
    kind: "guided_writing_step",
    payload: { step, text, ...structuredPayload },
    stage,
    updatedAt: savedAt
  };
  const nextStage = nextStep === null ? stage : guidedStepSpecs[nextStep].stage;
  const transition = nextStage === session.currentStage ? [] : [guidedEvent("stage_completed", session.currentStage, { stage: session.currentStage }), guidedEvent("stage_entered", nextStage, { stage: nextStage })];
  return {
    ...session,
    artifacts: [...session.artifacts, artifact],
    currentStage: nextStage,
    events: [...session.events, guidedEvent("guided_step_saved", stage, { length: text.length, step }), ...transition],
    updatedAt: savedAt
  };
};

export const enterGuidedFeedback = (session: PilotSession): PilotSession => {
  const timestamp = guidedNowIso();
  const transition = session.currentStage === GuidedWritingStages.feedback ? [] : [guidedEvent("stage_completed", session.currentStage, { stage: session.currentStage }), guidedEvent("stage_entered", GuidedWritingStages.feedback, { stage: GuidedWritingStages.feedback })];
  return { ...session, currentStage: GuidedWritingStages.feedback, events: [...session.events, ...transition], updatedAt: timestamp };
};

const reviewSuggestionPayload = (suggestion: ReviewSuggestion): Record<string, unknown> => ({
  category: suggestion.category,
  focusLabel: suggestion.focusLabel,
  id: suggestion.id,
  resolved: suggestion.resolved,
  text: suggestion.text
});

export const recordGuidedFeedbackGenerated = (session: PilotSession, suggestions: readonly ReviewSuggestion[]): PilotSession => ({
  ...session,
  events: [
    ...session.events,
    guidedEvent("feedback_generated", GuidedWritingStages.feedback, { count: suggestions.length, suggestionIds: suggestions.map((suggestion) => suggestion.id), suggestions: suggestions.map(reviewSuggestionPayload) }),
    guidedEvent("feedback_viewed", GuidedWritingStages.feedback, { count: suggestions.length, suggestionIds: suggestions.map((suggestion) => suggestion.id), suggestions: suggestions.map(reviewSuggestionPayload) })
  ],
  updatedAt: guidedNowIso()
});

export const recordGuidedSuggestionCheck = (session: PilotSession, suggestion: ReviewSuggestion, result: { readonly message: string; readonly resolved: boolean }): PilotSession => ({
  ...session,
  events: [...session.events, guidedEvent("suggestion_checked", GuidedWritingStages.feedback, { category: suggestion.category, message: result.message, resolved: result.resolved, suggestionId: suggestion.id })],
  updatedAt: guidedNowIso()
});

export const resolveGuidedSuggestion = (session: PilotSession, suggestion: ReviewSuggestion): PilotSession => ({
  ...session,
  events: [...session.events, guidedEvent("suggestion_resolved", GuidedWritingStages.feedback, { category: suggestion.category, suggestionId: suggestion.id })],
  updatedAt: guidedNowIso()
});

export const recordGuidedDraft = (session: PilotSession, text: string): PilotSession => {
  const timestamp = guidedNowIso();
  const draftId = makeId("draft");
  return {
    ...session,
    artifacts: [
      ...session.artifacts,
      {
        createdAt: timestamp,
        id: makeId("artifact"),
        kind: "guided_writing_draft",
        payload: { draftId, length: text.length, text },
        stage: GuidedWritingStages.writing,
        updatedAt: timestamp
      }
    ],
    draftSnapshots: [...session.draftSnapshots, { id: draftId, text, timestamp }],
    events: [...session.events, guidedEvent("draft_edited", GuidedWritingStages.writing, { length: text.length })],
    updatedAt: timestamp
  };
};

export const recordGuidedWritingTitle = (session: PilotSession, title: string): PilotSession => {
  const timestamp = guidedNowIso();
  return {
    ...session,
    artifacts: [
      ...session.artifacts,
      {
        createdAt: timestamp,
        id: makeId("artifact"),
        kind: "guided_writing_title",
        payload: { title },
        stage: GuidedWritingStages.writing,
        updatedAt: timestamp
      }
    ],
    updatedAt: timestamp
  };
};

export const recordGuidedPaste = (session: PilotSession, text: string): PilotSession => {
  const paste: PasteEvent = {
    fromClipboard: true,
    id: makeId("paste"),
    lineCount: text.split(/\r?\n/u).length,
    stage: "writing",
    target: "draft",
    textLength: text.length,
    textPreviewFirst80: text.slice(0, 80),
    timestamp: guidedNowIso()
  };
  return { ...session, events: [...session.events, guidedEvent("paste_detected", GuidedWritingStages.writing, paste)], pasteEvents: [...session.pasteEvents, paste], updatedAt: paste.timestamp };
};

export const submitGuidedWriting = (session: PilotSession, draft: string): PilotSession => {
  const submittedAt = guidedNowIso();
  const withDraft = recordGuidedDraft(session, draft);
  return {
    ...withDraft,
    completedAt: submittedAt,
    currentStage: GuidedWritingStages.completed,
    events: [
      ...withDraft.events,
      guidedEvent("stage_completed", GuidedWritingStages.feedback, { stage: GuidedWritingStages.feedback }),
      guidedEvent("guided_writing_submitted", GuidedWritingStages.feedback, { length: draft.length, submittedAt }),
      guidedEvent("submission_created", GuidedWritingStages.feedback, { submittedAt })
    ],
    artifacts: [
      ...withDraft.artifacts,
      {
        createdAt: submittedAt,
        id: makeId("artifact"),
        kind: "final_submission",
        payload: { length: draft.length, text: draft },
        stage: GuidedWritingStages.completed,
        updatedAt: submittedAt
      }
    ],
    finalSubmission: { submittedAt, text: draft },
    status: "submitted",
    updatedAt: submittedAt
  };
};
