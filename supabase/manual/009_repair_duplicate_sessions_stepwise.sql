create or replace function public.repair_duplicate_research_sessions_once(batch_limit integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  repair record;
  turn public.chat_turns%rowtype;
  raw_snapshot jsonb;
  merged_request_id text;
  rewrite_counter integer;
  repaired_count integer := 0;
  locked_duplicate_count integer := 0;
  locked_merge_count integer := 0;
  remaining_duplicate_groups integer := 0;
begin
  if batch_limit is null or batch_limit < 1 then
    raise exception 'batch_limit must be at least 1';
  end if;
  if batch_limit > 10 then
    raise exception 'batch_limit must be 10 or less';
  end if;

  perform set_config('lock_timeout', '5000', true);
  perform set_config('statement_timeout', '55000', true);

  lock table
    public.sessions,
    public.chat_turns,
    public.events,
    public.artifacts,
    public.measures,
    public.exports,
    public.deletion_logs
  in exclusive mode;

  create temporary table duplicate_session_ranked on commit drop as
  select
    sessions.*,
    count(*) over (
      partition by assignment_id, student_anonymous_id
    ) as duplicate_session_count,
    count(*) filter (
      where research_locked
        or status in ('submitted', 'completed')
        or completed_at is not null
    ) over (
      partition by assignment_id, student_anonymous_id
    ) as locked_research_session_count,
    first_value(session_id) over (
      partition by assignment_id, student_anonymous_id
      order by
        (research_locked or status in ('submitted', 'completed') or completed_at is not null) desc,
        completed_at desc nulls last,
        updated_at desc,
        created_at desc,
        session_id desc
    ) as keep_session_id
  from public.sessions;

  select count(*)::integer
  into locked_duplicate_count
  from duplicate_session_ranked
  where duplicate_session_count > 1
    and locked_research_session_count > 1;

  if locked_duplicate_count > 0 then
    raise exception 'duplicate research sessions include multiple locked/submitted rows for the same assignment and student; export those rows and manually choose the canonical session before rerunning stepwise repair';
  end if;

  create temporary table duplicate_session_repairs on commit drop as
  select
    old_session.session_id as old_session_id,
    keep_session.session_id as keep_session_id,
    old_session.class_group_id as old_class_group_id,
    keep_session.class_group_id as keep_class_group_id,
    old_session.assignment_id,
    old_session.student_anonymous_id,
    old_session.updated_at,
    old_session.locked_research_session_count,
    (keep_session.research_locked or keep_session.status in ('submitted', 'completed') or keep_session.completed_at is not null) as keep_session_locked,
    (select count(*)::integer from public.chat_turns where chat_turns.session_id = old_session.session_id) as chat_turn_count,
    (select count(*)::integer from public.events where events.session_id = old_session.session_id) as event_count,
    (select count(*)::integer from public.artifacts where artifacts.session_id = old_session.session_id) as artifact_count,
    (select count(*)::integer from public.measures where measures.session_id = old_session.session_id) as measure_count
  from duplicate_session_ranked old_session
  join public.sessions keep_session
    on keep_session.session_id = old_session.keep_session_id
  where old_session.duplicate_session_count > 1
    and old_session.session_id <> old_session.keep_session_id
  order by old_session.assignment_id, old_session.student_anonymous_id, old_session.updated_at, old_session.session_id
  limit batch_limit;

  select count(*)::integer
  into locked_merge_count
  from duplicate_session_repairs
  where keep_session_locked
    and chat_turn_count + event_count + artifact_count + measure_count > 0;

  if locked_merge_count > 0 then
    raise exception 'duplicate research sessions include child rows that would have to be merged into a locked/submitted session; export those rows and manually choose the canonical session before rerunning stepwise repair';
  end if;

  create temporary table duplicate_session_request_id_rewrites (
    old_session_id text not null,
    keep_session_id text not null,
    chat_turn_id text not null,
    original_request_id text not null,
    rewritten_request_id text not null
  ) on commit drop;

  for repair in
    select * from duplicate_session_repairs
  loop
    select jsonb_build_object(
      'session', to_jsonb(old_session),
      'chatTurns', coalesce(
        (
          select jsonb_agg(to_jsonb(chat_turns) order by chat_turns.created_at, chat_turns.id)
          from public.chat_turns
          where chat_turns.session_id = repair.old_session_id
        ),
        '[]'::jsonb
      ),
      'events', coalesce(
        (
          select jsonb_agg(to_jsonb(events) order by events.created_at, events.id)
          from public.events
          where events.session_id = repair.old_session_id
        ),
        '[]'::jsonb
      ),
      'artifacts', coalesce(
        (
          select jsonb_agg(to_jsonb(artifacts) order by artifacts.created_at, artifacts.id)
          from public.artifacts
          where artifacts.session_id = repair.old_session_id
        ),
        '[]'::jsonb
      ),
      'measures', coalesce(
        (
          select jsonb_agg(to_jsonb(measures) order by measures.created_at, measures.id)
          from public.measures
          where measures.session_id = repair.old_session_id
        ),
        '[]'::jsonb
      )
    )
    into raw_snapshot
    from public.sessions old_session
    where old_session.session_id = repair.old_session_id;

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
      repair.assignment_id,
      repair.old_class_group_id,
      false,
      'duplicate_session_pre_uniqueness_stepwise_repair',
      'manual:009_repair_duplicate_sessions_stepwise',
      jsonb_build_object(
        'reason', 'duplicate session was merged before creating sessions_assignment_student_unique',
        'createdAt', now(),
        'oldSessionId', repair.old_session_id,
        'keepSessionId', repair.keep_session_id,
        'rawSnapshot', raw_snapshot
      )
    );

    for turn in
      select * from public.chat_turns
      where session_id = repair.old_session_id
      order by created_at, id
    loop
      merged_request_id := turn.request_id;
      if turn.request_id is not null and exists (
        select 1
        from public.chat_turns existing
        where existing.session_id = repair.keep_session_id
          and existing.request_id = turn.request_id
          and existing.role = turn.role
          and existing.id <> turn.id
      ) then
        rewrite_counter := 0;
        merged_request_id := concat(turn.request_id, ':merged-from:', repair.old_session_id, ':', turn.id);

        while exists (
          select 1
          from public.chat_turns existing
          where existing.session_id = repair.keep_session_id
            and existing.request_id = merged_request_id
            and existing.role = turn.role
            and existing.id <> turn.id
        ) loop
          rewrite_counter := rewrite_counter + 1;
          merged_request_id := concat(turn.request_id, ':merged-from:', repair.old_session_id, ':', turn.id, ':', rewrite_counter);
        end loop;

        insert into duplicate_session_request_id_rewrites (
          old_session_id,
          keep_session_id,
          chat_turn_id,
          original_request_id,
          rewritten_request_id
        )
        values (
          repair.old_session_id,
          repair.keep_session_id,
          turn.id,
          turn.request_id,
          merged_request_id
        );
      end if;

      update public.chat_turns
      set
        session_id = repair.keep_session_id,
        class_group_id = repair.keep_class_group_id,
        assignment_id = repair.assignment_id,
        student_anonymous_id = repair.student_anonymous_id,
        request_id = merged_request_id
      where id = turn.id;
    end loop;

    update public.events
    set
      session_id = repair.keep_session_id,
      class_group_id = repair.keep_class_group_id,
      assignment_id = repair.assignment_id,
      student_anonymous_id = repair.student_anonymous_id
    where session_id = repair.old_session_id;

    update public.artifacts
    set
      session_id = repair.keep_session_id,
      class_group_id = repair.keep_class_group_id,
      assignment_id = repair.assignment_id,
      student_anonymous_id = repair.student_anonymous_id
    where session_id = repair.old_session_id;

    update public.measures
    set
      session_id = repair.keep_session_id,
      class_group_id = repair.keep_class_group_id,
      assignment_id = repair.assignment_id,
      student_anonymous_id = repair.student_anonymous_id
    where session_id = repair.old_session_id;

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
      repair.assignment_id,
      repair.old_class_group_id,
      repair.old_session_id,
      repair.student_anonymous_id,
      'manual:009_repair_duplicate_sessions_stepwise',
      'duplicate_session_merge',
      true,
      jsonb_build_object(
        'mergedIntoSessionId', repair.keep_session_id,
        'canonicalClassGroupId', repair.keep_class_group_id,
        'chatTurnsMoved', repair.chat_turn_count,
        'eventsMoved', repair.event_count,
        'artifactsMoved', repair.artifact_count,
        'measuresMoved', repair.measure_count,
        'requestIdRewrites', coalesce(
          (
            select jsonb_agg(to_jsonb(rewrites) order by rewrites.chat_turn_id)
            from duplicate_session_request_id_rewrites rewrites
            where rewrites.old_session_id = repair.old_session_id
          ),
          '[]'::jsonb
        ),
        'rawSnapshot', raw_snapshot
      ),
      'Merged duplicate research session before adding sessions_assignment_student_unique.'
    );

    delete from public.sessions
    where session_id = repair.old_session_id;

    repaired_count := repaired_count + 1;
  end loop;

  select count(*)::integer
  into remaining_duplicate_groups
  from (
    select assignment_id, student_anonymous_id
    from public.sessions
    group by assignment_id, student_anonymous_id
    having count(*) > 1
  ) duplicates;

  return jsonb_build_object(
    'repairedOldSessions', repaired_count,
    'remainingDuplicateGroups', remaining_duplicate_groups
  );
