import { describe, expect, it } from "vitest";
import { createSession } from "../session/session.js";
import { sampleAssignment } from "../shared/fixtures.js";
import { latestGuidedTopicPlan, latestGuidedWritingTitle, recordGuidedWritingTitle, saveGuidedStep, saveGuidedTopicPlan } from "./guided-writing-model.js";

describe("guided writing topic model", () => {
  it("stores the writing title separately from the topic focus", () => {
    const session = createSession(sampleAssignment);
    const withTopic = saveGuidedTopicPlan(session, {
      focus: "큐비트와 일반 비트의 차이를 중심으로 원리를 설명한다.",
      title: ""
    }, "sources");
    const saved = recordGuidedWritingTitle(withTopic, "양자컴퓨터는 왜 특별한 계산을 할 수 있을까?");

    expect(latestGuidedTopicPlan(saved)).toEqual({
      focus: "큐비트와 일반 비트의 차이를 중심으로 원리를 설명한다.",
      title: ""
    });
    expect(latestGuidedWritingTitle(saved)).toBe("양자컴퓨터는 왜 특별한 계산을 할 수 있을까?");
  });

  it("does not treat legacy topic text as an export title", () => {
    const session = createSession(sampleAssignment);
    const saved = saveGuidedStep(session, "topic", "패스키와 공개키 암호가 바꾸는 로그인 방식", "sources");

    expect(latestGuidedTopicPlan(saved)).toEqual({
      focus: "패스키와 공개키 암호가 바꾸는 로그인 방식",
      title: ""
    });
    expect(latestGuidedWritingTitle(saved)).toBe("");
  });

  it("keeps legacy topic-plan title available as the writing title", () => {
    const session = createSession(sampleAssignment);
    const saved = {
      ...session,
      artifacts: [
        ...session.artifacts,
        {
          createdAt: "2026-07-04T00:00:00.000Z",
          id: "legacy-topic",
          kind: "guided_writing_step",
          payload: {
            step: "topic",
            text: "제목: 양자컴퓨터는 왜 특별한 계산을 할 수 있을까?\n주제: 큐비트와 일반 비트의 차이를 중심으로 원리를 설명한다.",
            topic: {
              focus: "큐비트와 일반 비트의 차이를 중심으로 원리를 설명한다.",
              title: "양자컴퓨터는 왜 특별한 계산을 할 수 있을까?"
            }
          },
          stage: "guided_topic",
          updatedAt: "2026-07-04T00:00:00.000Z"
        }
      ]
    };

    expect(latestGuidedWritingTitle(saved)).toBe("양자컴퓨터는 왜 특별한 계산을 할 수 있을까?");
  });
});
