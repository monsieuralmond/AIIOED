create extension if not exists pgcrypto;

create table if not exists public.classes (
  id text primary key,
  name text not null,
  teacher_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id text primary key,
  class_group_id text not null references public.classes(id) on delete cascade,
  created_by_teacher_id text not null,
  title text not null,
  research_mode text not null,
  research_condition text not null,
  assignment jsonb not null,
  research_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id text primary key,
  class_group_id text not null references public.classes(id) on delete cascade,
  student_anonymous_id text not null unique,
  participant_code_hash text not null unique,
  display_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.chat_turns (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null default now(),
  stage text not null,
  role text not null check (role in ('student', 'assistant')),
  text text not null,
  response_type text,
  request_id text
);

create unique index if not exists chat_turns_request_role_unique
  on public.chat_turns(session_id, request_id, role);

create table if not exists public.events (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null default now(),
  stage text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.artifacts (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null default now(),
  stage text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz
);

create table if not exists public.measures (
  id text primary key,
  session_id text not null references public.sessions(session_id) on delete cascade,
  class_group_id text not null references public.classes(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  student_anonymous_id text not null references public.students(student_anonymous_id) on delete cascade,
  created_at timestamptz not null default now(),
  stage text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.exports (
  id text primary key default gen_random_uuid()::text,
  class_group_id text references public.classes(id) on delete set null,
  assignment_id text references public.assignments(id) on delete set null,
  generated_by_teacher_id text,
  created_at timestamptz not null default now(),
  export_kind text not null,
  anonymized boolean not null default true,
  completed_only boolean not null default true,
  payload jsonb not null
);

create table if not exists public.deletion_logs (
  id text primary key default gen_random_uuid()::text,
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

create index if not exists sessions_summary_idx
  on public.sessions(class_group_id, assignment_id, status, updated_at desc);

create index if not exists chat_turns_session_idx
  on public.chat_turns(session_id, created_at);

create index if not exists events_session_idx
  on public.events(session_id, created_at);

create index if not exists artifacts_session_idx
  on public.artifacts(session_id, created_at);

create index if not exists measures_session_idx
  on public.measures(session_id, created_at);

alter table public.classes enable row level security;
alter table public.assignments enable row level security;
alter table public.students enable row level security;
alter table public.sessions enable row level security;
alter table public.chat_turns enable row level security;
alter table public.events enable row level security;
alter table public.artifacts enable row level security;
alter table public.measures enable row level security;
alter table public.exports enable row level security;
alter table public.deletion_logs enable row level security;

create policy "teachers can read their classes" on public.classes
  for select using (teacher_id = (auth.jwt() ->> 'teacher_id'));

create policy "teachers can read their assignments" on public.assignments
  for select using (created_by_teacher_id = (auth.jwt() ->> 'teacher_id'));

create policy "teachers can read class students" on public.students
  for select using (
    exists (
      select 1 from public.classes
      where classes.id = students.class_group_id
      and classes.teacher_id = (auth.jwt() ->> 'teacher_id')
    )
  );

create policy "students can read own session" on public.sessions
  for select using (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can write own chat turns" on public.chat_turns
  for insert with check (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can read own chat turns" on public.chat_turns
  for select using (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can write own events" on public.events
  for insert with check (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can read own events" on public.events
  for select using (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can write own artifacts" on public.artifacts
  for insert with check (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can read own artifacts" on public.artifacts
  for select using (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can write own measures" on public.measures
  for insert with check (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "students can read own measures" on public.measures
  for select using (
    session_id = (auth.jwt() ->> 'session_id')
    and student_anonymous_id = (auth.jwt() ->> 'student_anonymous_id')
  );

create policy "teachers can read own session summaries" on public.sessions
  for select using (
    exists (
      select 1 from public.classes
      where classes.id = sessions.class_group_id
      and classes.teacher_id = (auth.jwt() ->> 'teacher_id')
    )
  );

create policy "teachers can read own chat turns" on public.chat_turns
  for select using (
    exists (
      select 1 from public.classes
      where classes.id = chat_turns.class_group_id
      and classes.teacher_id = (auth.jwt() ->> 'teacher_id')
    )
  );

create policy "teachers can read own events" on public.events
  for select using (
    exists (
      select 1 from public.classes
      where classes.id = events.class_group_id
      and classes.teacher_id = (auth.jwt() ->> 'teacher_id')
    )
  );

create policy "teachers can read own artifacts" on public.artifacts
  for select using (
    exists (
      select 1 from public.classes
      where classes.id = artifacts.class_group_id
      and classes.teacher_id = (auth.jwt() ->> 'teacher_id')
    )
  );

create policy "teachers can read own measures" on public.measures
  for select using (
    exists (
      select 1 from public.classes
      where classes.id = measures.class_group_id
      and classes.teacher_id = (auth.jwt() ->> 'teacher_id')
    )
  );
