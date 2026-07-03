import type { ChatRole, LlmMode } from "./types";
import { ResearchConditions, activeResearchCondition } from "./research";
import type { ActiveResearchCondition, ResearchCondition } from "./research";

export const calibrationRequestTags = [
  "definition_request",
  "easy_explanation_request",
  "example_request",
  "analogy_request",
  "summary_request",
  "generated_explanation_request",
  "clarification_request",
  "limitation_request",
  "why_how_request",
  "verification_request",
  "off_topic",
  "other"
] as const;

export type CalibrationRequestTag = (typeof calibrationRequestTags)[number];

export type CalibrationChatHistoryTurn = {
  readonly role: ChatRole;
  readonly text: string;
};

export type CalibrationChatRequest = {
  readonly aiContext?: string;
  readonly history: readonly CalibrationChatHistoryTurn[];
  readonly message: string;
  readonly passage: string;
  readonly researchCondition: ResearchCondition;
  readonly topic: string;
};

export type CalibrationChatResponse = {
  readonly llmMode?: LlmMode;
  readonly model?: string;
  readonly requestTags: readonly CalibrationRequestTag[];
  readonly text: string;
  readonly type: "clarify";
};

const singleGroupBaselineSystemPrompt = `너는 학생이 읽기 자료를 이해하도록 돕는 한국어 독해 보조 AI이다.

학생은 읽기 자료를 읽은 뒤 궁금한 점을 질문하고 있다. 학생에게 이후 어떤 활동이 있을지는 알려주지 않는다.

답변 원칙은 다음과 같다.

1. 지문과 보조자료의 내용을 우선 활용한다.
2. 학생의 질문에 자연스럽고 친절하게 답한다.
3. 쉬운 설명, 예시, 비유, 요약, 글 형태의 정리를 요청하면 제공할 수 있다.
4. 단, 이후 활동이나 평가가 있다는 사실을 암시하지 않는다.
5. 학생에게 “이제 충분히 이해했다”, “잘 이해했다”, “완벽하다”처럼 이해 수준을 판단해주지 않는다.
6. 과도한 칭찬이나 아첨을 하지 않는다.
7. 기본 답변은 3~6문장으로 간결하게 한다.
8. 학생이 더 자세한 설명을 요청하면 더 길게 설명할 수 있다.
9. 지문과 무관한 질문은 짧게 제한하고, 다시 자료와 관련된 질문으로 돌아오게 한다.
10. 확실하지 않은 내용은 확실하지 않다고 말한다.`;

const understandingCalibrationSystemPrompts: Record<ActiveResearchCondition, string> = {
  [ResearchConditions.singleGroupBaseline]: singleGroupBaselineSystemPrompt
};

export const understandingCalibrationSystemPromptForCondition = (condition: ResearchCondition): string => understandingCalibrationSystemPrompts[activeResearchCondition(condition)];

export const understandingCalibrationSystemPrompt = understandingCalibrationSystemPromptForCondition(ResearchConditions.singleGroupBaseline);

const hasPattern = (message: string, pattern: RegExp): boolean => pattern.test(message);
const followUpPattern = /방금|아까|앞에서|이전|그 말|그거|그 내용|말한 것|말했던/u;

const includesTag = (tags: readonly CalibrationRequestTag[], tag: CalibrationRequestTag): boolean => tags.some((item) => item === tag);

const appendTag = (tags: readonly CalibrationRequestTag[], tag: CalibrationRequestTag): readonly CalibrationRequestTag[] =>
  includesTag(tags, tag) ? tags : [...tags, tag];

export const requestTagsForMessage = (message: string): readonly CalibrationRequestTag[] => {
  const normalized = message.replace(/\s+/g, " ").trim();
  const tags = calibrationRequestTags.reduce<readonly CalibrationRequestTag[]>((currentTags, tag) => {
    if (tag === "definition_request" && hasPattern(normalized, /뭐야|무엇|뜻|의미|정의|개념/u)) return appendTag(currentTags, tag);
    if (tag === "easy_explanation_request" && hasPattern(normalized, /쉽게|초등학생|어린이|쉬운 말|간단히|눈높이/u)) return appendTag(currentTags, tag);
    if (tag === "example_request" && hasPattern(normalized, /예시|예를|사례/u)) return appendTag(currentTags, tag);
    if (tag === "analogy_request" && hasPattern(normalized, /비유|빗대|비슷한 것/u)) return appendTag(currentTags, tag);
    if (tag === "summary_request" && hasPattern(normalized, /요약|정리|핵심|중심 내용|한 줄/u)) return appendTag(currentTags, tag);
    if (tag === "generated_explanation_request" && hasPattern(normalized, /글로|설명문|써줘|작성해줘|문장으로|완성해줘/u)) return appendTag(currentTags, tag);
    if (tag === "clarification_request" && hasPattern(normalized, /헷갈|모르겠|이해가 안|다시 설명|무슨 말|무슨 뜻/u)) return appendTag(currentTags, tag);
    if (tag === "limitation_request" && hasPattern(normalized, /한계|모든|항상|다 가능|못|불가능|예외|조심/u)) return appendTag(currentTags, tag);
    if (tag === "why_how_request" && hasPattern(normalized, /왜|어떻게|원리|이유|과정|작동/u)) return appendTag(currentTags, tag);
    if (tag === "verification_request" && hasPattern(normalized, /맞아|맞나요|맞는지|확인|검토|정확|틀렸|검증|사실/u)) return appendTag(currentTags, tag);
    if (tag === "off_topic" && hasPattern(normalized, /게임|노래|날씨|맛집|연예인|축구|유튜브|심심|농담/u)) return appendTag(currentTags, tag);
    return currentTags;
  }, []);
  return tags.length === 0 ? ["other"] : tags;
};

