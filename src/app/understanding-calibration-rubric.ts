export const UNDERSTANDING_CALIBRATION_PROTOCOL_VERSION = "2026-07-UC-R1";
export const UNDERSTANDING_CALIBRATION_RUBRIC_VERSION = "2026-07-UC-R1";
export const UNDERSTANDING_CALIBRATION_PROMPT_VERSION = "2026-07-UC-R1";

export type RubricScore = 0 | 1 | 2;

export type RubricCode = {
  readonly code: string;
  readonly label: string;
  readonly scoreGuide: Readonly<Record<RubricScore, string>>;
};

export type ProblemRubric = {
  readonly commonCodes: readonly RubricCode[];
  readonly problemCodes: readonly RubricCode[];
  readonly problemNumber: 1 | 2 | 3 | 4;
  readonly rubricVersion: string;
};

const commonRubricCodes: readonly RubricCode[] = [
  {
    code: "accuracy",
    label: "핵심 정확성",
    scoreGuide: {
      0: "핵심 오류가 다수 있음",
      1: "일부는 정확하지만 중요한 부분이 빠지거나 불명확함",
      2: "핵심 개념이 정확하게 설명됨"
    }
  },
  {
    code: "completeness",
    label: "설명 요소 충족",
    scoreGuide: {
      0: "한 가지 요소만 단편적으로 언급함",
      1: "일부 요소를 포함함",
      2: "문항이 요구한 핵심 요소를 충족함"
    }
  },
  {
    code: "coherence",
    label: "설명 연결성",
    scoreGuide: {
      0: "문장이 단편적이거나 연결이 약함",
      1: "부분적으로 연결되어 있음",
      2: "이유와 설명이 구조적으로 연결됨"
    }
  }
];

export const problemRubrics: readonly ProblemRubric[] = [
  {
    commonCodes: commonRubricCodes,
    problemCodes: [
      {
        code: "concept_basic",
        label: "쉬운 개념 정의",
        scoreGuide: {
          0: "정의가 없거나 핵심 오해가 있음",
          1: "일부 정의가 있으나 초등학생에게 충분히 쉽지 않음",
          2: "초등학생이 이해할 수 있는 쉬운 정의를 제시함"
        }
      }
    ],
    problemNumber: 1,
    rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION
  },
  {
    commonCodes: commonRubricCodes,
    problemCodes: [
      {
        code: "mechanism_compare",
        label: "일반 컴퓨터와 양자컴퓨터 비교",
        scoreGuide: {
          0: "정보 처리 방식의 차이가 드러나지 않음",
          1: "차이를 일부 언급함",
          2: "일반 컴퓨터와 양자컴퓨터의 정보 처리 차이를 명확히 비교함"
        }
      },
      {
        code: "mechanism_keyidea",
        label: "핵심 원리 설명",
        scoreGuide: {
          0: "핵심 원리가 빠져 있음",
          1: "핵심 원리를 얕게 언급함",
          2: "중첩, 동시성, 정보 표현 차이 중 핵심 아이디어를 설명함"
        }
      }
    ],
    problemNumber: 2,
    rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION
  },
  {
    commonCodes: commonRubricCodes,
    problemCodes: [
      {
        code: "misconception_boundary",
        label: "모든 문제를 빠르게 푼다는 오개념 구분",
        scoreGuide: {
          0: "오개념을 바로잡지 못함",
          1: "단순히 틀렸다고 말함",
          2: "맞는 부분과 틀린 부분을 조건과 함께 구분함"
        }
      },
      {
        code: "correction_quality",
        label: "더 정확한 설명으로 고치기",
        scoreGuide: {
          0: "더 정확한 표현이 없음",
          1: "부분적으로 고침",
          2: "조건과 한계를 포함해 더 정확한 설명으로 재구성함"
        }
      }
    ],
    problemNumber: 3,
    rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION
  },
  {
    commonCodes: commonRubricCodes,
    problemCodes: [
      {
        code: "application_condition",
        label: "조건부 적용 판단",
        scoreGuide: {
          0: "복잡하면 무조건 좋다는 말을 그대로 수용함",
          1: "일부 유보를 표현함",
          2: "도움이 되는 경우와 조건을 구분해 판단함"
        }
      },
      {
        code: "nonapplicability",
        label: "도움이 되지 않을 수 있는 경우",
        scoreGuide: {
          0: "부적합하거나 필요하지 않은 경우를 설명하지 않음",
          1: "암시적으로만 언급함",
          2: "양자컴퓨터가 꼭 더 좋지 않은 경우를 함께 설명함"
        }
      }
    ],
    problemNumber: 4,
    rubricVersion: UNDERSTANDING_CALIBRATION_RUBRIC_VERSION
  }
];
