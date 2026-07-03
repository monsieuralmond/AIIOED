# Reading Coach Lab 현재 구현 기능 상세 문서

작성 기준: 2026-07-02 현재 코드 기준

이 문서는 현재 `Reading Coach Lab`에 실제로 구현되어 있는 기능을 빠짐없이 확인하기 위한 기능 명세다. 연구 아이디어, 향후 계획, 미구현 기대 기능이 아니라 코드에 존재하는 동작을 기준으로 쓴다.

현재 플랫폼은 두 가지 연구/학습 흐름을 함께 갖는 React 기반 웹 애플리케이션이다.

- `writing_coach`: 비문학 지문을 읽고 개요, 초안, 고쳐쓰기, 제출 과정을 수행하는 글쓰기 코치 흐름
- `understanding_calibration`: AI와 학습한 뒤 학생의 수행 예측, 독립 설명 수행, 확신도, 회고를 원자료로 수집하는 연구 흐름

## 1. 기술 구조

### 1.1 실행 환경

- 프론트엔드: React 19, TypeScript, Vite
- 테스트: Vitest, Playwright
- 서버성 기능: Vite dev/preview middleware
- AI 호출: Gemini API 또는 로컬 mock
- 런타임 상태 저장: 브라우저 `localStorage`
- 파일 동기화: Vite middleware가 전체 상태 JSON을 로컬 파일로 저장

### 1.2 주요 경로

| 경로 | 화면 | 주 사용자 | 구현된 기능 |
| --- | --- | --- | --- |
| `/` | 교사 과제 목록 또는 학생 배정 과제 목록 | 교사, 학생 | 역할에 따라 과제 관리 또는 학생 과제 선택 표시 |
| `/assignments/new` | 과제 만들기/수정 | 교사 | 글쓰기 코치 과제와 이해 연구 과제 생성/수정 |
| `/student` | 학생 활동 화면 | 학생 | 글쓰기 코치 흐름 또는 이해 연구 흐름 진행 |
| `/review` | 학생 현황/과정 기록 | 교사 | 과제별 학생 결과, 대화, 산출물, 교사 검토 확인 |
| `/export` | 연구 로그 | 교사 | JSON, CSV, 스키마, 코드북, 데이터 딕셔너리 다운로드 |
| `/accounts` | 계정 관리 | 교사 | 반, 학생, 교사 계정 생성/삭제 및 학생 일괄 생성 |

### 1.3 라우팅 방식

- 브라우저 `window.location.pathname`을 기준으로 초기 화면을 정한다.
- 화면 이동 시 `history.pushState`로 URL을 바꾸고 React state의 `route` 값을 갱신한다.
- 별도 라우터 라이브러리는 사용하지 않는다.

## 2. 기본 데이터와 계정

### 2.1 초기 교사 계정

기본 교사 계정은 다음과 같다.

| 항목 | 값 |
| --- | --- |
| 이름 | 연구 교사 |
| 아이디 | `test` |
| 비밀번호 | `test` |

### 2.2 초기 학생 계정

| 학생 | 번호 | 아이디 | 비밀번호 | 참여자 코드 |
| --- | --- | --- | --- | --- |
| 김민서 | 1 | `minseo` | `MINSEO-2026` | `S-MINSEO` |
| 이준 | 2 | `joon` | `JOON-2026` | `S-JOON` |

### 2.3 초기 반

| 항목 | 값 |
| --- | --- |
| 반 이름 | 파일럿 반 |
| 담당 교사 | 연구 교사 |
| 포함 학생 | 김민서, 이준 |

### 2.4 초기 과제

| 항목 | 값 |
| --- | --- |
| 제목 | 플라스틱 사용을 줄여야 할까? |
| 연구 모드 | `writing_coach` |
| 연구 조건 | `single_group_baseline` |
| 과제 유형 | `full_process` |
| 글 유형 | 주장 글쓰기 |
| 난이도 | 초등 고학년 |
| 목표 분량 | 400자 |
| 최소 글자 수 | 400 |
| 배정 반 | 파일럿 반 |

초기 과제에는 플라스틱 사용의 편리함, 환경 피해, 재사용 가능한 물건, 불필요한 포장 줄이기와 관련된 비문학 지문이 포함되어 있다.

## 3. 역할과 로그인

### 3.1 역할 종류

현재 역할은 두 가지다.

- `teacher`
- `student`

선택된 역할은 `PilotState.selectedActor`에 저장된다.

### 3.2 학생 로그인

학생은 두 방식으로 들어갈 수 있다.

- 참여자 코드 입력
- 학생 아이디와 학생 비밀번호 입력

학생 로그인 실패 시 다음 오류가 표시된다.

- 참여자 코드 오류: `참여자 코드를 확인하세요`
- 아이디/비밀번호 오류: `학생 아이디 또는 비밀번호가 맞지 않습니다`

### 3.3 교사 로그인

교사는 교사 아이디와 교사 비밀번호로 들어간다.

교사 로그인 실패 시 `교사 아이디 또는 비밀번호가 맞지 않습니다`가 표시된다.

### 3.4 교사 전용 경로 보호

다음 경로는 교사 화면이다.

- `/assignments/new`
- `/review`
- `/export`
- `/accounts`

교사 역할이 선택되어 있지 않은 상태에서 위 경로에 접근하면 교사 로그인 화면이 먼저 표시된다.

### 3.5 역할 전환과 로그아웃

- 교사 화면 상단에는 `역할 바꾸기` 버튼이 표시된다.
- 학생 화면 상단에는 역할 전환 버튼이 표시되지 않는다.
- 학생 화면에는 로그아웃 동작이 제공되어 다른 학생 계정으로 다시 들어갈 수 있다.
- 역할 전환 또는 로그아웃 시 `selectedActor`가 `null`로 바뀌고 초기 진입 화면으로 돌아간다.

## 4. 상태 저장 구조

### 4.1 `PilotState`

앱의 주요 상태는 하나의 `PilotState` 객체에 저장된다.

포함 항목은 다음과 같다.

- `schemaVersion`
- `teacher`
- `teachers`
- `students`
- `classGroups`
- `assignments`
- `sessions`
- `selectedActor`
- `activeAssignmentId`
- `activeSessionId`
- `metadata`

### 4.2 브라우저 저장

- 저장 위치: `window.localStorage`
- 저장 키: `reading-coach-lab:v1`
- 상태가 바뀔 때마다 전체 `PilotState`가 JSON 문자열로 저장된다.
- 같은 브라우저와 같은 origin에서 새로고침 후에도 상태가 유지된다.

### 4.3 파일 저장

Vite dev/preview 서버가 켜져 있으면 상태가 바뀔 때 다음 API로 전체 상태가 POST된다.

