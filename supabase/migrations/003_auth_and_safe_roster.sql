create table if not exists public.teachers (
  id text primary key,
  display_name text not null,
  login_id text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.students
  add column if not exists login_id text,
  add column if not exists password_hash text,
  add column if not exists student_number integer;

create unique index if not exists teachers_login_id_unique
  on public.teachers(login_id);

create index if not exists students_login_id_idx
  on public.students(login_id);

create index if not exists assignments_teacher_idx
  on public.assignments(created_by_teacher_id, updated_at desc);

alter table public.teachers enable row level security;

create policy "teachers can read own teacher account" on public.teachers
  for select using (id = (auth.jwt() ->> 'teacher_id'));