end;
$$;

revoke all on function public.repair_duplicate_research_sessions_once(integer) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.repair_duplicate_research_sessions_once(integer) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.repair_duplicate_research_sessions_once(integer) from authenticated;
  end if;
end;
$$;

create or replace function public.list_duplicate_research_session_choices()
returns table (
  assignment_id text,
  student_anonymous_id text,
  session_id text,
  class_group_id text,
  current_stage text,
  status text,
  research_locked boolean,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  chat_turn_count integer,
  event_count integer,
  artifact_count integer,
  measure_count integer,
  suggested_keep boolean
)
language sql
security definer
set search_path = public
as $$
  with duplicate_groups as (
    select
      sessions.assignment_id,
      sessions.student_anonymous_id
    from public.sessions
    group by sessions.assignment_id, sessions.student_anonymous_id
    having count(*) > 1
      and count(*) filter (
        where sessions.research_locked
          or sessions.status in ('submitted', 'completed')
          or sessions.completed_at is not null
      ) > 1
  ),
  ranked_sessions as (
    select
      sessions.*,
      row_number() over (
        partition by sessions.assignment_id, sessions.student_anonymous_id
        order by
          (sessions.research_locked or sessions.status in ('submitted', 'completed') or sessions.completed_at is not null) desc,
          sessions.completed_at desc nulls last,
          sessions.updated_at desc,
          sessions.created_at desc,
          sessions.session_id desc
      ) as duplicate_rank
    from public.sessions
    join duplicate_groups
      on duplicate_groups.assignment_id = sessions.assignment_id
      and duplicate_groups.student_anonymous_id = sessions.student_anonymous_id
  )
  select
    ranked_sessions.assignment_id,
    ranked_sessions.student_anonymous_id,
    ranked_sessions.session_id,
    ranked_sessions.class_group_id,
    ranked_sessions.current_stage,
    ranked_sessions.status,
    ranked_sessions.research_locked,
    ranked_sessions.completed_at,
    ranked_sessions.created_at,
    ranked_sessions.updated_at,
    (select count(*)::integer from public.chat_turns where chat_turns.session_id = ranked_sessions.session_id) as chat_turn_count,
    (select count(*)::integer from public.events where events.session_id = ranked_sessions.session_id) as event_count,
    (select count(*)::integer from public.artifacts where artifacts.session_id = ranked_sessions.session_id) as artifact_count,
    (select count(*)::integer from public.measures where measures.session_id = ranked_sessions.session_id) as measure_count,
    ranked_sessions.duplicate_rank = 1 as suggested_keep
  from ranked_sessions
  order by
    ranked_sessions.assignment_id,
    ranked_sessions.student_anonymous_id,
    ranked_sessions.duplicate_rank,
    ranked_sessions.updated_at desc,
    ranked_sessions.session_id;