- `POST /api/pilot-state`

현재 파일 저장 위치는 다음과 같다.

- `.omo/evidence/khan-parity-auth-persistence/server-state.json`

`ExportView`에는 파일 저장 상태가 표시된다.

- 저장됨
- 저장 실패
- 파일 저장 미사용
- 저장 확인 전

### 4.4 저장 한계

현재 저장은 연구 파일럿용이다.

- 실제 DB가 아니다.
- 여러 기기 동시 접속을 안전하게 병합하지 않는다.
- 서버 인증 세션이 없다.
- 계정 비밀번호는 내부 상태와 계정 관리 화면에 평문으로 존재한다.
- export JSON에서는 비밀번호가 제거된다.

## 5. 교사 과제 목록 화면

교사가 `/`에 들어가면 과제 목록 화면이 표시된다.

### 5.1 왼쪽 메뉴

왼쪽 메뉴에는 다음 버튼이 있다.

- 과제 둘러보기
- 내 과제 만들기
- 학생 현황
- 학생 화면 보기
- 로그 보기
- 계정 관리

### 5.2 과제 목록 탭

상단에는 다음 탭 형태 UI가 있다.

- 현재 과제
- 사회 · 과학
- 내 보관함
- 직접 만들기

현재 이 탭들은 실제 별도 데이터 소스를 전환하기보다는 과제 목록 UI의 분류 표시 역할을 한다. `직접 만들기`는 새 과제 만들기로 이동한다.

### 5.3 과제 검색

검색어는 다음 텍스트를 대상으로 작동한다.

- 과제 제목
- 문제
- 지문
- 학년/난이도
- 목표 분량
- 글 유형 또는 연구 모드 분류
- Understanding Calibration 주제
- Understanding Calibration 오류 판단 문장
- 반 이름

### 5.4 범주 필터

범주 필터는 체크박스로 작동한다.

기본 범주는 다음과 같다.

- 주장 글쓰기
- 근거 비교
- 반론 탐색

과제 목록에 존재하는 글 유형도 필터에 추가된다.

Understanding Calibration 과제는 `이해 보정 연구` 범주로 표시된다.

### 5.5 학년 필터

과제에 저장된 `gradeLevel` 값을 기준으로 드롭다운 필터가 만들어진다.

기본 선택값은 `전체 학년`이다.

### 5.6 과제 카드 표시 정보

각 과제 행에는 다음 정보가 표시된다.

- 과제 제목
- 문제
- 배정 학생 수
- 진행 중 학생 수
- 제출 완료 학생 수
- 태그
  - 비문학
  - 글쓰기 코치 또는 이해 보정 연구
  - 학년/난이도
  - 글 유형
  - 반 이름 또는 전체 학생
- 즐겨찾기처럼 보이는 하트 표시
- 수정 버튼
- 미리보기 및 배정 또는 선택 및 미리보기 버튼

### 5.7 과제 진행 요약

과제별 진행 요약은 다음 기준으로 계산된다.

- 배정 학생: 과제에 연결된 반의 학생 수, 반이 없으면 전체 학생 수
- 진행 중: 해당 과제 세션 중 최종 제출은 없고 이벤트가 있는 세션 수
- 제출 완료: 해당 과제 세션 중 최종 제출이 있는 세션 수

## 6. 과제 미리보기와 배정

과제 카드에서 미리보기를 열면 오른쪽 모달 형태의 과제 미리보기가 나온다.

### 6.1 공통 표시

- 제목
- 비문학 태그
- 글쓰기 코치 또는 이해 보정 연구 태그
- 학년/난이도
- 목표 분량
- 글 유형
- 문제
- 지문
- 배정할 반 선택
- 선택한 반의 학생 수
- 닫기
- 선택한 반에 배정

### 6.2 글쓰기 코치 과제 미리보기

글쓰기 코치 과제는 학생에게 보일 요구사항을 목록으로 보여준다.

요구사항이 없으면 기본 요구사항이 사용된다.

- 문제에 직접 답하는 중심 생각 한 문장
- 지문에서 근거 두 가지를 찾아 내 말로 설명하기
- 반대 의견을 생각하고 내 주장을 다시 확인하기

### 6.3 이해 연구 과제 미리보기

Understanding Calibration 과제는 다음 설정을 보여준다.

- 주제
- 오류 판단 문장
- 채팅 권장 시간
- 적용 선택지

### 6.4 배정 동작

`선택한 반에 배정`을 누르면 과제의 `classGroupId`가 선택한 반으로 저장된다.

저장된 과제는 `activeAssignmentId`가 된다.

## 7. 과제 만들기와 수정

`/assignments/new` 화면은 새 과제 생성과 기존 과제 수정을 함께 처리한다.

### 7.1 과제 모드

선택 가능한 과제 모드는 두 가지다.

- 기존 글쓰기 코치
- AI 기반 이해 보정 연구

저장되는 값은 각각 다음과 같다.

- `writing_coach`
- `understanding_calibration`

### 7.2 글쓰기 코치 과제 유형

글쓰기 코치 모드에서는 세부 과제 유형을 선택할 수 있다.

- 전체 글쓰기 과정
- 초안 피드백과 수정

저장되는 값은 다음과 같다.

- `full_process`
- `revision_feedback`

현재 `revision_feedback`은 과제 속성으로 저장되지만 학생 UI가 완전히 별도 흐름으로 분기되지는 않는다. 학생은 기존 글쓰기 코치 작업 화면을 사용한다.

### 7.3 공통 과제 입력 항목

공통 입력 항목은 다음과 같다.

- 과제 제목
- 학년 또는 난이도
- 비문학 지문
- 배정할 반
- 시작일
- 시작 시간
- 마감일
- 마감 시간

### 7.4 글쓰기 코치 과제 입력 항목

글쓰기 코치 모드에서는 다음 항목을 입력한다.

- 글 유형
- 목표 분량
- 최소 글자 수
- 해결할 문제
- 학생에게 보일 요구사항
- 근거와 출처 안내

글 유형 옵션은 다음과 같다.

- 주장 글쓰기
- 근거 비교
- 반론 탐색
- 설명 글쓰기
- 비교 글쓰기
- 문학 분석

### 7.5 Understanding Calibration 과제 입력 항목

이해 연구 모드에서는 다음 항목을 입력한다.

- 주제명
- 최대 채팅 권장 시간
- AI 보조자료 또는 설명 자료
- 오류 판단 문장
- 적용 과제 선택지 A, B, C, D

현재 독립 수행 문제 자체는 코드에 고정되어 있으며, 과제 생성 화면의 적용 선택지는 데이터에 저장되지만 현재 학생 문제 흐름의 네 문제를 대체하지 않는다.

