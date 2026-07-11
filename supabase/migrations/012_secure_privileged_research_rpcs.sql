revoke all on function public.apply_roster_mutation(jsonb) from public;
revoke all on function public.apply_roster_mutation(jsonb) from anon;
revoke all on function public.apply_roster_mutation(jsonb) from authenticated;
grant execute on function public.apply_roster_mutation(jsonb) to service_role;

revoke all on function public.delete_research_test_data(jsonb) from public;
revoke all on function public.delete_research_test_data(jsonb) from anon;
revoke all on function public.delete_research_test_data(jsonb) from authenticated;
grant execute on function public.delete_research_test_data(jsonb) to service_role;

update public.sessions
set research_locked = true
where research_locked = false
  and (status in ('submitted', 'completed') or completed_at is not null);

create or replace function public.reset_research_session(p_session_id text, p_teacher_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target sessions%rowtype;
begin
  select * into target from public.sessions where session_id = p_session_id for update;
  if not found then raise exception 'Unknown session.' using errcode = 'P0002'; end if;
  if target.research_locked or target.status in ('submitted', 'completed') or target.completed_at is not null then
    raise exception 'Locked research data cannot be reset.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.assignments where id = target.assignment_id and created_by_teacher_id = p_teacher_id) then
    raise exception 'Teacher cannot reset this session.' using errcode = 'P0001';
  end if;
  delete from public.chat_turns where session_id = p_session_id;
  delete from public.events where session_id = p_session_id;
  delete from public.artifacts where session_id = p_session_id;
  delete from public.measures where session_id = p_session_id;
  delete from public.sessions where session_id = p_session_id;
  return jsonb_build_object('deleted', true, 'sessionId', p_session_id);
end;
$$;

revoke all on function public.reset_research_session(text, text) from public;
revoke all on function public.reset_research_session(text, text) from anon;
revoke all on function public.reset_research_session(text, text) from authenticated;
grant execute on function public.reset_research_session(text, text) to service_role;

revoke all on function public.research_schema_health() from public;
revoke all on function public.research_schema_health() from anon;
revoke all on function public.research_schema_health() from authenticated;
grant execute on function public.research_schema_health() to service_role;

create or replace function public.research_schema_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', '012_secure_privileged_research_rpcs',
    'plaintext_password_columns_removed', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('students', 'teachers') and column_name = 'initial_password'),
    'apply_roster_mutation_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'apply_roster_mutation'),
    'delete_research_test_data_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'delete_research_test_data'),
    'sync_research_session_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'sync_research_session'),
    'session_uniqueness_available', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'sessions_assignment_student_unique'),
    'ai_request_quota_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'reserve_ai_request'),
    'reset_research_session_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'reset_research_session')
  );
$$;
