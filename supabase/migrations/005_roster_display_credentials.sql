alter table public.students
  add column if not exists initial_participant_code text;

alter table public.teachers
  add column if not exists initial_password text;
