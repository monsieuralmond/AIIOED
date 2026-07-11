create or replace function public.reset_research_session(p_session_id text, p_teacher_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.sessions%rowtype;
  raw_snapshot jsonb;
  chat_turn_count integer := 0;
  event_count integer := 0;
  artifact_count integer := 0;
  measure_count integer := 0;
  log_id text;
begin
  select *
  into target
  from public.sessions
  where session_id = p_session_id
  for update;

  if not found then
    raise exception 'Unknown session.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.assignments
    where id = target.assignment_id
      and created_by_teacher_id = p_teacher_id
  ) then
    raise exception 'Teacher cannot reset this session.' using errcode = 'P0001';
  end if;

  select count(*)::integer into chat_turn_count from public.chat_turns where session_id = p_session_id;
  select count(*)::integer into event_count from public.events where session_id = p_session_id;
  select count(*)::integer into artifact_count from public.artifacts where session_id = p_session_id;
  select count(*)::integer into measure_count from public.measures where session_id = p_session_id;

  select jsonb_build_object(
    'session', to_jsonb(target),
    'chatTurns', coalesce(
      (
        select jsonb_agg(to_jsonb(chat_turns) order by chat_turns.created_at, chat_turns.id)
        from public.chat_turns
        where chat_turns.session_id = p_session_id
      ),
      '[]'::jsonb
    ),
    'events', coalesce(
      (
        select jsonb_agg(to_jsonb(events) order by events.created_at, events.id)
        from public.events
        where events.session_id = p_session_id
      ),
      '[]'::jsonb
    ),
    'artifacts', coalesce(
      (
        select jsonb_agg(to_jsonb(artifacts) order by artifacts.created_at, artifacts.id)
        from public.artifacts
        where artifacts.session_id = p_session_id
      ),
      '[]'::jsonb
    ),
    'measures', coalesce(
      (
        select jsonb_agg(to_jsonb(measures) order by measures.created_at, measures.id)
        from public.measures
        where measures.session_id = p_session_id
      ),
      '[]'::jsonb
    )
  )
  into raw_snapshot;

  insert into public.exports (
    anonymized,
    assignment_id,
    class_group_id,
    completed_only,
    export_kind,
    generated_by_teacher_id,
    payload
  )
  values (
    false,
    target.assignment_id,
    target.class_group_id,
    false,
    'session_reset_pre_delete',
    p_teacher_id,
    jsonb_build_object(
      'reason', 'teacher reset session after archiving raw research data',
      'createdAt', now(),
      'sessionId', target.session_id,
      'researchLocked', target.research_locked,
      'status', target.status,
      'rawSnapshot', raw_snapshot
    )
  );

  insert into public.deletion_logs (
    assignment_id,
    class_group_id,
    session_id,
    student_anonymous_id,
    deleted_by,
    deletion_scope,
    exported_before_delete,
    counts,
    reason
  )
  values (
    target.assignment_id,
    target.class_group_id,
    target.session_id,
    target.student_anonymous_id,
    p_teacher_id,
    'teacher_session_reset',
    true,
    jsonb_build_object(
      'sessionsDeleted', 1,
      'chatTurnsDeleted', chat_turn_count,
      'eventsDeleted', event_count,
      'artifactsDeleted', artifact_count,
      'measuresDeleted', measure_count,
      'researchLocked', target.research_locked,
      'status', target.status,
      'rawSnapshot', raw_snapshot
    ),
    'Teacher reset session after archiving raw research data.'
  )
  returning id into log_id;

  delete from public.chat_turns where session_id = p_session_id;
  delete from public.events where session_id = p_session_id;
  delete from public.artifacts where session_id = p_session_id;
  delete from public.measures where session_id = p_session_id;
  delete from public.sessions where session_id = p_session_id;

  return jsonb_build_object(
    'deleted', jsonb_build_object(
      'sessions', 1,
      'chatTurns', chat_turn_count,
      'events', event_count,
      'artifacts', artifact_count,
      'measures', measure_count
    ),
    'logId', log_id,
    'sessionId', p_session_id
  );
end;
$$;

revoke all on function public.reset_research_session(text, text) from public;
revoke all on function public.reset_research_session(text, text) from anon;
revoke all on function public.reset_research_session(text, text) from authenticated;
grant execute on function public.reset_research_session(text, text) to service_role;

create or replace function public.research_schema_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', '013_archive_before_teacher_session_reset',
    'plaintext_password_columns_removed', not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('students', 'teachers') and column_name = 'initial_password'),
    'apply_roster_mutation_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'apply_roster_mutation'),
    'delete_research_test_data_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'delete_research_test_data'),
    'sync_research_session_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'sync_research_session'),
    'session_uniqueness_available', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'sessions_assignment_student_unique'),
    'ai_request_quota_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'reserve_ai_request'),
    'reset_research_session_available', exists (select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where pg_namespace.nspname = 'public' and pg_proc.proname = 'reset_research_session'),
    'reset_research_session_archives_before_delete', exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'reset_research_session'
        and pg_get_functiondef(pg_proc.oid) ilike '%session_reset_pre_delete%'
    )
  );
$$;

revoke all on function public.research_schema_health() from public;
revoke all on function public.research_schema_health() from anon;
revoke all on function public.research_schema_health() from authenticated;
grant execute on function public.research_schema_health() to service_role;
