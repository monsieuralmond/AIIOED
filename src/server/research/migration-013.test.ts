/* @vitest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration013 = readFileSync(join(process.cwd(), "supabase", "migrations", "013_archive_before_teacher_session_reset.sql"), "utf8");

const baseSchema = `
create role anon;
create role authenticated;
create role service_role;

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
  role text not null,
  text text not null,
  response_type text,
  request_id text
);

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

type CountRow = {
  readonly count: number;
};

type ResetRow = {
  readonly result: {
    readonly deleted: {
      readonly artifacts: number;
      readonly chatTurns: number;
      readonly events: number;
      readonly measures: number;
      readonly sessions: number;
    };
    readonly logId: string;
    readonly sessionId: string;
  };
};

type SnapshotTextRow = {
  readonly value: string | null;
};

async function withDatabase<T>(run: (db: PGlite) => Promise<T>): Promise<T> {
  const db = new PGlite();
  try {
    await db.exec(baseSchema);
    return await run(db);
  } finally {
    await db.close();
  }
}

async function seedLockedSession(db: PGlite): Promise<void> {
  await db.exec(`
    insert into public.classes (id, name, teacher_id)
    values ('class-1', 'Class 1', 'teacher-1');
    insert into public.assignments (id, class_group_id, created_by_teacher_id, title, research_mode, research_condition, assignment)
    values ('assignment-1', 'class-1', 'teacher-1', 'Assignment 1', 'understanding_calibration', 'single_group_baseline', '{}'::jsonb);
    insert into public.students (id, class_group_id, student_anonymous_id, participant_code_hash)
    values ('student-1', 'class-1', 'anon-1', 'hash-1');
    insert into public.sessions (
      session_id, class_group_id, assignment_id, student_anonymous_id,
      current_stage, status, research_mode, research_condition,
      assignment_snapshot, metadata, research_locked, created_at, updated_at, completed_at
    )
    values (
      'session-locked', 'class-1', 'assignment-1', 'anon-1',
      'completed', 'submitted', 'understanding_calibration', 'single_group_baseline',
      '{"title":"Assignment 1"}'::jsonb, '{}'::jsonb, true,
      '2026-07-01T00:00:00Z', '2026-07-01T00:10:00Z', '2026-07-01T00:10:00Z'
    );
    insert into public.chat_turns (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, role, text, request_id)
    values ('chat-1', 'session-locked', 'class-1', 'assignment-1', 'anon-1', '2026-07-01T00:01:00Z', 'ai_chat', 'student', '질문', 'request-1');
    insert into public.events (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, type, payload)
    values ('event-1', 'session-locked', 'class-1', 'assignment-1', 'anon-1', '2026-07-01T00:02:00Z', 'ai_chat', 'question_started', '{"value":"event"}'::jsonb);
    insert into public.artifacts (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
    values ('artifact-1', 'session-locked', 'class-1', 'assignment-1', 'anon-1', '2026-07-01T00:03:00Z', 'problem1', 'problem1', '{"answer":"답변"}'::jsonb);
    insert into public.measures (id, session_id, class_group_id, assignment_id, student_anonymous_id, created_at, stage, kind, payload)
    values ('measure-1', 'session-locked', 'class-1', 'assignment-1', 'anon-1', '2026-07-01T00:04:00Z', 'problem1_confidence', 'problem1_confidence', '{"confidence":4}'::jsonb);
  `);
}

describe("migration 013 teacher session reset archive", () => {
  it("archives a locked submitted session before deleting it for teacher reset", async () => {
    await withDatabase(async (db) => {
      await seedLockedSession(db);
      await db.exec(migration013);

      const reset = await db.query<ResetRow>("select public.reset_research_session('session-locked', 'teacher-1') as result;");

      expect(reset.rows[0]?.result).toEqual({
        deleted: {
          artifacts: 1,
          chatTurns: 1,
          events: 1,
          measures: 1,
          sessions: 1
        },
        logId: "deletion-1",
        sessionId: "session-locked"
      });

      const sessionCount = await db.query<CountRow>("select count(*)::int as count from public.sessions where session_id = 'session-locked';");
      const chatCount = await db.query<CountRow>("select count(*)::int as count from public.chat_turns where session_id = 'session-locked';");
      const exportCount = await db.query<CountRow>("select count(*)::int as count from public.exports where export_kind = 'session_reset_pre_delete';");
      const logCount = await db.query<CountRow>("select count(*)::int as count from public.deletion_logs where deletion_scope = 'teacher_session_reset';");
      const archivedSessionId = await db.query<SnapshotTextRow>("select payload #>> '{rawSnapshot,session,session_id}' as value from public.exports limit 1;");
      const archivedChat = await db.query<SnapshotTextRow>("select payload #>> '{rawSnapshot,chatTurns,0,text}' as value from public.exports limit 1;");
      const archivedEvent = await db.query<SnapshotTextRow>("select payload #>> '{rawSnapshot,events,0,payload,value}' as value from public.exports limit 1;");
      const archivedAnswer = await db.query<SnapshotTextRow>("select payload #>> '{rawSnapshot,artifacts,0,payload,answer}' as value from public.exports limit 1;");
      const archivedConfidence = await db.query<SnapshotTextRow>("select payload #>> '{rawSnapshot,measures,0,payload,confidence}' as value from public.exports limit 1;");
      const deletionLogAnswer = await db.query<SnapshotTextRow>("select counts #>> '{rawSnapshot,artifacts,0,payload,answer}' as value from public.deletion_logs limit 1;");

      expect(sessionCount.rows[0]?.count).toBe(0);
      expect(chatCount.rows[0]?.count).toBe(0);
      expect(exportCount.rows[0]?.count).toBe(1);
      expect(logCount.rows[0]?.count).toBe(1);
      expect(archivedSessionId.rows[0]?.value).toBe("session-locked");
      expect(archivedChat.rows[0]?.value).toBe("질문");
      expect(archivedEvent.rows[0]?.value).toBe("event");
      expect(archivedAnswer.rows[0]?.value).toBe("답변");
      expect(archivedConfidence.rows[0]?.value).toBe("4");
      expect(deletionLogAnswer.rows[0]?.value).toBe("답변");
    });
  });

  it("rejects reset when the teacher does not own the assignment", async () => {
    await withDatabase(async (db) => {
      await seedLockedSession(db);
      await db.exec(migration013);

      await expect(db.query("select public.reset_research_session('session-locked', 'teacher-2');")).rejects.toThrow(/Teacher cannot reset this session/);

      const sessionCount = await db.query<CountRow>("select count(*)::int as count from public.sessions where session_id = 'session-locked';");
      const exportCount = await db.query<CountRow>("select count(*)::int as count from public.exports;");
      const logCount = await db.query<CountRow>("select count(*)::int as count from public.deletion_logs;");
      expect(sessionCount.rows[0]?.count).toBe(1);
      expect(exportCount.rows[0]?.count).toBe(0);
      expect(logCount.rows[0]?.count).toBe(0);
    });
  });
});
