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

  if target.research_locked then
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
      research_locked = research_locked or coalesce(requested_status, status) in ('submitted', 'completed'),
      updated_at = now()
  where session_id = target.session_id;

  return jsonb_build_object('ok', true, 'already_applied', false);
end;
$$;

revoke all on function public.sync_research_session(jsonb) from public;
revoke all on function public.sync_research_session(jsonb) from anon;
revoke all on function public.sync_research_session(jsonb) from authenticated;
grant execute on function public.sync_research_session(jsonb) to service_role;