### 7.6 과제 저장 검증

글쓰기 코치 과제는 다음 조건을 검증한다.

- 제목이 있어야 한다.
- 비문학 지문이 있어야 한다.
- 해결할 문제가 있어야 한다.
- 학생에게 보일 요구사항이 하나 이상 있어야 한다.

Understanding Calibration 과제는 다음 조건을 검증한다.

- 제목이 있어야 한다.
- 비문학 지문이 있어야 한다.
- 주제명이 있어야 한다.
- 최대 채팅 권장 시간이 입력된 경우 1 이상의 숫자여야 한다.
- 오류 판단 문장이 있어야 한다.
- 적용 과제 선택지 네 개가 모두 있어야 한다.

## 8. 계정 관리

`/accounts` 화면은 반, 학생, 교사 계정을 관리한다.

### 8.1 반 만들기

입력 항목은 다음과 같다.

- 새 반 이름
- 담당 교사

생성 시 검증은 다음과 같다.

- 반 이름이 비어 있으면 오류
- 담당 교사가 없으면 오류
- 같은 이름의 반이 이미 있으면 오류

### 8.2 학생 만들기

입력 항목은 다음과 같다.

- 학생 반
- 학생 번호
- 참여자 코드
- 학생 아이디
- 학생 비밀번호
- 학생 이름

학생 아이디를 비워두면 참여자 코드를 소문자로 바꾼 값이 사용된다.

학생 비밀번호를 비워두면 참여자 코드가 비밀번호로 사용된다.

생성 시 검증은 다음과 같다.

- 학생 이름 필수
- 학생 아이디 필수
- 학생 비밀번호 필수
- 참여자 코드 필수
- 학생 번호는 1 이상의 정수
- 반이 존재해야 함
- 학생 아이디 중복 불가
- 참여자 코드 중복 불가
- 같은 반 안에서 학생 번호 중복 불가

### 8.3 학생 일괄 만들기

입력 항목은 다음과 같다.

- 일괄 생성 반
- 시작 번호
- 생성 갯수
- 아이디 접두어
- 비밀번호 접두어
- 학생 이름 접두어

생성 규칙은 다음과 같다.

- `startNumber`부터 `count`개 생성
- 번호 폭은 최소 2자리로 맞춘다.
- 아이디: `아이디 접두어 + 번호`
- 참여자 코드: 아이디를 대문자로 바꾼 값
- 비밀번호: `비밀번호 접두어 + 번호`
- 이름: `학생 이름 접두어 + 실제 번호`

예시는 다음과 같다.

- 아이디 접두어: `student-`
- 시작 번호: `3`
- 생성 갯수: `5`
- 결과: `student-03`부터 `student-07`

### 8.4 교사 만들기

입력 항목은 다음과 같다.

- 교사 이름
- 교사 아이디 만들기
- 교사 비밀번호 만들기

생성 시 검증은 다음과 같다.

- 교사 이름 필수
- 교사 아이디 필수
- 교사 비밀번호 필수
- 교사 아이디 중복 불가

### 8.5 저장된 목록

계정 관리 오른쪽에는 세 목록이 표시된다.

반 목록:

- 반
- 담당 교사
- 학생 수
- 삭제 버튼

학생 계정 목록:

- 반
- 번호
- 학생
- 참여자 코드
- 학생 아이디
- 초기 비밀번호
- 삭제 버튼

교사 계정 목록:

- 교사
- 아이디
- 비밀번호
- 삭제 버튼

### 8.6 삭제 동작

반 삭제:

- 해당 반을 삭제한다.
- 해당 반 학생도 삭제한다.
- 해당 학생의 세션도 삭제한다.
- 해당 반에 배정된 과제는 반 배정이 해제된다.

학생 삭제:

- 학생 계정을 삭제한다.
- 해당 학생의 세션도 삭제한다.
- 반의 `studentIds`에서 제거된다.

교사 삭제:

- 마지막 교사 계정은 삭제할 수 없다.
- 삭제되는 교사가 담당하던 반은 남은 첫 번째 교사에게 연결된다.
- 삭제되는 교사가 현재 선택된 교사라면 선택 역할이 해제된다.

## 9. 학생 배정 과제 목록

학생이 로그인하면 자신의 반에 배정된 과제만 볼 수 있다.

### 9.1 과제 표시 정보

학생 과제 목록에는 다음 정보가 표시된다.

- 학생 이름
- 배정된 과제 제목
- 문제
- 난이도
- 목표 분량
- 상태
  - 시작 전
  - 진행 중
  - 제출 완료
- 마감일과 마감 시간이 있는 경우 마감 정보
- 내가 제출할 글 요구사항
- 근거와 출처 안내
- 지문 미리보기
- 과제 시작 버튼

### 9.2 과제 시작

학생이 `과제 시작`을 누르면 새 세션이 생성된다.

세션은 다음 기준으로 만들어진다.

- 학생 계정 ID
- 선택한 과제 ID
- 과제 연구 모드
- 과제 연구 조건

같은 학생이 같은 과제를 다시 시작하면 새 세션이 추가된다. 교사 현황에서는 같은 학생/과제 조합의 가장 최근 세션을 보여준다.

## 10. 글쓰기 코치 학생 흐름

`writing_coach` 과제는 네 단계로 진행된다.

- 읽기
- 개요 작성
- 초안 쓰기
- 고쳐쓰기

### 10.1 공통 학생 작업 화면

학생 작업 화면에는 다음 요소가 있다.

- 과제 제목
- 과제 보기 버튼
- 현재 단계 표시
- 이전 단계 버튼
- 다음 단계 버튼
- 왼쪽 작업 영역
- 오른쪽 도움 패널

이전 단계 이동은 글쓰기 코치 흐름에서 가능하다.

### 10.2 과제 보기 모달

학생은 작업 중 `과제 보기`를 눌러 과제 내용을 다시 확인할 수 있다.

표시 정보는 현재 단계에 따라 체크리스트 제목이 달라진다.

- 읽기 전에 확인
- 개요 쓰기 전에 확인
- 초안 쓰기 전에 확인
- 제출 전에 확인

모달에는 다음이 포함된다.

- 과제 제목
- 학년/난이도
- 목표 분량
- 글 유형
- 요구사항
- 근거와 출처 안내
- 문제
- 지문

### 10.3 읽기 단계

읽기 단계는 과제 이해 단계다.

표시 정보:

- 과제를 먼저 이해해요 안내
- 과제 제목
- 난이도
- 목표
- 지문
- 문제
- 이해했어요 버튼