const recentAssistantText = (history: readonly CalibrationChatHistoryTurn[] | undefined): string => {
  const recentTurn = history
    ?.slice()
    .reverse()
    .find((turn) => turn.role === "assistant" && turn.text.trim().length > 0);
  return recentTurn?.text.trim() ?? "";
};

const shorten = (text: string): string => (text.length <= 90 ? text : `${text.slice(0, 90)}...`);

const historyBridge = (input: { readonly history?: readonly CalibrationChatHistoryTurn[]; readonly message: string }): string => {
  if (!followUpPattern.test(input.message)) return "";
  const previous = recentAssistantText(input.history);
  return previous.length === 0 ? "" : `앞서 나눈 대화에서는 "${shorten(previous)}"라고 했어요. 이 내용을 이어서 보면, `;
};

export const assistantReplyForCalibration = (input: {
  readonly aiContext?: string;
  readonly history?: readonly CalibrationChatHistoryTurn[];
  readonly message: string;
  readonly passage: string;
  readonly topic: string;
}): string => {
  const tags = requestTagsForMessage(input.message);
  const context = input.aiContext === undefined || input.aiContext.trim().length === 0 ? "" : ` 보조자료에는 ${input.aiContext.trim()}라고 되어 있어요.`;
  const passageHint = input.passage.trim().split(/[.!?。]\s*|\n/u).find((sentence) => sentence.trim().length > 0)?.trim() ?? input.topic;
  const bridge = historyBridge(input);
  if (includesTag(tags, "off_topic")) return `그 이야기도 재미있을 수 있지만, 지금은 ${input.topic}을 이해하는 데 집중해 볼게요. 지문에서 궁금한 단어나 이유를 하나 골라 물어보면 그 부분부터 설명할 수 있어요.`;
  if (includesTag(tags, "generated_explanation_request") || includesTag(tags, "summary_request")) {
    return `${bridge}${input.topic}은 지문에서 말하는 핵심 내용을 중심으로 정리하면 좋아요. ${passageHint} 이 부분을 보면, 무엇이 중요한지와 왜 조심해야 하는지를 함께 볼 수 있어요.${context}`;
  }
  if (includesTag(tags, "easy_explanation_request") || includesTag(tags, "definition_request") || includesTag(tags, "clarification_request")) {
    return `${bridge}${input.topic}을 쉬운 말로 보면, 지문에서 설명한 현상이 왜 생기고 어떤 영향을 주는지 이해하는 과정이에요. 먼저 "${passageHint}"라는 문장이 무엇을 말하는지부터 차근차근 보면 좋아요.${context}`;
  }
  if (includesTag(tags, "example_request") || includesTag(tags, "analogy_request")) {
    return `${bridge}예를 들면 ${input.topic}은 일상에서 비슷한 상황과 연결해 생각할 수 있어요. 다만 비유는 이해를 돕는 도구라서, 지문 속 사실과 완전히 같다고 보면 안 돼요.${context}`;
  }
  if (includesTag(tags, "why_how_request")) {
    return `${bridge}${input.topic}의 이유나 원리를 볼 때는 '무엇이 달라지는가'와 '그래서 어떤 결과가 생기는가'를 나누면 이해하기 쉬워요. 지문의 한 문장을 골라 그 연결을 직접 설명해 보세요.${context}`;
  }
  if (includesTag(tags, "limitation_request") || includesTag(tags, "verification_request")) {
    return `${bridge}${input.topic}을 이해할 때는 맞는 경우와 조심해야 할 경우를 함께 봐야 해요. 지문에서 제한, 우려, 예외를 나타내는 표현을 찾아보면 그 문장이 항상 맞는지 판단하는 데 도움이 됩니다.${context}`;
  }
  return `${bridge}${input.topic}에 대해 더 확인하려면 질문을 조금 더 좁혀 보세요. 뜻, 이유, 예시, 요약, 한계 중 하나를 골라 물으면 그 부분을 중심으로 설명할 수 있어요.${context}`;
};
