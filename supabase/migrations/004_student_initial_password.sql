alter table public.students
  add column if not exists initial_password text;