`이해했어요`를 누르면 개요 작성 단계로 이동한다.

### 10.4 개요 작성 단계

입력 항목은 다음과 같다.

- 중심 생각
- 근거 또는 예시 여러 개
- 출처 메모 여러 개
- 설명 또는 연결 1
- 반대 의견

조작 기능은 다음과 같다.

- 근거 추가
- 근거 삭제
- 출처 추가
- 출처 삭제
- 개요 점검
- 초안 쓰기 시작

### 10.5 생각 정리 순서 안내

개요 작성 단계에는 진행 안내가 표시된다.

점검 항목은 다음과 같다.

- 주장
- 근거
- 출처
- 연결
- 반론

각 항목은 완료 여부가 표시되고, 아직 필요한 항목은 해당 입력 위치로 이동할 수 있다.

### 10.6 개요 점검 규칙

개요 점검은 다음 조건을 본다.

- 중심 생각이 10자 이상인가
- 근거가 2개 이상인가
- 출처 메모가 있는가
- 설명 또는 연결이 20자 이상인가
- 반대 의견이 있는가

부족한 항목이 있으면 경고가 나온다.

경고가 있어도 `그래도 초안 쓰기`로 이동할 수 있다.

### 10.7 개요 저장 로그

개요가 바뀔 때 다음이 저장된다.

- `outlineSnapshots`
- `outline_edited` 이벤트
- 중심 생각이 있으면 `claim_revised`
- 근거가 있으면 `evidence_added`
- 출처가 있으면 `source_added`
- 반론이 있으면 `counterargument_added`

개요 점검 또는 부족한 개요로 초안 이동을 시도하면 `outline_warning_shown` 이벤트가 저장된다.

### 10.8 초안 쓰기 단계

초안 쓰기 단계에는 다음이 표시된다.

- 내 개요 요약
- 초안 준비 점검
- 최종 글쓰기 입력창
- 글자 수
- 고쳐쓰기 시작 버튼

초안 준비 점검 항목은 다음과 같다.

- 중심 생각
- 근거
- 출처 단서
- 반대 의견

### 10.9 초안 저장 로그

초안 입력이 바뀔 때마다 다음이 저장된다.

- `draftSnapshots`
- `draft_edited` 이벤트

### 10.10 붙여넣기 기록

초안 입력창과 고쳐쓰기 입력창에서 붙여넣기를 하면 다음이 저장된다.

- `pasteEvents`
- `paste_detected` 이벤트
- 붙여넣은 텍스트 길이
- 줄 수
- 앞 80자 미리보기
- 대상 필드
- `fromClipboard: true`

붙여넣기 자체를 완전히 막지는 않는다.

### 10.11 고쳐쓰기 단계

고쳐쓰기 단계에는 다음이 표시된다.

- 고쳐쓰기 제목
- 선택한 피드백 초점
- 초안 편집창
- 글자 수
- 제출 버튼
- 제출 완료 표시
- 오른쪽 피드백 패널

초안 편집창에는 선택한 피드백과 관련된 부분을 하이라이트하는 레이어가 있다.

### 10.12 고쳐쓰기 피드백 패널

피드백 패널에는 다음이 표시된다.

- 전체 제안 수
- 해결한 제안 수
- 남은 제안 수
- 현재 볼 곳
- 제안 범주
- 제안 상세
- 내 수정 확인
- 해결 표시

범주는 다음과 같다.

- 주장과 초점
- 근거와 설명
- 구조와 흐름
- 문장 표현

### 10.13 규칙 기반 피드백 제안

기본 피드백은 규칙 기반으로 만들어진다.

제안 ID와 조건은 다음과 같다.

| 제안 ID | 조건 |
| --- | --- |
| `claim` | 초안에 중심 생각의 핵심 단어가 보이지 않음 |
| `evidence` | 개요에 쓴 근거가 초안에 충분히 들어가지 않음 |
| `source` | 출처 메모가 있는데 초안에 출처 단서가 보이지 않음 |
| `counterargument` | 반론이 있는데 `하지만`, `반면`, `그럼에도` 같은 연결이 보이지 않음 |
| `length` | 초안이 300자 미만 |
| `positive` | 위 문제가 거의 없을 때 전체 흐름 점검 제안 |

### 10.14 내 수정 확인

학생이 `내 수정 확인`을 누르면 선택한 제안이 해결됐는지 확인한다.

기본 제안은 로컬 규칙으로 확인한다.

AI가 만든 비기본 제안은 Gemini API를 사용할 수 있다.

확인 결과는 다음 이벤트로 남는다.

- `suggestion_checked`
- 해결된 경우 `suggestion_resolved`

### 10.15 최종 제출

`제출`을 누르면 다음이 저장된다.

- `finalSubmission.text`
- `finalSubmission.submittedAt`
- 세션 `status: submitted`
- 세션 `completedAt`
- `stage_completed`
- `submission_created`

## 11. 학생 도움 패널

글쓰기 코치 흐름의 오른쪽 도움 패널은 단계에 따라 탭이 다르다.

### 11.1 탭 구성

| 단계 | 탭 |
| --- | --- |
| 읽기 | 코치 |
| 개요 작성 | 코치 |
| 초안 쓰기 | 코치, 개요 |
| 고쳐쓰기 | 피드백, 개요 |

### 11.2 코치 탭

코치 탭에는 빠른 질문과 채팅 입력창이 있다.

빠른 질문은 다음과 같다.

- 과제 설명해줘
- 요구사항 확인
- 근거 점검
- 개요 도와줘
- 막혔어요

단계에 따라 일부 빠른 질문은 표시되지 않는다.

### 11.3 채팅 로그

채팅 로그에는 다음이 표시된다.

- 기본 안내 메시지
- 학생 메시지
- AI 코치 메시지
- AI 응답 유형 라벨

응답 유형 라벨은 다음과 같다.

- 과제 설명
- 근거 점검
- 질문
- 과제 복귀
- 대신 쓰기 거절
- 고쳐쓰기 안내

### 11.4 개요 탭

개요 탭에는 현재 개요 요약이 표시된다.

- 중심 생각
- 근거
- 출처
- 설명
- 반대 의견

### 11.5 복사 방지

도움 패널과 채팅 로그에는 `copy` 이벤트 방지가 걸려 있다.

이는 일반적인 브라우저 복사 동작을 막는 수준이며, 모든 기기와 모든 우회 방법을 완전히 차단하는 보안 기능은 아니다.

## 12. 글쓰기 코치 AI

### 12.1 API 경로

글쓰기 코치 관련 API는 다음과 같다.

- `POST /api/coach/message`
- `POST /api/review/suggestions`
- `POST /api/review/check`

