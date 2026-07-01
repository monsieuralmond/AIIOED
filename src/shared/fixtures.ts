import type { Assignment, ClassGroup, Outline, StudentAccount, TeacherAccount } from "./types";

export const sampleTeacher: TeacherAccount = {
  id: "teacher-research",
  displayName: "연구 교사",
  loginId: "test",
  password: "test"
};

export const sampleTeachers: readonly TeacherAccount[] = [sampleTeacher];

export const sampleStudents: readonly StudentAccount[] = [
  {
    id: "student-minseo",
    displayName: "김민서",
    classGroupId: "class-pilot",
    studentNumber: 1,
    loginId: "minseo",
    password: "MINSEO-2026",
    participantCode: "S-MINSEO"
  },
  {
    id: "student-joon",
    displayName: "이준",
    classGroupId: "class-pilot",
    studentNumber: 2,
    loginId: "joon",
    password: "JOON-2026",
    participantCode: "S-JOON"
  }
];

export const sampleClassGroups: readonly ClassGroup[] = [
  {
    id: "class-pilot",
    name: "파일럿 반",
    teacherId: sampleTeacher.id,
    studentIds: sampleStudents.map((student) => student.id)
  }
];

export const sampleAssignment: Assignment = {
  id: "assignment-plastic",
  title: "플라스틱 사용을 줄여야 할까?",
  passage:
    "플라스틱은 가볍고 값이 싸서 일상에서 널리 쓰인다. 하지만 한 번 쓰고 버려지는 플라스틱은 분해되는 데 오랜 시간이 걸리며, 강과 바다로 흘러가 생태계에 피해를 줄 수 있다. 일부 사람들은 플라스틱이 위생과 편리함을 제공한다고 말하지만, 다른 사람들은 재사용 가능한 물건을 늘리고 불필요한 포장을 줄여야 한다고 주장한다.",
  question: "위 지문을 바탕으로 일회용 플라스틱 사용을 줄여야 하는지에 대한 자신의 주장을 쓰세요. 근거와 반론을 포함하세요.",
  gradeLevel: "초등 고학년",
  targetLength: "400자",
  assignmentMode: "full_process",
  essayType: "주장 글쓰기",
  minimumWordCount: "400",
  requirements: [
    "문제에 직접 답하는 중심 생각 한 문장",
    "지문에서 근거 두 가지를 찾아 내 말로 설명하기",
    "반대 의견을 생각하고 내 주장을 다시 확인하기"
  ],
  sourceGuidance: "지문 근거를 먼저 사용하고, 외부 자료가 필요하면 출처를 적어둡니다.",
  classGroupId: "class-pilot",
  createdByTeacherId: sampleTeacher.id
};

export const emptyOutline: Outline = {
  claim: "",
  evidence: ["", ""],
  reasoning: "",
  counterargument: "",
  question: ""
};

export const sampleOutline: Outline = {
  claim: "일회용 플라스틱은 줄여야 한다",
  evidence: ["분해가 오래 걸린다", "생태계에 피해를 준다"],
  reasoning: "편리함보다 환경 피해가 더 오래 남기 때문이다.",
  counterargument: "위생과 편리함도 중요하다는 반론이 있다.",
  question: "지문: 플라스틱 분해와 생태계 피해 문장"
};

export const sampleDraft =
  "일회용 플라스틱은 줄여야 한다. 지문에 따르면 플라스틱은 분해되는 데 오랜 시간이 걸리고 강과 바다로 흘러가 생태계에 피해를 줄 수 있다. 물론 플라스틱이 위생과 편리함을 준다는 반론도 있지만, 오래 남는 환경 피해를 줄이기 위해 재사용 가능한 물건과 불필요한 포장 줄이기를 함께 실천해야 한다.";
