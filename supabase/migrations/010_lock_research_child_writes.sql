create or replace function public.ensure_session_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row record;
begin
  select class_group_id, assignment_id, student_anonymous_id, research_locked
  into session_row
  from public.sessions
  where session_id = new.session_id
  for update;

  if not found then
    raise exception 'child row references unknown session %', new.session_id;
  end if;

  if session_row.research_locked then
    raise exception 'research session is locked';
  end if;

  if new.class_group_id is distinct from session_row.class_group_id
    or new.assignment_id is distinct from session_row.assignment_id
    or new.student_anonymous_id is distinct from session_row.student_anonymous_id then
    raise exception 'child row context does not match session %', new.session_id;
  end if;

  return new;
end;
$$;

create or replace function public.research_schema_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', '010_lock_research_child_writes',
    'plaintext_password_columns_removed', not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('students', 'teachers')
        and column_name = 'initial_password'
    ),
    'apply_roster_mutation_available', exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'apply_roster_mutation'
    ),
    'delete_research_test_data_available', exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'delete_research_test_data'
    ),
    'sync_research_session_available', exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'sync_research_session'
    ),
    'session_uniqueness_available', exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'sessions_assignment_student_unique'
    )
  );
$$;