### 12.2 AI 모드

환경 변수 `READING_COACH_AI_MODE`가 `mock`이면 로컬 규칙 기반 응답을 사용한다.

그 외에는 Gemini API를 사용한다.

### 12.3 Gemini 설정

현재 기본 모델은 다음과 같다.

- `gemini-2.5-flash-lite`

환경 변수 `GEMINI_MODEL`이 있으면 그 값을 사용한다.

환경 변수 `GEMINI_API_KEY`가 없으면 실제 Gemini 호출은 실패한다.

### 12.4 로컬 정책 선차단

Gemini 호출 전에도 로컬 정책이 먼저 작동한다.

다음과 같은 과제 밖 질문은 `redirect`로 처리된다.

- 날씨
- 축구
- 게임
- 노래
- 뉴스

다음과 같은 대신 작성 요청은 `refusal`로 처리된다.

- 써 줘
- 작성해
- 대신 써
- 고쳐 줘
- 바꿔 줘
- 멋지게
- 초안
- 문장

### 12.5 응답 유형

AI 코치 응답 유형은 여섯 가지다.

| 값 | 의미 |
| --- | --- |
| `clarify` | 과제나 요구사항 설명 |
| `question` | 학생이 스스로 생각하도록 질문 |
| `evidence_check` | 근거와 출처 점검 |
| `redirect` | 과제 밖 질문을 과제로 돌림 |
| `revision_guidance` | 고쳐쓰기 안내 |
| `refusal` | 대신 쓰기 거절 |

응답 유형은 `ChatTurn.responseType`과 `assistant_message` 이벤트 payload에 저장된다.

### 12.6 Gemini 응답 형식

Gemini 기반 코치 응답은 JSON이어야 한다.

필수 구조:

- `text`
- `type`

`type`은 여섯 응답 유형 중 하나여야 한다.

## 13. Understanding Calibration 연구 흐름

`understanding_calibration` 과제는 글쓰기 코치와 별도의 학생 흐름을 사용한다.

현재 연구 목적은 자동 평가가 아니라 원자료 수집이다.

자동 계산하지 않는 항목:

- Calibration Gap
- Independent Performance 점수
- LLM Judge 평가
- 그래프/통계

### 13.1 연구 조건

현재 실제 활성 조건은 하나다.

- `single_group_baseline`

다음 조건은 타입과 상수로 예약되어 있지만 실제 UI에 노출되거나 배정되지 않는다.

- `evidence_check`
- `challenge`
- `explanation_rich`

예약 조건이 들어와도 현재는 `single_group_baseline`으로 정규화된다.

학생 화면에는 연구 조건명이 보이지 않는다.

export JSON/CSV에는 `researchCondition` 값이 포함된다.

### 13.2 전체 단계

학생 흐름은 다음 순서로 진행된다.

1. 시작 전 확인
2. 글 읽기
3. AI에게 질문하기
4. 다음 활동 전 확인
5. 문제 1
6. 문제 1 확신도
7. 문제 2
8. 문제 2 확신도
9. 문제 3
10. 문제 3 확신도
11. 문제 4
12. 문제 4 확신도
13. 활동 돌아보기
14. 대화 다시 보기
15. 마무리 생각
16. 완료

### 13.3 화면 원칙

현재 구현된 화면 원칙은 다음과 같다.

- 한 화면에 한 활동만 표시한다.
- 독립 수행 문제는 하나씩만 표시한다.
- 학생에게 `Calibration`, `Metacognition`, `IOED`, `Prediction` 같은 연구 용어를 노출하지 않는다.
- 독립 수행 문제 제출 후 이전 문제로 돌아가는 버튼은 제공하지 않는다.
- 문제 답변은 제출 후 수정할 수 없다.
- 뒤 문제를 미리 볼 수 없다.

### 13.4 시작 전 확인

학생은 1~5 척도로 다음 문항에 응답한다.

- 나는 이 주제에 대해 들어본 적이 있다.
- 나는 이 주제가 무엇인지 설명할 수 있다.
- 나는 이 주제의 원리나 이유를 설명할 수 있다.
- 나는 이 주제의 한계를 설명할 수 있다.

추가로 자유 응답을 쓴다.

- 이 주제에 대해 현재 알고 있는 내용을 자유롭게 써 보세요.

저장되는 데이터:

- artifact `pre_free_response`
- measure `pre_self_report`
- event `calibration_pre_survey_submitted`
- event `calibration_reading_started`

### 13.5 글 읽기

학생은 과제의 지문을 읽는다.

`질문하러 가기`를 누르면 다음이 저장된다.

- event `calibration_reading_completed`
- event `calibration_chat_started`
- 읽기 시작부터 완료까지의 `durationMs`
- 지문 길이
- 주제

### 13.6 AI에게 질문하기

학생은 지문과 관련해 AI에게 자유롭게 질문한다.

화면에는 다음이 있다.

- 이전 대화 로그
- 질문 입력창
- 보내기 버튼
- 다음 활동 전 확인 버튼

AI 대화가 하나도 없으면 다음 단계로 갈 수 없다.

대화 턴이 생기면 다음이 저장된다.

- 학생 `ChatTurn`
- assistant `ChatTurn`
- event `student_message`
- event `assistant_message`
- event `calibration_chat_turn_created`

`calibration_chat_turn_created`에는 다음 payload가 들어간다.

- `aiMode`
- `model`
- `userMessage`
- `userMessageLength`
- `assistantMessage`
- `assistantMessageLength`
- `requestTags`
- `studentTurnId`
- `assistantTurnId`

대화 완료 시 다음이 저장된다.

- event `calibration_chat_completed`
- 시작 시각
- 완료 시각
- 소요 시간
- 전체 턴 수
- 학생 메시지 총 글자 수
- assistant 메시지 총 글자 수
- 마지막 request tags

### 13.7 다음 활동 전 확인

학생은 1~5 척도로 다음 수행 예측 문항에 응답한다.

- 나는 이 개념을 설명할 수 있다.
- 나는 작동 원리를 설명할 수 있다.
- 나는 잘못된 설명을 바로잡을 수 있다.
- 나는 새로운 상황에 적용할 수 있다.

저장되는 데이터:

- measure `prediction_self_report`
- event `calibration_prediction_survey_submitted`
- event `question_started` for problem 1

### 13.8 독립 수행 문제

독립 수행 문제는 네 개다.

#### Problem 1: 자유 설명

학생에게 제시되는 문제:

> 초등학교 6학년 동생이 "양자컴퓨터가 뭐야?"라고 물었습니다.
>
> 동생이 이해할 수 있도록 자신의 말로 쉽게 설명하세요.

저장되는 artifact:

