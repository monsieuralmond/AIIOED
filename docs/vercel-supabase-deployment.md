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

- `/api/auth/admin`
- `/api/auth/student`
- `/api/auth/teacher`
- `/api/session/start`
- `/api/session/reset`
- `/api/session/sync`
- `/api/session/update-stage`
- `/api/session/list`
- `/api/chat`
- `/api/chat-turn`
- `/api/event`
- `/api/artifact`
- `/api/measure`
- `/api/ai`
- `/api/export`
- `/api/admin/health`
- `/api/admin/roster`
- `/api/admin/delete-test-data`
- `/api/admin/upsert-roster`
- `/api/admin/upsert-roster-delta`

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
MAX_AI_REQUESTS_PER_MINUTE=120
MAX_JSON_BODY_BYTES=2000000
```

`SUPABASE_SERVICE_ROLE_KEY`와 `GEMINI_API_KEY`는 브라우저 코드에 노출하지 않는다.
학생 연구 세션의 AI 채팅과 글쓰기 코치 채팅은 시간, 총 턴 수, 분당 턴 수, 앱 내부 AI quota로 하드 차단하지 않는다. `MAX_AI_REQUESTS_PER_MINUTE`는 고쳐쓰기 점검처럼 채팅이 아닌 AI 보조 엔드포인트 보호용으로만 남긴다.

## Supabase 준비

1. Supabase 프로젝트를 만든다.
2. `supabase/migrations/001_research_platform.sql`부터 `014_fix_ai_request_quota_ambiguity.sql`까지 번호 순서대로 적용한다. Supabase CLI를 사용한다면 `supabase db push`를 실행하고, SQL Editor를 사용한다면 각 파일 내용을 번호 순서대로 실행한다. 특히 `009_session_uniqueness_and_lock.sql`은 명시적 transaction과 테이블 잠금을 사용하므로 파일 전체를 한 번에 붙여넣고 실행한다.
   - `008`은 세션 하위 자료의 원자적 동기화 RPC를 추가한다.
   - `009`는 기존 DB에 생긴 중복 연구 세션을 대표 세션 하나로 병합한 뒤, 병합 전 원자료 스냅샷을 `exports`와 `deletion_logs`에 남기고 학생·과제 조합의 세션 유일성 인덱스를 추가한다.
   - `010`은 제출 잠금과 하위 자료 저장을 같은 DB 잠금 경계에서 검사하고 `research_schema_health()` 버전을 갱신한다.
   - `011`은 Vercel 다중 인스턴스에서도 공유되는 AI 분당 요청 쿼터 RPC를 추가한다.
   - `012`는 privileged RPC의 공개 실행 권한을 회수하고, 제출 잠금과 충돌하지 않는 원자적 세션 리셋 RPC를 추가한다.
   - `013`은 교사가 제출 완료 세션을 리셋할 때 원자료 스냅샷을 `exports`와 `deletion_logs`에 먼저 저장한 뒤 세션과 하위 자료를 삭제하도록 리셋 RPC를 교체한다.
   - `014`는 AI quota RPC 내부의 `principal_kind` 이름 충돌을 제거한다.
   - 이전 버전의 `009`에서 `duplicate research sessions exist` 오류가 났다면 최신 `009_session_uniqueness_and_lock.sql` 전체를 다시 실행한다. 최신 `009`는 일반 중복 세션을 자동 병합하지만, 같은 학생과 같은 과제에 잠금/제출 세션이 둘 이상 있거나 잠금 세션으로 자식 원자료를 병합해야 하는 경우에는 멈춘다. 그 경우에는 먼저 원자료를 export하고 대표 세션을 수동으로 정해야 한다.
   - Supabase SQL Editor에서 최신 `009` 전체 실행 중 `Connection terminated due to connection timeout`이 나면 `supabase/manual/009_repair_duplicate_sessions_stepwise.sql`을 먼저 실행한다. 그다음 SQL Editor에서 `select public.repair_duplicate_research_sessions_once(1);`를 반복 실행해 `remainingDuplicateGroups`가 `0`이 될 때까지 중복 세션을 작은 단위로 병합한다. 함수는 SQL Editor 타임아웃을 피하기 위해 한 번에 최대 10개까지만 처리한다. `0`이 되면 `create unique index if not exists sessions_assignment_student_unique on public.sessions(assignment_id, student_anonymous_id);`를 실행한 뒤 `010`부터 계속 적용한다.
   - stepwise repair 실행 중 `duplicate research sessions include multiple locked/submitted rows`가 나오면 자동 병합하면 안 되는 제출/완료 세션이 둘 이상 있다는 뜻이다. 같은 SQL 파일에 포함된 `select * from public.list_duplicate_research_session_choices();`로 충돌 세션 목록을 확인한 뒤, 남길 세션 하나를 정하고 `select public.choose_duplicate_research_session_canonical('남길_session_id', array['제외할_session_id']);`를 실행한다. 제외된 세션은 삭제 전에 `exports`와 `deletion_logs`에 원자료 스냅샷이 저장된다. 그다음 다시 `select public.repair_duplicate_research_sessions_once(1);`를 반복한다.
   - 수업 직전이라 유니크 인덱스 생성이 계속 막히면 응급 절차로 `select * from public.list_all_duplicate_research_session_choices();`를 먼저 확인한 뒤 `select public.emergency_archive_duplicate_research_sessions_for_unique_index(20);`를 실행한다. 이 함수는 각 중복 그룹에서 제출/완료/최신 세션 하나만 남기고 나머지 세션을 `exports`와 `deletion_logs`에 원자료 스냅샷으로 저장한 뒤 운영 테이블에서 제외한다. 결과의 `remainingDuplicateGroups`가 `0`이면 `create unique index if not exists sessions_assignment_student_unique on public.sessions(assignment_id, student_anonymous_id);`를 실행한다. 이 경로는 정교한 연구 데이터 병합보다 수업 중 저장 안정성을 우선하는 비상용이다.
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
7. 배포 후 `npm run verify:deployment`를 실행해 `research_schema_health`, 세션 동기화 RPC, 세션 유일성 인덱스, AI 쿼터 RPC, 평문 비밀번호 컬럼 제거, roster mutation RPC, 삭제 RPC, 리셋 전 백업 RPC가 모두 적용되었는지 확인한다.

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
- `raw-events.csv`
- `benchmark.jsonl`
- `data-quality.csv`
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
