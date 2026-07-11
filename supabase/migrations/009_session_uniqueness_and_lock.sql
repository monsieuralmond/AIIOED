begin;

lock table
  public.sessions,
  public.chat_turns,
  public.events,
  public.artifacts,
  public.measures,
  public.exports,
  public.deletion_logs
in exclusive mode;

create temporary table duplicate_session_repairs on commit drop as
with ranked_sessions as (
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
  from public.sessions
),
repair_candidates as (
  select
    ranked_sessions.session_id as old_session_id,
    keep_session.session_id as keep_session_id,
    ranked_sessions.class_group_id as old_class_group_id,
    keep_session.class_group_id as keep_class_group_id,
    ranked_sessions.assignment_id,
    ranked_sessions.student_anonymous_id,
    ranked_sessions.current_stage,
    ranked_sessions.status,
    ranked_sessions.research_mode,
    ranked_sessions.research_condition,
    ranked_sessions.assignment_snapshot,
    ranked_sessions.metadata,
    ranked_sessions.research_locked,
    ranked_sessions.created_at,
    ranked_sessions.updated_at,
    ranked_sessions.completed_at,
    ranked_sessions.locked_research_session_count,
    (keep_session.research_locked or keep_session.status in ('submitted', 'completed') or keep_session.completed_at is not null) as keep_session_locked,
    (select count(*) from public.chat_turns where chat_turns.session_id = ranked_sessions.session_id) as chat_turn_count,
    (select count(*) from public.events where events.session_id = ranked_sessions.session_id) as event_count,
    (select count(*) from public.artifacts where artifacts.session_id = ranked_sessions.session_id) as artifact_count,
    (select count(*) from public.measures where measures.session_id = ranked_sessions.session_id) as measure_count
  from ranked_sessions
  join public.sessions keep_session
    on keep_session.session_id = ranked_sessions.keep_session_id
  where ranked_sessions.duplicate_session_count > 1
    and ranked_sessions.session_id <> ranked_sessions.keep_session_id
)
select * from repair_candidates;

do $$
begin
  if exists (
    select 1
    from duplicate_session_repairs
    where locked_research_session_count > 1
  ) then
    raise exception 'duplicate research sessions include multiple locked/submitted rows for the same assignment and student; export those rows and manually choose the canonical session before rerunning migration 009';
  end if;

  if exists (
    select 1
    from duplicate_session_repairs
    where keep_session_locked
      and chat_turn_count + event_count + artifact_count + measure_count > 0
  ) then
    raise exception 'duplicate research sessions include child rows that would have to be merged into a locked/submitted session; export those rows and manually choose the canonical session before rerunning migration 009';
  end if;
end;
$$;

create temporary table duplicate_session_raw_snapshots on commit drop as
select
  repairs.old_session_id,
  repairs.keep_session_id,
  jsonb_build_object(
    'session', to_jsonb(old_session),
    'chatTurns', coalesce(
      (
        select jsonb_agg(to_jsonb(chat_turns) order by chat_turns.created_at, chat_turns.id)
        from public.chat_turns
        where chat_turns.session_id = repairs.old_session_id
      ),
      '[]'::jsonb
    ),
    'events', coalesce(
      (
        select jsonb_agg(to_jsonb(events) order by events.created_at, events.id)
        from public.events
        where events.session_id = repairs.old_session_id
      ),
      '[]'::jsonb
    ),
    'artifacts', coalesce(
      (
        select jsonb_agg(to_jsonb(artifacts) order by artifacts.created_at, artifacts.id)
        from public.artifacts
        where artifacts.session_id = repairs.old_session_id
      ),
      '[]'::jsonb
    ),
    'measures', coalesce(
      (
        select jsonb_agg(to_jsonb(measures) order by measures.created_at, measures.id)
        from public.measures
        where measures.session_id = repairs.old_session_id
      ),
      '[]'::jsonb
    )
  ) as raw_snapshot
from duplicate_session_repairs repairs
join public.sessions old_session
  on old_session.session_id = repairs.old_session_id;

create temporary table duplicate_session_request_id_rewrites (
  old_session_id text not null,
  keep_session_id text not null,
  chat_turn_id text not null,
  original_request_id text not null,
  rewritten_request_id text not null
) on commit drop;