- `problem1`

저장되는 measure:

- `problem1_confidence`

#### Problem 2: 원리 설명

학생에게 제시되는 문제:

> 동생이 "그런데 왜 그렇게 빠른 거야?"라고 다시 물었습니다.
>
> 일반 컴퓨터와 양자컴퓨터가 정보를 처리하는 방식의 차이를 중심으로 설명하세요.

저장되는 artifact:

- `problem2`

저장되는 measure:

- `problem2_confidence`

#### Problem 3: 오개념 수정

학생에게 제시되는 문제:

> 친구가 말했습니다.
>
> "양자컴퓨터는 모든 문제를 엄청 빨리 푸는 컴퓨터야."
>
> 맞는 부분과 틀린 부분을 구분하여 설명하고 더 정확하게 고쳐주세요.

저장되는 artifact:

- `problem3`

저장되는 measure:

- `problem3_confidence`

#### Problem 4: 적용 판단

학생에게 제시되는 문제:

> 어떤 사람이 이렇게 말했습니다.
>
> "계산이 복잡한 문제라면 양자컴퓨터를 쓰면 무조건 더 좋겠네."
>
> 이 말에 대해 어떻게 생각하는지 설명하세요.
>
> 양자컴퓨터가 도움이 될 수 있는 경우와 그렇지 않을 수도 있는 경우를 함께 설명하세요.

저장되는 artifact:

- `problem4`

저장되는 measure:

- `problem4_confidence`

### 13.9 문제별 저장 payload

각 문제 답변 artifact에는 다음이 저장된다.

- `answer`
- `prompt`
- `questionNumber`
- `title`
- `topic`

각 문제 제출 event에는 다음이 저장된다.

- `answerLength`
- `questionNumber`
- `title`
- `topic`

각 확신도 measure에는 다음이 저장된다.

- `confidence`
- `questionNumber`
- `title`
- `topic`

각 확신도 제출 event에는 다음이 저장된다.

- `confidence`
- `questionNumber`
- `title`
- `topic`

### 13.10 활동 돌아보기

학생은 1~5 척도로 다음 문항에 응답한다.

- 활동 전에는 내가 더 잘 이해했다고 생각했다.
- 직접 설명하려니 생각보다 어려웠다.
- AI와 대화할 때는 알 것 같았지만 직접 표현하려니 부족한 부분이 있었다.
- 내가 생각한 것보다 실제 수행이 어려웠다.
- 다시 AI와 대화할 수 있다면 더 질문하고 싶은 부분이 있다.

저장되는 데이터:

- measure `reflection_self_report`
- event `reflection_submitted`

### 13.11 대화 다시 보기

학생은 처음 AI와 나눈 대화를 읽기 전용으로 다시 본다.

`마무리 생각 쓰기`를 누르면 다음이 저장된다.

- event `calibration_chat_review_submitted`
- 전체 대화 턴 수
- topic

### 13.12 마무리 생각

학생은 마무리 생각을 쓴다.

저장되는 데이터:

- artifact `final_reflection`
- event `reflection_submitted`
- event `calibration_study_completed`
- 세션 `status: submitted`
- 세션 `completedAt`
- 현재 단계 `completed`

### 13.13 완료 화면

완료 후에는 활동 완료 화면이 표시된다.

## 14. Understanding Calibration AI

### 14.1 API 경로

Understanding Calibration AI는 다음 API를 사용한다.

- `POST /api/calibration/chat`

### 14.2 시스템 프롬프트 분기

Gemini 호출부에는 `researchCondition`에 따라 시스템 프롬프트를 고르는 구조가 있다.

현재 실제 사용되는 프롬프트는 `single_group_baseline` 하나다.

### 14.3 `single_group_baseline` 의미

이 조건의 의미는 다음과 같다.

- 학생이 읽기 자료를 이해하도록 돕는 기본 독해 보조 AI

### 14.4 baseline 프롬프트 핵심

baseline AI의 핵심 원칙은 다음과 같다.

- 지문과 보조자료를 우선 활용한다.
- 학생 질문에 자연스럽고 친절하게 답한다.
- 쉬운 설명, 예시, 비유, 요약, 글 형태 정리를 제공할 수 있다.
- 이후 활동이나 평가가 있다는 사실을 암시하지 않는다.
- 학생에게 이해 수준을 판단해주지 않는다.
- 과도한 칭찬이나 아첨을 하지 않는다.
- 기본 답변은 3~6문장으로 간결하게 한다.
- 더 자세한 설명 요청 시 더 길게 설명할 수 있다.
- 지문과 무관한 질문은 짧게 제한하고 자료 관련 질문으로 돌린다.
- 확실하지 않은 내용은 확실하지 않다고 말한다.

### 14.5 request tags

학생 질문은 규칙 기반으로 request tag가 붙는다.

현재 tag는 다음과 같다.

- `definition_request`
- `easy_explanation_request`
- `example_request`
- `analogy_request`
- `summary_request`
- `generated_explanation_request`
- `clarification_request`
- `limitation_request`
- `why_how_request`
- `verification_request`
- `off_topic`
- `other`

request tag는 분석용 메타데이터이며 라벨이나 점수가 아니다.

### 14.6 mock 응답

`READING_COACH_AI_MODE=mock`이면 Gemini를 호출하지 않고 로컬 함수가 답한다.

mock 응답도 request tag를 계산하고 다음을 반환한다.

- `llmMode: mock`
- `model: mock-understanding-calibration-v0`
- `type: clarify`
- `text`
- `requestTags`

### 14.7 real 응답

mock이 아니면 Gemini를 호출한다.

설정:

- `temperature: 0.35`
- `maxOutputTokens: 512`
- `systemInstruction`: condition별 시스템 프롬프트
- `contents`: 이전 대화 history와 현재 질문 컨텍스트

## 15. 교사 학생 현황 화면

`/review`는 교사가 학생 결과를 확인하는 화면이다.

### 15.1 과제 선택

여러 과제가 있을 때 교사는 왼쪽 패널의 `과제 선택` 드롭다운으로 기준 과제를 바꿀 수 있다.

과제를 바꾸면 다음이 모두 해당 과제 기준으로 다시 계산된다.

- 학생 목록
- 시작 전/진행 중/제출 완료 수
- 검토 상태 수
- 선택 학생의 과정 기록

과제에 반이 배정되어 있으면 해당 반 학생만 표시된다.

과제에 반이 없으면 전체 학생이 표시된다.

### 15.2 학생 검색

학생 검색은 다음 기준으로 작동한다.

- 학생 이름
- 참여자 코드
- 학생 번호

### 15.3 진행 상태 필터

진행 상태 필터는 다음과 같다.

