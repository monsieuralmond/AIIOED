# Vercel + Supabase 배포 구조

이 문서는 현재 플랫폼을 20~30명 학생이 동시에 접속하는 파일럿 환경으로 배포할 때 필요한 구조를 정리한다.

## 저장 원칙

- 연구 원자료의 기준 저장소는 Supabase Postgres이다.
- `localStorage`에는 브라우저 재접속용 식별자만 저장한다.
  - `sessionId`
  - `studentAnonymousId`
  - `assignmentId`
  - `classGroupId`
- `chatTurns`, `events`, `artifacts`, `measures`, 설문 응답, 문제 답안은 `localStorage`에 저장하지 않는다.
- 서버나 전역 상태에 단일 `activeSessionId`를 두지 않는다. 서버 저장과 조회는 항상 `sessionId`를 기준으로 한다.

## 배포 구성

Frontend:

- React/Vite SPA를 Vercel에 배포한다.
- `vercel.json`은 `/api/*`를 Vercel Function으로 유지하고, 나머지 deep link는 `/index.html`로 rewrite한다.

Backend/API:

- `/api/session/start`
- `/api/session/update-stage`
- `/api/chat`
- `/api/event`
- `/api/artifact`
- `/api/measure`
- `/api/export`
- `/api/admin/delete-test-data`
- `/api/admin/upsert-roster`

`/api/admin/upsert-roster`는 교사가 만든 반, 과제, 학생 participant code를 Supabase에 반영하기 위한 지원 API이다.

## 환경 변수

Vercel Project Settings에 다음 값을 서버 환경 변수로 등록한다.

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SERVER_AUTH_SECRET=replace-with-a-long-random-server-secret
GEMINI_API_KEY=your-server-only-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-lite
ADMIN_ID=admin-root
ADMIN_LOGIN_ID=admin
ADMIN_PASSWORD=replace-with-admin-password
MAX_CHAT_TURNS=20
```

`SUPABASE_SERVICE_ROLE_KEY`와 `GEMINI_API_KEY`는 브라우저 코드에 노출하지 않는다.

## Supabase 준비

1. Supabase 프로젝트를 만든다.
2. `supabase/migrations/001_research_platform.sql`부터 최신 번호까지 순서대로 적용한다.
   - 현재 최신 필수 migration은 `007_remove_plaintext_roster_passwords.sql`이다.
   - `007`은 학생·교사 평문 초기 비밀번호 컬럼을 제거하고 `research_schema_health()` 검증 RPC를 추가한다.
3. 생성되는 주요 테이블은 다음과 같다.
   - `classes`
   - `assignments`
   - `students`
   - `sessions`
   - `chat_turns`
   - `events`
   - `artifacts`
   - `measures`
   - `exports`
   - `deletion_logs`
4. 모든 하위 원자료 테이블은 `session_id`, `class_group_id`, `assignment_id`, `student_anonymous_id`, `created_at`, `stage`를 포함한다.
5. RLS는 migration에서 활성화되어 있다. 서버 API는 service role key로 DB에 접근하고, 해당 키는 Vercel Function에서만 사용한다.
6. 배포 전 `npm run verify:worktree`를 실행해 커밋·배포에 포함할 변경만 남아 있는지 확인한다.
7. 배포 후 `npm run verify:deployment`를 실행해 `research_schema_health`, 평문 비밀번호 컬럼 제거, roster mutation RPC, 삭제 RPC가 모두 적용되었는지 확인한다.

## 학생 접속 흐름

1. 교사가 반, 과제, 학생 participant code를 만든다.
2. 교사 화면이 `/api/admin/upsert-roster`로 roster를 DB에 반영한다.
3. 학생은 join 화면에서 participant code를 입력한다.
4. `/api/session/start`가 participant code를 해시로 비교한다.
5. 서버는 원문 participant code를 export에 포함하지 않고 `studentAnonymousId`와 새 `sessionId`를 반환한다.
6. 브라우저 새로고침 시 `/api/session/start`에 `sessionId`를 보내 기존 세션을 다시 불러온다.

## AI 채팅 저장 순서

`/api/chat`은 다음 순서를 따른다.

1. `requestId` 중복 여부 확인
2. 학생 메시지 저장
3. Gemini API 또는 mock mode 호출
4. assistant 응답 저장
5. 응답 반환

같은 `sessionId`와 `requestId`가 다시 들어오면 이미 저장된 assistant 응답을 반환한다.

## Export

교사 export 화면의 DB export는 기본값으로 다음을 사용한다.

- `completedOnly=true`
- `anonymized=true`

다운로드 파일:

- `session-wide.csv`
- `item-long.csv`
- `events.csv`
- `chat-turns.csv`
- `artifacts.csv`
- `measures.csv`
- `raw-json.json`

export에는 `researchCondition`이 포함되며, participant code 원문은 포함하지 않는다.

## 삭제와 초기화

`/api/admin/delete-test-data`는 삭제 전 JSON export 묶음을 만들고, 삭제 후 `deletion_logs`에 기록을 남긴다.

지원 범위:

- 현재 세션 초기화
- 특정 학생 데이터 삭제
- 특정 과제 파일럿 데이터 삭제
- 전체 테스트 데이터 초기화

`research_locked=true`인 세션은 일반 삭제 API에서 삭제하지 않는다.
