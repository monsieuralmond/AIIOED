update public.sessions
set research_locked = false
where research_mode in ('writing_coach', 'guided_writing')
  and research_locked = true;

create or replace function public.ensure_session_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row record;
begin
  select class_group_id, assignment_id, student_anonymous_id, research_locked, research_mode
  into session_row
  from public.sessions
  where session_id = new.session_id
  for update;

  if not found then
    raise exception 'child row references unknown session %', new.session_id;
  end if;

  if session_row.research_locked and session_row.research_mode = 'understanding_calibration' then
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

create or replace function public.sync_research_session(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.sessions%rowtype;
  item jsonb;
  requested_status text := nullif(payload ->> 'status', '');
begin
  select *
  into target
  from public.sessions
  where session_id = payload ->> 'sessionId'
  for update;

  if not found then
    raise exception 'unknown research session';
  end if;

  if target.research_locked and target.research_mode = 'understanding_calibration' then
    if target.status <> coalesce(requested_status, target.status) then
      raise exception 'research session is locked';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(payload -> 'chatTurns', '[]'::jsonb)) item
      where not exists (select 1 from public.chat_turns row where row.id = item ->> 'id' and row.session_id = target.session_id)
    ) or exists (
      select 1
      from jsonb_array_elements(coalesce(payload -> 'events', '[]'::jsonb)) item
      where not exists (select 1 from public.events row where row.id = item ->> 'id' and row.session_id = target.session_id)
    ) or exists (
      select 1
      from jsonb_array_elements(coalesce(payload -> 'artifacts', '[]'::jsonb)) item
      where not exists (select 1 from public.artifacts row where row.id = item ->> 'id' and row.session_id = target.session_id)
    ) or exists (
      select 1
      from jsonb_array_elements(coalesce(payload -> 'measures', '[]'::jsonb)) item
      where not exists (select 1 from public.measures row where row.id = item ->> 'id' and row.session_id = target.session_id)
    ) then
      raise exception 'research session is locked';
    end if;
    return jsonb_build_object('ok', true, 'already_applied', true);
  end if;

  for item in select value from jsonb_array_elements(coalesce(payload -> 'chatTurns', '[]'::jsonb))
  loop
    insert into public.chat_turns (
      id, session_id, class_group_id, assignment_id, student_anonymous_id,
      created_at, stage, role, text, response_type, request_id
    )
    values (
      item ->> 'id', target.session_id, target.class_group_id, target.assignment_id,
      target.student_anonymous_id,
      coalesce(nullif(item ->> 'timestamp', ''), now()::text)::timestamptz,
      coalesce(nullif(item ->> 'stage', ''), payload ->> 'currentStage'), item ->> 'role', item ->> 'text', item ->> 'responseType', item ->> 'requestId'
    )
    on conflict (id) do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload -> 'events', '[]'::jsonb))
  loop
    insert into public.events (
      id, session_id, class_group_id, assignment_id, student_anonymous_id,
      created_at, stage, type, payload
    )
    values (
      item ->> 'id', target.session_id, target.class_group_id, target.assignment_id,
      target.student_anonymous_id,
      coalesce(nullif(item ->> 'timestamp', ''), now()::text)::timestamptz,
      item ->> 'stage', item ->> 'type', coalesce(item -> 'payload', '{}'::jsonb)
    )
    on conflict (id) do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload -> 'artifacts', '[]'::jsonb))
  loop
    insert into public.artifacts (
      id, session_id, class_group_id, assignment_id, student_anonymous_id,
      created_at, stage, kind, payload, updated_at
    )
    values (
      item ->> 'id', target.session_id, target.class_group_id, target.assignment_id,
      target.student_anonymous_id,
      coalesce(nullif(item ->> 'createdAt', ''), now()::text)::timestamptz,
      item ->> 'stage', item ->> 'kind', coalesce(item -> 'payload', '{}'::jsonb),
      nullif(item ->> 'updatedAt', '')::timestamptz
    )
    on conflict (id) do update set
      payload = excluded.payload,
      stage = excluded.stage,
      updated_at = excluded.updated_at
      where public.artifacts.session_id = target.session_id;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload -> 'measures', '[]'::jsonb))
  loop
    insert into public.measures (
      id, session_id, class_group_id, assignment_id, student_anonymous_id,
      created_at, stage, kind, payload
    )
    values (
      item ->> 'id', target.session_id, target.class_group_id, target.assignment_id,
      target.student_anonymous_id,
      coalesce(nullif(item ->> 'collectedAt', ''), now()::text)::timestamptz,
      item ->> 'stage', item ->> 'kind', coalesce(item -> 'payload', '{}'::jsonb)
    )
    on conflict (id) do nothing;
  end loop;

  update public.sessions
  set current_stage = coalesce(nullif(payload ->> 'currentStage', ''), current_stage),
      status = coalesce(requested_status, status),
      completed_at = coalesce(nullif(payload ->> 'completedAt', '')::timestamptz, completed_at),
      research_locked = case
        when target.research_mode = 'understanding_calibration'
          then research_locked or coalesce(requested_status, status) in ('submitted', 'completed')
        else false
      end,
      updated_at = now()
  where session_id = target.session_id;

  return jsonb_build_object('ok', true, 'already_applied', false);
end;
$$;

revoke all on function public.sync_research_session(jsonb) from public;
revoke all on function public.sync_research_session(jsonb) from anon;
revoke all on function public.sync_research_session(jsonb) from authenticated;
grant execute on function public.sync_research_session(jsonb) to service_role;

revoke all on function public.ensure_session_child_context() from public;
revoke all on function public.ensure_session_child_context() from anon;
revoke all on function public.ensure_session_child_context() from authenticated;
grant execute on function public.ensure_session_child_context() to service_role;

create or replace function public.research_schema_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', '015_unlock_submitted_writing_sessions',
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
    ),
    'submitted_writing_sessions_unlocked', not exists (
      select 1
      from public.sessions
      where research_mode in ('writing_coach', 'guided_writing')
        and research_locked = true
    )
  );
$$;

revoke all on function public.research_schema_health() from public;
revoke all on function public.research_schema_health() from anon;
revoke all on function public.research_schema_health() from authenticated;
grant execute on function public.research_schema_health() to service_role;