insert into public.exports (
  anonymized,
  assignment_id,
  class_group_id,
  completed_only,
  export_kind,
  generated_by_teacher_id,
  payload
)
select
  false,
  null,
  null,
  false,
  'duplicate_sessions_pre_uniqueness_repair',
  'migration:009_session_uniqueness_and_lock',
  jsonb_build_object(
    'reason', 'duplicate sessions were merged before creating sessions_assignment_student_unique',
    'createdAt', now(),
    'sessions', coalesce(
      (
        select jsonb_agg(to_jsonb(sessions) order by sessions.assignment_id, sessions.student_anonymous_id, sessions.updated_at desc, sessions.session_id)
        from public.sessions
        where exists (
          select 1
          from public.sessions duplicates
          where duplicates.assignment_id = sessions.assignment_id
            and duplicates.student_anonymous_id = sessions.student_anonymous_id
            and duplicates.session_id <> sessions.session_id
        )
      ),
      '[]'::jsonb
    ),
    'chatTurns', coalesce(
      (
        select jsonb_agg(to_jsonb(chat_turns) order by chat_turns.session_id, chat_turns.created_at, chat_turns.id)
        from public.chat_turns
        where exists (
          select 1
          from public.sessions duplicate_sessions
          where duplicate_sessions.session_id = chat_turns.session_id
            and exists (
              select 1
              from public.sessions duplicates
              where duplicates.assignment_id = duplicate_sessions.assignment_id
                and duplicates.student_anonymous_id = duplicate_sessions.student_anonymous_id
                and duplicates.session_id <> duplicate_sessions.session_id
            )
        )
      ),
      '[]'::jsonb
    ),
    'events', coalesce(
      (
        select jsonb_agg(to_jsonb(events) order by events.session_id, events.created_at, events.id)
        from public.events
        where exists (
          select 1
          from public.sessions duplicate_sessions
          where duplicate_sessions.session_id = events.session_id
            and exists (
              select 1
              from public.sessions duplicates
              where duplicates.assignment_id = duplicate_sessions.assignment_id
                and duplicates.student_anonymous_id = duplicate_sessions.student_anonymous_id
                and duplicates.session_id <> duplicate_sessions.session_id
            )
        )
      ),
      '[]'::jsonb
    ),
    'artifacts', coalesce(
      (
        select jsonb_agg(to_jsonb(artifacts) order by artifacts.session_id, artifacts.created_at, artifacts.id)
        from public.artifacts
        where exists (
          select 1
          from public.sessions duplicate_sessions
          where duplicate_sessions.session_id = artifacts.session_id
            and exists (
              select 1
              from public.sessions duplicates
              where duplicates.assignment_id = duplicate_sessions.assignment_id
                and duplicates.student_anonymous_id = duplicate_sessions.student_anonymous_id
                and duplicates.session_id <> duplicate_sessions.session_id
            )
        )
      ),
      '[]'::jsonb
    ),
    'measures', coalesce(
      (
        select jsonb_agg(to_jsonb(measures) order by measures.session_id, measures.created_at, measures.id)
        from public.measures
        where exists (
          select 1
          from public.sessions duplicate_sessions
          where duplicate_sessions.session_id = measures.session_id
            and exists (
              select 1
              from public.sessions duplicates
              where duplicates.assignment_id = duplicate_sessions.assignment_id
                and duplicates.student_anonymous_id = duplicate_sessions.student_anonymous_id
                and duplicates.session_id <> duplicate_sessions.session_id
            )
        )
      ),
      '[]'::jsonb
    )
  )
where exists (select 1 from duplicate_session_repairs);

do $$
declare
  repair duplicate_session_repairs%rowtype;
  snapshot duplicate_session_raw_snapshots%rowtype;
  turn public.chat_turns%rowtype;
  merged_request_id text;
  rewrite_counter integer;
begin
  for repair in
    select * from duplicate_session_repairs
    order by assignment_id, student_anonymous_id, updated_at, old_session_id
  loop
    select * into snapshot
    from duplicate_session_raw_snapshots
    where old_session_id = repair.old_session_id;

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
      'migration:009_session_uniqueness_and_lock',
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
        'rawSnapshot', snapshot.raw_snapshot
      ),
      'Merged duplicate research session before adding sessions_assignment_student_unique.'
    );

    delete from public.sessions
    where session_id = repair.old_session_id;
  end loop;
end;
$$;

do $$
begin
  if exists (
    select assignment_id, student_anonymous_id
    from public.sessions
    group by assignment_id, student_anonymous_id
    having count(*) > 1
  ) then
    raise exception 'duplicate research sessions still exist after migration 009 repair; inspect duplicate_session_merge deletion logs before retrying';
  end if;
end;
$$;

create unique index if not exists sessions_assignment_student_unique
  on public.sessions(assignment_id, student_anonymous_id);

commit;
