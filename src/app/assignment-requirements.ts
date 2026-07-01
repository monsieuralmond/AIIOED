import type { Assignment } from "../shared/types";

export const defaultRequirements = (assignment: Assignment): readonly string[] =>
  assignment.requirements ?? [
    "주장을 분명하게 쓰기",
    "지문 근거를 두 가지 이상 사용하기",
    "반론과 재반박을 포함하기",
    "출처가 필요한 자료는 따로 표시하기"
  ];

export const requirementText = (assignment: Assignment): string => defaultRequirements(assignment).join("\n");

export const parseRequirements = (value: string): readonly string[] =>
  value
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 0);