- 전체
- 시작 전
- 진행 중
- 제출 완료

진행 상태 계산 기준:

- 세션 없음: 시작 전
- 세션 있음, 제출 전: 진행 중
- 최종 제출 또는 세션 status가 submitted/completed: 제출 완료

### 15.4 교사 검토 상태 필터

교사 검토 상태 필터는 다음과 같다.

- 검토 전체
- 검토 전
- 추가 확인 필요
- 검토 완료

### 15.5 학생 행 표시

각 학생 행에는 다음이 표시된다.

- 학생 이름
- 학생 번호
- 참여자 코드
- 진행 상태
- 교사 검토 상태
- 과정 보기 버튼

### 15.6 세션이 없는 학생

선택한 학생이 해당 과제를 시작하지 않았으면 빈 기록 화면이 표시된다.

표시 정보:

- 학생 이름
- 번호
- 참여자 코드
- 상태
- 과제를 시작하면 자동으로 모이는 항목 안내

### 15.7 공통 과정 기록 헤더

세션이 있는 학생의 과정 기록에는 다음이 표시된다.

- 학생 과정 기록
- 학생 이름 또는 익명 ID
- 현재 단계
- AI 모드/모델
- 주요 메트릭
- 과정 점검 요약
- 교사 검토

### 15.8 글쓰기 코치 과정 기록

글쓰기 코치 세션에서는 다음 요약이 표시된다.

- 주장
- 근거
- 출처
- 수정 확인
- 반론
- 제출

메트릭은 다음과 같다.

- 대화 턴 수
- 생각 정리 여부
- 초안 저장 수
- 붙여넣기 횟수
- 피드백 생성 횟수
- 이벤트 수

세부 기록은 다음과 같다.

- 라벨링 신호
- 최종 글
- 대화 기록
- 생각 정리 기록
- 초안 기록
- 붙여넣기 기록

### 15.9 라벨링 신호

글쓰기 코치 세션에서는 최근 주요 행동을 라벨링 신호로 보여준다.

포함 신호:

- 출처 메모
- 개요 점검
- 제안 보기
- 수정 확인
- 해결 표시
- 붙여넣기
- 최종 제출

출처 메모는 같은 내용이 반복되면 횟수로 압축된다.

표시되는 신호는 최근 8개다.

### 15.10 Understanding Calibration 과정 기록

이해 연구 세션에서는 다음 요약이 표시된다.

- 문제 응답
- 확신도
- AI 대화
- 회고
- 제출

메트릭은 다음과 같다.

- 대화 턴 수
- 문제 응답 개수
- 확신도 개수
- 이벤트 수

세부 기록은 다음과 같다.

- 문제별 응답
- 확인 문항 응답
- AI 대화 기록
- 마무리 생각

문제별 응답에는 다음이 표시된다.

- 문제 번호
- 문제 제목
- 확신도
- 문제 프롬프트
- 학생 답변

확인 문항 응답에는 다음이 표시된다.

- 시작 전 확인
- 수행 예측
- 활동 돌아보기

### 15.11 채팅 기록 스크롤

교사 현황의 채팅 기록은 화면에 무한히 펼쳐지지 않고 내부 스크롤로 표시된다.

적용 대상:

- 글쓰기 코치의 대화 기록
- Understanding Calibration의 AI 대화 기록

### 15.12 교사 검토

교사는 각 세션에 검토 상태와 메모를 저장할 수 있다.

검토 상태:

- 검토 전
- 추가 확인 필요
- 검토 완료

저장 시 다음이 남는다.

- `session.teacherReview.status`
- `session.teacherReview.note`
- `session.teacherReview.updatedAt`
- `session.teacherReview.updatedByTeacherId`
- event `teacher_review_updated`

## 16. 연구 로그와 내보내기

`/export` 화면은 현재 상태를 연구 데이터로 고정하는 화면이다.

### 16.1 화면 표시

표시 정보:

- 파일 저장 상태
- 라벨링 데이터 행 수
- 연구 이벤트 수
- 산출물/측정값 행 수
- 라벨링 행 미리보기
- JSON 미리보기

### 16.2 다운로드 파일

제공되는 다운로드는 다음과 같다.

- `reading-coach-pilot-dataset.json`
- `reading-coach-labeling-rows.csv`
- `research-events.csv`
- `research-artifacts-measures.csv`
- `pilot-dataset.schema.json`
- `labeling-codebook.md`
- `data-dictionary.md`

### 16.3 JSON 데이터셋

JSON export에는 다음이 포함된다.

- `schemaVersion`
- 교사 계정
- 교사 계정 목록
- 학생 계정 목록
- 반 목록
- 과제 목록
- 세션 목록
- 선택된 역할
- 활성 과제 ID
- 활성 세션 ID
- 앱 metadata
- export metadata

export metadata에는 다음이 포함된다.

- schema ID
- codebook ID
- generatedAt
- fileSync 상태

### 16.4 비밀번호 export 정책

내부 상태에는 교사/학생 비밀번호가 있다.

하지만 JSON export에서는 다음 계정 정보가 public 형태로 변환된다.

교사:

- id
- displayName
- loginId

학생:

- id
- displayName
- classGroupId
- studentNumber
- loginId
- participantCode

비밀번호는 export JSON에서 제외된다.

### 16.5 라벨링 CSV

`reading-coach-labeling-rows.csv`는 세션의 이벤트를 라벨링 행으로 펼친다.

열은 다음과 같다.

- `sessionId`
- `studentAnonymousId`
- `assignmentId`
- `researchMode`
- `researchCondition`
- `turnOrEventId`
- `timestamp`
- `stage`
- `speaker`
- `criticalThinkingLabel`
- `offloadingLabel`
- `sycophancyLabel`
- `evidenceText`
- `raterNotes`

초기 라벨 값은 모두 `none`이다.

### 16.6 연구 이벤트 CSV

`research-events.csv`는 이벤트 원자료를 분석용으로 펼친다.

열은 다음과 같다.

- `sessionId`
- `studentAnonymousId`
- `assignmentId`
- `researchMode`
- `researchCondition`
- `eventId`
- `eventType`
- `timestamp`
- `stage`
- `speaker`
- `userMessage`
- `assistantMessage`
- `requestTags`
- `aiMode`
- `model`
- `payloadJson`

### 16.7 산출물·측정값 CSV

`research-artifacts-measures.csv`는 `artifacts`와 `measures`를 함께 펼친다.

열은 다음과 같다.

- `sessionId`
- `studentAnonymousId`
- `assignmentId`
- `researchMode`
- `researchCondition`
- `recordGroup`
- `recordId`
- `recordKind`
- `timestamp`
- `stage`
- `payloadJson`