$$;

create or replace function public.list_all_duplicate_research_session_choices()
returns table (
  assignment_id text,
  student_anonymous_id text,
  session_id text,
  class_group_id text,
  current_stage text,
  status text,
  research_locked boolean,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  chat_turn_count integer,
  event_count integer,
  artifact_count integer,
  measure_count integer,
  suggested_keep boolean
)
language sql
security definer
set search_path = public
as $$
  with duplicate_groups as (
    select
      sessions.assignment_id,
      sessions.student_anonymous_id
    from public.sessions
    group by sessions.assignment_id, sessions.student_anonymous_id
    having count(*) > 1
  ),
  ranked_sessions as (
    select
      sessions.*,
      row_number() over (
        partition by sessions.assignment_id, sessions.student_anonymous_id
        order by
          (sessions.research_locked or sessions.status in ('submitted', 'completed') or sessions.completed_at is not null) desc,
          sessions.completed_at desc nulls last,
          sessions.updated_at desc,
          sessions.created_at desc,
          sessions.session_id desc
      ) as duplicate_rank
    from public.sessions
    join duplicate_groups
      on duplicate_groups.assignment_id = sessions.assignment_id
      and duplicate_groups.student_anonymous_id = sessions.student_anonymous_id
  )
  select
    ranked_sessions.assignment_id,
    ranked_sessions.student_anonymous_id,
    ranked_sessions.session_id,
    ranked_sessions.class_group_id,
    ranked_sessions.current_stage,
    ranked_sessions.status,
    ranked_sessions.research_locked,
    ranked_sessions.completed_at,
    ranked_sessions.created_at,
    ranked_sessions.updated_at,
    (select count(*)::integer from public.chat_turns where chat_turns.session_id = ranked_sessions.session_id) as chat_turn_count,
    (select count(*)::integer from public.events where events.session_id = ranked_sessions.session_id) as event_count,
    (select count(*)::integer from public.artifacts where artifacts.session_id = ranked_sessions.session_id) as artifact_count,
    (select count(*)::integer from public.measures where measures.session_id = ranked_sessions.session_id) as measure_count,
    ranked_sessions.duplicate_rank = 1 as suggested_keep
  from ranked_sessions
  order by
    ranked_sessions.assignment_id,
    ranked_sessions.student_anonymous_id,
    ranked_sessions.duplicate_rank,
    ranked_sessions.updated_at desc,
    ranked_sessions.session_id;
