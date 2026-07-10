/* @vitest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration009 = readFileSync(join(process.cwd(), "supabase", "migrations", "009_session_uniqueness_and_lock.sql"), "utf8");
const stepwiseRepairSql = readFileSync(join(process.cwd(), "supabase", "manual", "009_repair_duplicate_sessions_stepwise.sql"), "utf8");

const baseSchema = `
create role anon;
create role authenticated;

create table public.classes (
  id text primary key,
  name text not null,
  teacher_id text not null
);

create table public.assignments (
  id text primary key,
  class_group_id text not null references public.classes(id) on delete cascade,
  created_by_teacher_id text not null,
  title text not null,
  research_mode text not null,
  research_condition text not null,
  assignment jsonb not null,
  research_locked boolean not null default false
);

create table public.students (
  id text primary key,
  class_group_id text not null references public.classes(id) on delete cascade,
  student_anonymous_id text not null unique,
  participant_code_hash text not null unique
);

create table public.sessions (
  session_id text primary key,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  current_stage text not null,
  status text not null,
  research_mode text not null,
  research_condition text not null,
  assignment_snapshot jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  research_locked boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz
);

create table public.chat_turns (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null,
  stage text not null,
  role text not null check (role in ('student', 'assistant')),
  text text not null,
  response_type text,
  request_id text
);

create unique index chat_turns_request_role_unique
  on public.chat_turns(session_id, request_id, role);

create table public.events (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null,
  stage text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb
);

create table public.artifacts (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null,
  stage text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz
);

create table public.measures (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null,
  stage text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb
);

create sequence public.exports_id_seq;
create table public.exports (
  id text primary key default ('export-' || nextval('public.exports_id_seq')::text),
  class_group_id text,
  assignment_id text,
  generated_by_teacher_id text,
  created_at timestamptz not null default now(),
  export_kind text not null,
  anonymized boolean not null default true,
  completed_only boolean not null default true,
  payload jsonb not null
);

create sequence public.deletion_logs_id_seq;
create table public.deletion_logs (
  id text primary key default ('deletion-' || nextval('public.deletion_logs_id_seq')::text),
  class_group_id text,
  assignment_id text,
  session_id text,
  student_anonymous_id text,
  created_at timestamptz not null default now(),
  deleted_by text,
  deletion_scope text not null,
  exported_before_delete boolean not null default false,
  counts jsonb not null default '{}'::jsonb,
  reason text
);
`;

async function withDatabase<T>(run: (db: PGlite) => Promise<T>): Promise<T> {
  const db = new PGlite();
  try {
    await db.exec(baseSchema);
    return await run(db);
  } finally {
    await db.close();
  }
}

async function seedRoster(db: PGlite): Promise<void> {
  await db.exec(`
    insert into public.classes (id, name, teacher_id)
    values ('class-old', 'Old', 'teacher-1'), ('class-keep', 'Keep', 'teacher-1');
    insert into public.assignments (id, class_group_id, created_by_teacher_id, title, research_mode, research_condition, assignment)
    values ('assignment-1', 'class-keep', 'teacher-1', 'A', 'understanding_calibration', 'single_group_baseline', '{}'::jsonb);
    insert into public.students (id, class_group_id, student_anonymous_id, participant_code_hash)
    values ('student-1', 'class-keep', 'student-anon-1', 'hash-1');
  `);
}

async function seedSession(
  db: PGlite,
  sessionId: string,
  classGroupId: string,
  updatedAt: string,
  status = "in_progress",
  locked = false,
  completedAt: string | null = null
): Promise<void> {
  await db.query(
    `
    insert into public.sessions (
      session_id, class_group_id, assignment_id, student_anonymous_id,
      current_stage, status, research_mode, research_condition,
      assignment_snapshot, metadata, research_locked, created_at, updated_at, completed_at
    )
    values ($1, $2, 'assignment-1', 'student-anon-1',
      'ai_chat', $3, 'understanding_calibration', 'single_group_baseline',
      '{}'::jsonb, '{}'::jsonb, $4, '2026-07-01T00:00:00Z', $5, $6
    );
    `,
    [sessionId, classGroupId, status, locked, updatedAt, completedAt]
  );
}

describe("migration 009 duplicate session repair", () => {
  it("repairs duplicate sessions in small SQL Editor batches before creating the unique index", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-old-a", "class-old", "2026-07-01T00:00:00Z");
      await seedSession(db, "session-old-b", "class-old", "2026-07-01T00:30:00Z");
      await seedSession(db, "session-keep", "class-keep", "2026-07-02T00:00:00Z");
      await db.exec(`
        insert into public.chat_turns (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, role, text, request_id)
        values
          ('chat-keep', 'session-keep', 'class-keep', 'assignment-1', 'student-anon-1', '2026-07-02T00:01:00Z', 'ai_chat', 'student', 'keep question', 'request-1'),
          ('chat-old-a', 'session-old-a', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:01:00Z', 'ai_chat', 'student', 'old a question', 'request-1'),
          ('chat-old-b', 'session-old-b', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:31:00Z', 'ai_chat', 'student', 'old b question', 'request-2');
        insert into public.events (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, type, payload)
        values ('event-old-b', 'session-old-b', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:32:00Z', 'ai_chat', 'question_started', '{"from":"old-b"}'::jsonb);
        insert into public.artifacts (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
        values ('artifact-old-b', 'session-old-b', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:33:00Z', 'problem1', 'problem1', '{"answer":"old-b"}'::jsonb);
        insert into public.measures (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
        values ('measure-old-b', 'session-old-b', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:34:00Z', 'problem1_confidence', 'problem1_confidence', '{"confidence":4}'::jsonb);
      `);

      await db.exec(stepwiseRepairSql);

      const firstBatch = await db.query<{ readonly result: { readonly repairedOldSessions: number; readonly remainingDuplicateGroups: number } }>(
        "select public.repair_duplicate_research_sessions_once(1) as result;"
      );
      expect(firstBatch.rows[0]?.result).toEqual({
        remainingDuplicateGroups: 1,
        repairedOldSessions: 1
      });

      const secondBatch = await db.query<{ readonly result: { readonly repairedOldSessions: number; readonly remainingDuplicateGroups: number } }>(
        "select public.repair_duplicate_research_sessions_once(1) as result;"
      );
      expect(secondBatch.rows[0]?.result).toEqual({
        remainingDuplicateGroups: 0,
        repairedOldSessions: 1
      });

      await db.exec("create unique index if not exists sessions_assignment_student_unique on public.sessions(assignment_id, student_anonymous_id);");

      const sessionCount = await db.query<{ readonly count: number }>("select count(*)::int as count from public.sessions;");
      expect(sessionCount.rows[0]?.count).toBe(1);

      const movedTurns = await db.query<{ readonly class_group_id: string; readonly request_id: string | null; readonly session_id: string }>(`
        select session_id, class_group_id, request_id
        from public.chat_turns
        where id in ('chat-old-a', 'chat-old-b')
        order by id;
      `);
      expect(movedTurns.rows).toEqual([
        {
          class_group_id: "class-keep",
          request_id: "request-1:merged-from:session-old-a:chat-old-a",
          session_id: "session-keep"
        },
        {
          class_group_id: "class-keep",
          request_id: "request-2",
          session_id: "session-keep"
        }
      ]);

      const movedChildRows = await db.query<{ readonly count: number }>(`
        select count(*)::int as count
        from (
          select session_id, class_group_id from public.events where id = 'event-old-b'
          union all select session_id, class_group_id from public.artifacts where id = 'artifact-old-b'
          union all select session_id, class_group_id from public.measures where id = 'measure-old-b'
        ) rows
        where session_id = 'session-keep' and class_group_id = 'class-keep';
      `);
      expect(movedChildRows.rows[0]?.count).toBe(3);

      const auditCount = await db.query<{ readonly count: number }>(`
        select count(*)::int as count
        from public.deletion_logs
        where deletion_scope = 'duplicate_session_merge';
      `);
      expect(auditCount.rows[0]?.count).toBe(2);

      const auditSnapshots = await db.query<{
        readonly artifact_count: number;
        readonly artifact_answer: string | null;
        readonly chat_text: string | null;
        readonly event_from: string | null;
        readonly measure_confidence: string | null;
        readonly measure_count: number;
        readonly raw_session_id: string | null;
        readonly rewrite_count: number;
      }>(`
        select
          counts #>> '{rawSnapshot,session,session_id}' as raw_session_id,
          counts #>> '{rawSnapshot,chatTurns,0,text}' as chat_text,
          counts #>> '{rawSnapshot,events,0,payload,from}' as event_from,
          counts #>> '{rawSnapshot,artifacts,0,payload,answer}' as artifact_answer,
          counts #>> '{rawSnapshot,measures,0,payload,confidence}' as measure_confidence,
          jsonb_array_length(counts #> '{rawSnapshot,artifacts}') as artifact_count,
          jsonb_array_length(counts #> '{rawSnapshot,measures}') as measure_count,
          jsonb_array_length(counts #> '{requestIdRewrites}') as rewrite_count
        from public.deletion_logs
        where deletion_scope = 'duplicate_session_merge'
        order by session_id;
      `);
      expect(auditSnapshots.rows).toEqual([
        {
          artifact_count: 0,
          artifact_answer: null,
          chat_text: "old a question",
          event_from: null,
          measure_confidence: null,
          measure_count: 0,
          raw_session_id: "session-old-a",
          rewrite_count: 1
        },
        {
          artifact_count: 1,
          artifact_answer: "old-b",
          chat_text: "old b question",
          event_from: "old-b",
          measure_confidence: "4",
          measure_count: 1,
          raw_session_id: "session-old-b",
          rewrite_count: 0
        }
      ]);

      const exportSnapshots = await db.query<{
        readonly artifact_count: number;
        readonly artifact_answer: string | null;
        readonly chat_text: string | null;
        readonly event_count: number;
        readonly event_from: string | null;
        readonly measure_confidence: string | null;
        readonly measure_count: number;
        readonly raw_session_id: string | null;
      }>(`
        select
          payload #>> '{rawSnapshot,session,session_id}' as raw_session_id,
          payload #>> '{rawSnapshot,chatTurns,0,text}' as chat_text,
          payload #>> '{rawSnapshot,events,0,payload,from}' as event_from,
          payload #>> '{rawSnapshot,artifacts,0,payload,answer}' as artifact_answer,
          payload #>> '{rawSnapshot,measures,0,payload,confidence}' as measure_confidence,
          jsonb_array_length(payload #> '{rawSnapshot,events}') as event_count,
          jsonb_array_length(payload #> '{rawSnapshot,artifacts}') as artifact_count,
          jsonb_array_length(payload #> '{rawSnapshot,measures}') as measure_count
        from public.exports
        where export_kind = 'duplicate_session_pre_uniqueness_stepwise_repair'
        order by payload #>> '{rawSnapshot,session,session_id}';
      `);
      expect(exportSnapshots.rows).toEqual([
        {
          artifact_count: 0,
          artifact_answer: null,
          chat_text: "old a question",
          event_count: 0,
          event_from: null,
          measure_confidence: null,
          measure_count: 0,
          raw_session_id: "session-old-a"
        },
        {
          artifact_count: 1,
          artifact_answer: "old-b",
          chat_text: "old b question",
          event_count: 1,
          event_from: "old-b",
          measure_confidence: "4",
          measure_count: 1,
          raw_session_id: "session-old-b"
        }
      ]);

      const indexRows = await db.query<{ readonly count: number }>(`
        select count(*)::int as count
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'sessions_assignment_student_unique';
      `);
      expect(indexRows.rows[0]?.count).toBe(1);
    });
  });

  it("keeps the stepwise repair bounded and inaccessible to public callers", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-old-a", "class-old", "2026-07-01T00:00:00Z");
      await seedSession(db, "session-old-b", "class-old", "2026-07-01T00:30:00Z");
      await seedSession(db, "session-keep", "class-keep", "2026-07-02T00:00:00Z");
      await db.exec(stepwiseRepairSql);

      await expect(db.query("select public.repair_duplicate_research_sessions_once(null);")).rejects.toThrow(/batch_limit must be at least 1/);
      await expect(db.query("select public.repair_duplicate_research_sessions_once(11);")).rejects.toThrow(/batch_limit must be 10 or less/);

      const privileges = await db.query<{
        readonly anon_choose_execute: boolean;
        readonly anon_list_execute: boolean;
        readonly anon_repair_execute: boolean;
        readonly authenticated_choose_execute: boolean;
        readonly authenticated_list_execute: boolean;
        readonly authenticated_repair_execute: boolean;
        readonly public_choose_execute: boolean;
        readonly public_list_execute: boolean;
        readonly public_repair_execute: boolean;
      }>(`
        select
          has_function_privilege('public', 'public.repair_duplicate_research_sessions_once(integer)', 'execute') as public_repair_execute,
          has_function_privilege('anon', 'public.repair_duplicate_research_sessions_once(integer)', 'execute') as anon_repair_execute,
          has_function_privilege('authenticated', 'public.repair_duplicate_research_sessions_once(integer)', 'execute') as authenticated_repair_execute,
          has_function_privilege('public', 'public.list_duplicate_research_session_choices()', 'execute') as public_list_execute,
          has_function_privilege('anon', 'public.list_duplicate_research_session_choices()', 'execute') as anon_list_execute,
          has_function_privilege('authenticated', 'public.list_duplicate_research_session_choices()', 'execute') as authenticated_list_execute,
          has_function_privilege('public', 'public.list_all_duplicate_research_session_choices()', 'execute') as public_list_all_execute,
          has_function_privilege('anon', 'public.list_all_duplicate_research_session_choices()', 'execute') as anon_list_all_execute,
          has_function_privilege('authenticated', 'public.list_all_duplicate_research_session_choices()', 'execute') as authenticated_list_all_execute,
          has_function_privilege('public', 'public.choose_duplicate_research_session_canonical(text, text[])', 'execute') as public_choose_execute,
          has_function_privilege('anon', 'public.choose_duplicate_research_session_canonical(text, text[])', 'execute') as anon_choose_execute,
          has_function_privilege('authenticated', 'public.choose_duplicate_research_session_canonical(text, text[])', 'execute') as authenticated_choose_execute,
          has_function_privilege('public', 'public.emergency_archive_duplicate_research_sessions_for_unique_index(integer)', 'execute') as public_emergency_execute,
          has_function_privilege('anon', 'public.emergency_archive_duplicate_research_sessions_for_unique_index(integer)', 'execute') as anon_emergency_execute,
          has_function_privilege('authenticated', 'public.emergency_archive_duplicate_research_sessions_for_unique_index(integer)', 'execute') as authenticated_emergency_execute;
      `);
      expect(privileges.rows[0]).toEqual({
        anon_choose_execute: false,
        anon_emergency_execute: false,
        anon_list_all_execute: false,
        anon_list_execute: false,
        anon_repair_execute: false,
        authenticated_choose_execute: false,
        authenticated_emergency_execute: false,
        authenticated_list_all_execute: false,
        authenticated_list_execute: false,
        authenticated_repair_execute: false,
        public_choose_execute: false,
        public_emergency_execute: false,
        public_list_all_execute: false,
        public_list_execute: false,
        public_repair_execute: false
      });
    });
  });

  it("archives a manually rejected locked duplicate session before continuing stepwise repair", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-submitted-a", "class-old", "2026-07-01T00:00:00Z", "submitted");
      await seedSession(db, "session-submitted-b", "class-keep", "2026-07-02T00:00:00Z", "completed", true, "2026-07-02T00:30:00Z");
      await db.exec(`
        insert into public.chat_turns (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, role, text, request_id)
        values
          ('chat-submitted-a', 'session-submitted-a', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:01:00Z', 'ai_chat', 'student', 'submitted a question', 'request-a'),
          ('chat-submitted-b', 'session-submitted-b', 'class-keep', 'assignment-1', 'student-anon-1', '2026-07-02T00:01:00Z', 'ai_chat', 'student', 'submitted b question', 'request-b');
        insert into public.artifacts (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
        values ('artifact-submitted-a', 'session-submitted-a', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:02:00Z', 'problem1', 'problem1', '{"answer":"submitted-a"}'::jsonb);
      `);
      await db.exec(stepwiseRepairSql);

      const choices = await db.query<{ readonly session_id: string; readonly suggested_keep: boolean }>(`
        select session_id, suggested_keep
        from public.list_duplicate_research_session_choices()
        order by suggested_keep desc, session_id;
      `);
      expect(choices.rows).toEqual([
        { session_id: "session-submitted-b", suggested_keep: true },
        { session_id: "session-submitted-a", suggested_keep: false }
      ]);

      const manualChoice = await db.query<{
        readonly result: {
          readonly canonicalSessionId: string;
          readonly rejectedSessionCount: number;
          readonly remainingDuplicateGroups: number;
        };
      }>(`
        select public.choose_duplicate_research_session_canonical(
          'session-submitted-b',
          array['session-submitted-a']
        ) as result;
      `);
      expect(manualChoice.rows[0]?.result).toMatchObject({
        canonicalSessionId: "session-submitted-b",
        rejectedSessionCount: 1,
        remainingDuplicateGroups: 0
      });

      await db.exec("create unique index if not exists sessions_assignment_student_unique on public.sessions(assignment_id, student_anonymous_id);");

      const sessionRows = await db.query<{ readonly session_id: string }>("select session_id from public.sessions;");
      expect(sessionRows.rows).toEqual([{ session_id: "session-submitted-b" }]);

      const rejectedChildren = await db.query<{ readonly count: number }>(`
        select count(*)::int as count
        from (
          select session_id from public.chat_turns where session_id = 'session-submitted-a'
          union all select session_id from public.artifacts where session_id = 'session-submitted-a'
        ) rows;
      `);
      expect(rejectedChildren.rows[0]?.count).toBe(0);

      const auditRows = await db.query<{
        readonly raw_answer: string | null;
        readonly raw_chat_text: string | null;
        readonly raw_session_id: string | null;
      }>(`
        select
          counts #>> '{rawSnapshot,session,session_id}' as raw_session_id,
          counts #>> '{rawSnapshot,chatTurns,0,text}' as raw_chat_text,
          counts #>> '{rawSnapshot,artifacts,0,payload,answer}' as raw_answer
        from public.deletion_logs
        where deletion_scope = 'duplicate_session_manual_reject';
      `);
      expect(auditRows.rows[0]).toEqual({
        raw_answer: "submitted-a",
        raw_chat_text: "submitted a question",
        raw_session_id: "session-submitted-a"
      });

      const exportRows = await db.query<{
        readonly raw_answer: string | null;
        readonly raw_session_id: string | null;
      }>(`
        select
          payload #>> '{rawSnapshot,session,session_id}' as raw_session_id,
          payload #>> '{rawSnapshot,artifacts,0,payload,answer}' as raw_answer
        from public.exports
        where export_kind = 'duplicate_session_manual_canonical_choice';
      `);
      expect(exportRows.rows[0]).toEqual({
        raw_answer: "submitted-a",
        raw_session_id: "session-submitted-a"
      });
    });
  });

  it("rejects manual canonical choices across different assignment/student groups", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await db.exec(`
        insert into public.students (id, class_group_id, student_anonymous_id, participant_code_hash)
        values ('student-2', 'class-keep', 'student-anon-2', 'hash-2');
      `);
      await seedSession(db, "session-submitted-a", "class-old", "2026-07-01T00:00:00Z", "submitted");
      await seedSession(db, "session-submitted-b", "class-keep", "2026-07-02T00:00:00Z", "completed", true);
      await db.exec(`
        insert into public.sessions (
          session_id, class_group_id, assignment_id, student_anonymous_id,
          current_stage, status, research_mode, research_condition,
          assignment_snapshot, metadata, research_locked, created_at, updated_at
        )
        values ('session-other-student', 'class-keep', 'assignment-1', 'student-anon-2',
          'ai_chat', 'submitted', 'understanding_calibration', 'single_group_baseline',
          '{}'::jsonb, '{}'::jsonb, true, '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z'
        );
      `);
      await db.exec(stepwiseRepairSql);

      await expect(
        db.query(`
          select public.choose_duplicate_research_session_canonical(
            'session-submitted-b',
            array['session-other-student']
          );
        `)
      ).rejects.toThrow(/same assignment and student/);
    });
  });

  it("emergency-archives all remaining duplicate session groups so the unique index can be created before class", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await db.exec(`
        insert into public.students (id, class_group_id, student_anonymous_id, participant_code_hash)
        values ('student-2', 'class-keep', 'student-anon-2', 'hash-2');
      `);
      await seedSession(db, "session-a-old", "class-old", "2026-07-01T00:00:00Z", "in_progress");
      await seedSession(db, "session-a-keep", "class-keep", "2026-07-02T00:00:00Z", "submitted");
      await db.exec(`
        insert into public.sessions (
          session_id, class_group_id, assignment_id, student_anonymous_id,
          current_stage, status, research_mode, research_condition,
          assignment_snapshot, metadata, research_locked, created_at, updated_at, completed_at
        )
        values
          ('session-b-old', 'class-old', 'assignment-1', 'student-anon-2',
            'ai_chat', 'submitted', 'understanding_calibration', 'single_group_baseline',
            '{}'::jsonb, '{}'::jsonb, true, '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z', '2026-07-01T00:10:00Z'),
          ('session-b-keep', 'class-keep', 'assignment-1', 'student-anon-2',
            'ai_chat', 'completed', 'understanding_calibration', 'single_group_baseline',
            '{}'::jsonb, '{}'::jsonb, true, '2026-07-02T00:00:00Z', '2026-07-02T00:00:00Z', '2026-07-02T00:10:00Z');
        insert into public.chat_turns (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, role, text, request_id)
        values
          ('chat-a-old', 'session-a-old', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:01:00Z', 'ai_chat', 'student', 'a old question', 'request-a'),
          ('chat-b-old', 'session-b-old', 'class-old', 'assignment-1', 'student-anon-2', '2026-07-01T00:01:00Z', 'ai_chat', 'student', 'b old question', 'request-b');
        insert into public.measures (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
        values ('measure-b-old', 'session-b-old', 'class-old', 'assignment-1', 'student-anon-2', '2026-07-01T00:02:00Z', 'problem1_confidence', 'problem1_confidence', '{"confidence":2}'::jsonb);
      `);
      await db.exec(stepwiseRepairSql);

      const choices = await db.query<{ readonly session_id: string; readonly suggested_keep: boolean }>(`
        select session_id, suggested_keep
        from public.list_all_duplicate_research_session_choices()
        order by session_id;
      `);
      expect(choices.rows).toEqual([
        { session_id: "session-a-keep", suggested_keep: true },
        { session_id: "session-a-old", suggested_keep: false },
        { session_id: "session-b-keep", suggested_keep: true },
        { session_id: "session-b-old", suggested_keep: false }
      ]);

      const emergencyResult = await db.query<{
        readonly result: {
          readonly archivedSessionCount: number;
          readonly remainingDuplicateGroups: number;
        };
      }>("select public.emergency_archive_duplicate_research_sessions_for_unique_index(20) as result;");
      expect(emergencyResult.rows[0]?.result).toMatchObject({
        archivedSessionCount: 2,
        remainingDuplicateGroups: 0
      });

      await db.exec("create unique index if not exists sessions_assignment_student_unique on public.sessions(assignment_id, student_anonymous_id);");

      const sessions = await db.query<{ readonly session_id: string }>("select session_id from public.sessions order by session_id;");
      expect(sessions.rows).toEqual([{ session_id: "session-a-keep" }, { session_id: "session-b-keep" }]);

      const archivedRows = await db.query<{
        readonly chat_text: string | null;
        readonly confidence: string | null;
        readonly raw_session_id: string | null;
      }>(`
        select
          counts #>> '{rawSnapshot,session,session_id}' as raw_session_id,
          counts #>> '{rawSnapshot,chatTurns,0,text}' as chat_text,
          counts #>> '{rawSnapshot,measures,0,payload,confidence}' as confidence
        from public.deletion_logs
        where deletion_scope = 'duplicate_session_emergency_archive'
        order by raw_session_id;
      `);
      expect(archivedRows.rows).toEqual([
        { chat_text: "a old question", confidence: null, raw_session_id: "session-a-old" },
        { chat_text: "b old question", confidence: "2", raw_session_id: "session-b-old" }
      ]);
    });
  });

  it("stops the stepwise repair when duplicate rows contain more than one locked or completed session", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-locked-a", "class-keep", "2026-07-01T00:00:00Z", "completed", true);
      await seedSession(db, "session-locked-b", "class-keep", "2026-07-02T00:00:00Z", "completed", true);
      await db.exec(stepwiseRepairSql);

      await expect(db.query("select public.repair_duplicate_research_sessions_once(1);")).rejects.toThrow(/multiple locked\/submitted rows/);
    });
  });

  it("stops the stepwise repair when submitted-only duplicate rows exist", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-submitted-a", "class-keep", "2026-07-01T00:00:00Z", "submitted");
      await seedSession(db, "session-submitted-b", "class-keep", "2026-07-02T00:00:00Z", "submitted");
      await db.exec(stepwiseRepairSql);

      await expect(db.query("select public.repair_duplicate_research_sessions_once(1);")).rejects.toThrow(/multiple locked\/submitted rows/);
    });
  });

  it("stops the stepwise repair when completed-at-only duplicate rows exist", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-completed-at-a", "class-keep", "2026-07-01T00:00:00Z", "in_progress", false, "2026-07-01T00:10:00Z");
      await seedSession(db, "session-completed-at-b", "class-keep", "2026-07-02T00:00:00Z", "in_progress", false, "2026-07-02T00:10:00Z");
      await db.exec(stepwiseRepairSql);

      await expect(db.query("select public.repair_duplicate_research_sessions_once(1);")).rejects.toThrow(/multiple locked\/submitted rows/);
    });
  });

  it("stops the stepwise repair instead of merging child rows into a locked canonical session", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-old", "class-old", "2026-07-01T00:00:00Z");
      await seedSession(db, "session-locked", "class-keep", "2026-07-02T00:00:00Z", "completed", true);
      await db.exec(`
        insert into public.events (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, type, payload)
        values ('event-old', 'session-old', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:02:00Z', 'ai_chat', 'question_started', '{}'::jsonb);
      `);
      await db.exec(stepwiseRepairSql);

      await expect(db.query("select public.repair_duplicate_research_sessions_once(1);")).rejects.toThrow(/child rows that would have to be merged into a locked\/submitted session/);
    });
  });

  it("merges duplicate child rows into the canonical session and creates the unique index", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-old", "class-old", "2026-07-01T00:00:00Z");
      await seedSession(db, "session-keep", "class-keep", "2026-07-02T00:00:00Z");
      await db.exec(`
        insert into public.chat_turns (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, role, text, request_id)
        values
          ('chat-keep', 'session-keep', 'class-keep', 'assignment-1', 'student-anon-1', '2026-07-02T00:01:00Z', 'ai_chat', 'student', 'keep question', 'request-1'),
          ('chat-old', 'session-old', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:01:00Z', 'ai_chat', 'student', 'old question', 'request-1');
        insert into public.events (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, type, payload)
        values ('event-old', 'session-old', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:02:00Z', 'ai_chat', 'question_started', '{"from":"old"}'::jsonb);
        insert into public.artifacts (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
        values ('artifact-old', 'session-old', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:03:00Z', 'problem1', 'problem1', '{"answer":"old"}'::jsonb);
        insert into public.measures (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
        values ('measure-old', 'session-old', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:04:00Z', 'problem1_confidence', 'problem1_confidence', '{"confidence":3}'::jsonb);
      `);

      await db.exec(migration009);

      const sessionCount = await db.query<{ readonly count: number }>("select count(*)::int as count from public.sessions;");
      expect(sessionCount.rows[0]?.count).toBe(1);

      const movedRows = await db.query<{
        readonly class_group_id: string;
        readonly request_id: string | null;
        readonly session_id: string;
      }>("select session_id, class_group_id, request_id from public.chat_turns where id = 'chat-old';");
      expect(movedRows.rows[0]).toEqual({
        class_group_id: "class-keep",
        request_id: "request-1:merged-from:session-old:chat-old",
        session_id: "session-keep"
      });

      const childContexts = await db.query<{ readonly count: number }>(`
        select count(*)::int as count
        from (
          select session_id, class_group_id from public.events where id = 'event-old'
          union all select session_id, class_group_id from public.artifacts where id = 'artifact-old'
          union all select session_id, class_group_id from public.measures where id = 'measure-old'
        ) rows
        where session_id = 'session-keep' and class_group_id = 'class-keep';
      `);
      expect(childContexts.rows[0]?.count).toBe(3);

      const auditRows = await db.query<{
        readonly raw_chat_turn_count: number;
        readonly raw_session_id: string | null;
        readonly rewrite_count: number;
      }>(`
        select
          counts #>> '{rawSnapshot,session,session_id}' as raw_session_id,
          jsonb_array_length(counts #> '{rawSnapshot,chatTurns}') as raw_chat_turn_count,
          jsonb_array_length(counts #> '{requestIdRewrites}') as rewrite_count
        from public.deletion_logs
        where deletion_scope = 'duplicate_session_merge';
      `);
      expect(auditRows.rows[0]).toEqual({
        raw_chat_turn_count: 1,
        raw_session_id: "session-old",
        rewrite_count: 1
      });

      const exportRows = await db.query<{
        readonly chat_turn_count: number;
        readonly session_count: number;
      }>(`
        select
          jsonb_array_length(payload -> 'sessions') as session_count,
          jsonb_array_length(payload -> 'chatTurns') as chat_turn_count
        from public.exports
        where export_kind = 'duplicate_sessions_pre_uniqueness_repair';
      `);
      expect(exportRows.rows[0]).toEqual({ chat_turn_count: 2, session_count: 2 });

      const indexRows = await db.query<{ readonly count: number }>(`
        select count(*)::int as count
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'sessions_assignment_student_unique';
      `);
      expect(indexRows.rows[0]?.count).toBe(1);
    });
  });

  it("stops when duplicate rows contain more than one locked or completed session", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-locked-a", "class-keep", "2026-07-01T00:00:00Z", "completed", true);
      await seedSession(db, "session-locked-b", "class-keep", "2026-07-02T00:00:00Z", "completed", true);

      await expect(db.exec(migration009)).rejects.toThrow(/multiple locked\/submitted rows/);
    });
  });

  it("stops instead of merging child rows into a locked canonical session", async () => {
    await withDatabase(async (db) => {
      await seedRoster(db);
      await seedSession(db, "session-old", "class-old", "2026-07-01T00:00:00Z");
      await seedSession(db, "session-locked", "class-keep", "2026-07-02T00:00:00Z", "completed", true);
      await db.exec(`
        insert into public.events (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, type, payload)
        values ('event-old', 'session-old', 'class-old', 'assignment-1', 'student-anon-1', '2026-07-01T00:02:00Z', 'ai_chat', 'question_started', '{}'::jsonb);
      `);

      await expect(db.exec(migration009)).rejects.toThrow(/child rows that would have to be merged into a locked\/submitted session/);
    });
  });
});