### 16.8 스키마와 코드북

정적 artifact로 다음 파일이 제공된다.

- `public/artifacts/pilot-dataset.schema.json`
- `public/artifacts/labeling-codebook.md`
- `public/artifacts/data-dictionary.md`
- `public/artifacts/coach-policy.md`

export 화면에서 schema, codebook, data dictionary를 내려받을 수 있다.

## 17. 세션 데이터 구조

각 학생 활동은 `PilotSession`으로 저장된다.

### 17.1 공통 세션 필드

세션에는 다음이 있다.

- `sessionId`
- `assignment`
- `researchMode`
- `researchCondition`
- `status`
- `student`
- `currentStage`
- `events`
- `chatTurns`
- `outlineSnapshots`
- `draftSnapshots`
- `pasteEvents`
- `artifacts`
- `measures`
- `modules`
- `finalSubmission`
- `teacherReview`
- `createdAt`
- `updatedAt`
- `completedAt`
- `metadata`

### 17.2 학생 식별

학생 세션에는 다음이 저장된다.

- `anonymousId`
- `accountId`
- `displayName`

계정 없이 만든 임시 세션이면 `anonymousId`만 존재할 수 있다.

### 17.3 LLM metadata

세션 metadata에는 다음이 있다.

- `appVersion`
- `llmMode`
- `model`
- `createdAt`

AI 응답 후에는 세션 metadata의 `llmMode`와 `model`이 갱신될 수 있다.

## 18. 이벤트 타입

### 18.1 글쓰기 코치 이벤트

현재 글쓰기 코치 이벤트 타입은 다음과 같다.

- `stage_entered`
- `stage_completed`
- `student_message`
- `assistant_message`
- `outline_edited`
- `claim_revised`
- `evidence_added`
- `source_added`
- `counterargument_added`
- `draft_edited`
- `paste_detected`
- `outline_warning_shown`
- `feedback_generated`
- `feedback_viewed`
- `suggestion_checked`
- `suggestion_resolved`
- `submission_created`
- `teacher_review_updated`

### 18.2 Understanding Calibration 이벤트

현재 이해 연구 이벤트 타입은 다음과 같다.

- `calibration_pre_survey_submitted`
- `calibration_reading_started`
- `calibration_reading_completed`
- `calibration_chat_started`
- `calibration_chat_turn_created`
- `calibration_chat_completed`
- `calibration_prediction_survey_submitted`
- `calibration_chat_review_submitted`
- `calibration_study_completed`
- `question_started`
- `question_submitted`
- `confidence_submitted`
- `reflection_submitted`

## 19. 연구 라벨링 지원

현재 플랫폼은 라벨링을 자동 수행하지 않는다.

대신 라벨링을 위한 원자료와 빈 라벨 열을 제공한다.

### 19.1 라벨링 대상 축

코드북이 준비한 라벨링 축은 다음 세 가지다.

- 비판적 사고
- 인지 외주화
- 아첨

### 19.2 비판적 사고 라벨 후보

- `evidence_request`
- `source_verification`
- `counterargument_exploration`
- `alternative_comparison`
- `claim_revision`
- `uncertainty_acknowledgment`

### 19.3 인지 외주화 라벨 후보

- `answer_delegation`
- `judgment_delegation`
- `unreviewed_acceptance`
- `verification_avoidance`
- `counterargument_avoidance`
- `completion_priority`

### 19.4 아첨 라벨 후보

- `unsupported_agreement`
- `overpraise`
- `missed_correction`
- `balanced_challenge`

### 19.5 현재 자동화 수준

현재는 위 라벨을 자동으로 붙이지 않는다.

export CSV의 라벨 열은 초기값 `none`으로 제공된다.

## 20. 구현되어 있지 않은 것

아래 항목은 현재 구현 기능이 아니다.

- 운영용 사용자 인증
- 서버 DB 기반 계정 관리
- 여러 기기 동시 접속 세션 병합
- 학생별/과제별 물리 파일 분리 저장
- 자동 채점
- LLM Judge 기반 평가
- Calibration Gap 자동 계산
- Independent Performance 자동 점수화
- 연구 조건 무작위 배정
- 교사 화면에서 연구 조건 선택
- 학생 화면에서 연구 조건 노출
- 완전한 복사/붙여넣기 보안 차단
- `revision_feedback`만을 위한 별도 학생 UX
- 외부 웹 브라우저 검색 통합
- 참고문헌 자동 생성
- 실제 LMS 수준 출결/성적 관리
- 개인 정보 비식별화 자동 처리

## 21. 현재 기능 확인용 명령

프로젝트에서 사용 중인 확인 명령은 다음과 같다.

```bash
npm run build
npm test -- --run
npx playwright test --project=chromium
```

개발 서버 실행:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Playwright는 기본적으로 다음 명령으로 mock AI 모드에서 개발 서버를 실행한다.

```bash
READING_COACH_AI_MODE=mock npm run dev -- --host 127.0.0.1 --port 5173
```

## 22. 현재 구현의 핵심 요약

현재 플랫폼은 다음을 실제로 수행할 수 있다.

- 교사/학생 역할로 로그인한다.
- 반, 학생, 교사 계정을 만들고 삭제한다.
- 학생 계정을 일괄 생성한다.
- 글쓰기 코치 과제를 만들고 반에 배정한다.
- Understanding Calibration 연구 과제를 만들고 반에 배정한다.
- 학생은 자신에게 배정된 과제를 보고 시작한다.
- 학생은 글쓰기 코치 흐름에서 읽기, 개요, 초안, 고쳐쓰기, 제출을 수행한다.
- 학생은 글쓰기 과정 중 AI 코치와 대화한다.
- 학생은 AI 답변을 일반 복사하기 어렵게 되어 있다.
- 학생의 붙여넣기 시도는 기록된다.
- 학생은 Understanding Calibration 흐름에서 사전 확인, 읽기, AI 대화, 수행 예측, 네 문제 독립 답변, 문제별 확신도, 회고, 대화 다시 보기, 마무리 생각을 완료한다.
- 교사는 과제별로 학생 진행 현황을 선택해 본다.
- 교사는 학생별 과정 기록을 확인한다.
- 교사는 학생별 검토 상태와 메모를 저장한다.
- 시스템은 이벤트, 대화, 개요, 초안, 붙여넣기, 최종 제출, 연구 artifacts, 연구 measures를 저장한다.
- export 화면에서 JSON과 여러 CSV를 내려받는다.
- 연구 조건 `single_group_baseline`이 export에 포함된다.
- 스키마, 코드북, 데이터 딕셔너리를 다운로드할 수 있다.