$$;

create or replace function public.choose_duplicate_research_session_canonical(
  canonical_session_id text,
  rejected_session_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_session public.sessions%rowtype;
  rejected_session public.sessions%rowtype;
  rejected_count integer := 0;
  distinct_rejected_count integer := 0;
  missing_rejected_count integer := 0;
  cross_group_count integer := 0;
  remaining_duplicate_groups integer := 0;
  raw_snapshot jsonb;
  rejected_snapshots jsonb := '[]'::jsonb;
begin
  if canonical_session_id is null or btrim(canonical_session_id) = '' then
    raise exception 'canonical_session_id is required';
  end if;
  if rejected_session_ids is null or cardinality(rejected_session_ids) = 0 then
    raise exception 'rejected_session_ids must include at least one session id';
  end if;

  select count(*)::integer, count(distinct rejected_id)::integer
  into rejected_count, distinct_rejected_count
  from unnest(rejected_session_ids) rejected_id;

  if rejected_count <> distinct_rejected_count then
    raise exception 'rejected_session_ids must not contain duplicates';
  end if;

  if exists (
    select 1
    from unnest(rejected_session_ids) rejected_id
    where rejected_id is null or btrim(rejected_id) = ''
  ) then
    raise exception 'rejected_session_ids must not contain blank values';
  end if;

  if canonical_session_id = any(rejected_session_ids) then
    raise exception 'canonical_session_id must not also be rejected';
  end if;

  perform set_config('lock_timeout', '5000', true);
  perform set_config('statement_timeout', '55000', true);

  lock table
    public.sessions,
    public.chat_turns,
    public.events,
    public.artifacts,
    public.measures,
    public.exports,
    public.deletion_logs
  in exclusive mode;

  select *
  into canonical_session
  from public.sessions
  where sessions.session_id = canonical_session_id;

  if not found then
    raise exception 'canonical_session_id % does not exist', canonical_session_id;
  end if;

  create temporary table manual_rejected_sessions (
    session_id text primary key
  ) on commit drop;

  insert into manual_rejected_sessions (session_id)
  select rejected_id
  from unnest(rejected_session_ids) rejected_id;

  select count(*)::integer
  into missing_rejected_count
  from manual_rejected_sessions
  left join public.sessions
    on sessions.session_id = manual_rejected_sessions.session_id
  where sessions.session_id is null;

  if missing_rejected_count > 0 then
    raise exception 'one or more rejected_session_ids do not exist';
  end if;

  select count(*)::integer
  into cross_group_count
  from manual_rejected_sessions
  join public.sessions
    on sessions.session_id = manual_rejected_sessions.session_id
  where sessions.assignment_id <> canonical_session.assignment_id
    or sessions.student_anonymous_id <> canonical_session.student_anonymous_id;

  if cross_group_count > 0 then
    raise exception 'all rejected sessions must belong to the same assignment and student as the canonical session';
  end if;

  if (
    select count(*)::integer
    from public.sessions
    where sessions.assignment_id = canonical_session.assignment_id
      and sessions.student_anonymous_id = canonical_session.student_anonymous_id
  ) < 2 then
    raise exception 'canonical session does not belong to a duplicate session group';
  end if;

  for rejected_session in
    select sessions.*
    from manual_rejected_sessions
    join public.sessions
      on sessions.session_id = manual_rejected_sessions.session_id
    order by sessions.updated_at, sessions.created_at, sessions.session_id
  loop
    select jsonb_build_object(
      'session', to_jsonb(rejected_session),
      'chatTurns', coalesce(
        (
          select jsonb_agg(to_jsonb(chat_turns) order by chat_turns.created_at, chat_turns.id)
          from public.chat_turns
          where chat_turns.session_id = rejected_session.session_id
        ),
        '[]'::jsonb
      ),
      'events', coalesce(
        (
          select jsonb_agg(to_jsonb(events) order by events.created_at, events.id)
          from public.events
          where events.session_id = rejected_session.session_id
        ),
        '[]'::jsonb
      ),
      'artifacts', coalesce(
        (
          select jsonb_agg(to_jsonb(artifacts) order by artifacts.created_at, artifacts.id)
          from public.artifacts
          where artifacts.session_id = rejected_session.session_id
        ),
        '[]'::jsonb
      ),
      'measures', coalesce(
        (
          select jsonb_agg(to_jsonb(measures) order by measures.created_at, measures.id)
          from public.measures
          where measures.session_id = rejected_session.session_id
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
      rejected_session.assignment_id,
      rejected_session.class_group_id,
      false,
      'duplicate_session_manual_canonical_choice',
      'manual:009_choose_duplicate_session_canonical',
      jsonb_build_object(
        'reason', 'rejected duplicate locked/submitted session was archived before creating sessions_assignment_student_unique',
        'createdAt', now(),
        'canonicalSessionId', canonical_session.session_id,
        'rejectedSessionId', rejected_session.session_id,
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
      rejected_session.assignment_id,
      rejected_session.class_group_id,
      rejected_session.session_id,
      rejected_session.student_anonymous_id,
      'manual:009_choose_duplicate_session_canonical',
      'duplicate_session_manual_reject',
      true,
      jsonb_build_object(
        'canonicalSessionId', canonical_session.session_id,
        'chatTurnsArchived', jsonb_array_length(raw_snapshot -> 'chatTurns'),
        'eventsArchived', jsonb_array_length(raw_snapshot -> 'events'),
        'artifactsArchived', jsonb_array_length(raw_snapshot -> 'artifacts'),
        'measuresArchived', jsonb_array_length(raw_snapshot -> 'measures'),
        'rawSnapshot', raw_snapshot
      ),
      'Manually rejected duplicate research session before adding sessions_assignment_student_unique.'
    );

    rejected_snapshots := rejected_snapshots || jsonb_build_array(raw_snapshot);

    delete from public.sessions
    where sessions.session_id = rejected_session.session_id;
  end loop;

  select count(*)::integer
  into remaining_duplicate_groups
  from (
    select sessions.assignment_id, sessions.student_anonymous_id
    from public.sessions
    group by sessions.assignment_id, sessions.student_anonymous_id
    having count(*) > 1
  ) duplicates;

  return jsonb_build_object(
    'canonicalSessionId', canonical_session.session_id,
    'rejectedSessionCount', jsonb_array_length(rejected_snapshots),
    'remainingDuplicateGroups', remaining_duplicate_groups,
    'rejectedSnapshots', rejected_snapshots
  );
end;
$$;

create or replace function public.emergency_archive_duplicate_research_sessions_for_unique_index(
  group_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rejected_session record;
  raw_snapshot jsonb;
  archived_session_count integer := 0;
  remaining_duplicate_groups integer := 0;
  archived_groups jsonb := '[]'::jsonb;
begin
  if group_limit is null or group_limit < 1 then
    raise exception 'group_limit must be at least 1';
  end if;
  if group_limit > 100 then
    raise exception 'group_limit must be 100 or less';
  end if;

  perform set_config('lock_timeout', '5000', true);
  perform set_config('statement_timeout', '55000', true);

  lock table
    public.sessions,
    public.chat_turns,
    public.events,
    public.artifacts,
    public.measures,
    public.exports,
    public.deletion_logs
  in exclusive mode;

  create temporary table emergency_duplicate_groups on commit drop as
  select
    sessions.assignment_id,
    sessions.student_anonymous_id
  from public.sessions
  group by sessions.assignment_id, sessions.student_anonymous_id
  having count(*) > 1
  order by sessions.assignment_id, sessions.student_anonymous_id
  limit group_limit;

  create temporary table emergency_duplicate_ranked on commit drop as
  select
    sessions.*,
    first_value(sessions.session_id) over (
      partition by sessions.assignment_id, sessions.student_anonymous_id
      order by
        (sessions.research_locked or sessions.status in ('submitted', 'completed') or sessions.completed_at is not null) desc,
        sessions.completed_at desc nulls last,
        sessions.updated_at desc,
        sessions.created_at desc,
        sessions.session_id desc
    ) as keep_session_id
  from public.sessions
  join emergency_duplicate_groups
    on emergency_duplicate_groups.assignment_id = sessions.assignment_id
    and emergency_duplicate_groups.student_anonymous_id = sessions.student_anonymous_id;

  for rejected_session in
    select emergency_duplicate_ranked.*
    from emergency_duplicate_ranked
    where emergency_duplicate_ranked.session_id <> emergency_duplicate_ranked.keep_session_id
    order by emergency_duplicate_ranked.assignment_id, emergency_duplicate_ranked.student_anonymous_id, emergency_duplicate_ranked.updated_at, emergency_duplicate_ranked.session_id
  loop
    select jsonb_build_object(
      'session', to_jsonb(rejected_session),
      'chatTurns', coalesce(
        (
          select jsonb_agg(to_jsonb(chat_turns) order by chat_turns.created_at, chat_turns.id)
          from public.chat_turns
          where chat_turns.session_id = rejected_session.session_id
        ),
        '[]'::jsonb
      ),
      'events', coalesce(
        (
          select jsonb_agg(to_jsonb(events) order by events.created_at, events.id)
          from public.events
          where events.session_id = rejected_session.session_id
        ),
        '[]'::jsonb
      ),
      'artifacts', coalesce(
        (
          select jsonb_agg(to_jsonb(artifacts) order by artifacts.created_at, artifacts.id)
          from public.artifacts
          where artifacts.session_id = rejected_session.session_id
        ),
        '[]'::jsonb
      ),
      'measures', coalesce(
        (
          select jsonb_agg(to_jsonb(measures) order by measures.created_at, measures.id)
          from public.measures
          where measures.session_id = rejected_session.session_id
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
      rejected_session.assignment_id,
      rejected_session.class_group_id,
      false,
      'duplicate_session_emergency_archive_before_unique_index',
      'manual:009_emergency_archive_duplicate_sessions',
      jsonb_build_object(
        'reason', 'duplicate session was archived during emergency cleanup before class session',
        'createdAt', now(),
        'keepSessionId', rejected_session.keep_session_id,
        'rejectedSessionId', rejected_session.session_id,
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
      rejected_session.assignment_id,
      rejected_session.class_group_id,
      rejected_session.session_id,
      rejected_session.student_anonymous_id,
      'manual:009_emergency_archive_duplicate_sessions',
      'duplicate_session_emergency_archive',
      true,
      jsonb_build_object(
        'keptSessionId', rejected_session.keep_session_id,
        'rawSnapshot', raw_snapshot
      ),
      'Emergency archived duplicate research session before adding sessions_assignment_student_unique.'
    );

    archived_groups := archived_groups || jsonb_build_array(jsonb_build_object(
      'assignmentId', rejected_session.assignment_id,
      'studentAnonymousId', rejected_session.student_anonymous_id,
      'keptSessionId', rejected_session.keep_session_id,
      'archivedSessionId', rejected_session.session_id
    ));

    delete from public.sessions
    where sessions.session_id = rejected_session.session_id;

    archived_session_count := archived_session_count + 1;
  end loop;

  select count(*)::integer
  into remaining_duplicate_groups
  from (
    select sessions.assignment_id, sessions.student_anonymous_id
    from public.sessions
    group by sessions.assignment_id, sessions.student_anonymous_id
    having count(*) > 1
  ) duplicates;

  return jsonb_build_object(
    'archivedSessionCount', archived_session_count,
    'remainingDuplicateGroups', remaining_duplicate_groups,
    'archivedGroups', archived_groups
  );
end;
$$;

revoke all on function public.list_duplicate_research_session_choices() from public;
revoke all on function public.list_all_duplicate_research_session_choices() from public;
revoke all on function public.choose_duplicate_research_session_canonical(text, text[]) from public;
revoke all on function public.emergency_archive_duplicate_research_sessions_for_unique_index(integer) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.list_duplicate_research_session_choices() from anon;
    revoke all on function public.list_all_duplicate_research_session_choices() from anon;
    revoke all on function public.choose_duplicate_research_session_canonical(text, text[]) from anon;
    revoke all on function public.emergency_archive_duplicate_research_sessions_for_unique_index(integer) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.list_duplicate_research_session_choices() from authenticated;
    revoke all on function public.list_all_duplicate_research_session_choices() from authenticated;
    revoke all on function public.choose_duplicate_research_session_canonical(text, text[]) from authenticated;
    revoke all on function public.emergency_archive_duplicate_research_sessions_for_unique_index(integer) from authenticated;
  end if;
end;
$$;
