update public.students
set initial_password = null
where initial_password is not null;

update public.teachers
set initial_password = null
where initial_password is not null;

create or replace function public.apply_roster_mutation(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
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
    coalesce((payload #>> '{snapshot,anonymized}')::boolean, false),
    nullif(payload #>> '{snapshot,assignment_id}', ''),
    nullif(payload #>> '{snapshot,class_group_id}', ''),
    coalesce((payload #>> '{snapshot,completed_only}')::boolean, false),
    coalesce(payload #>> '{snapshot,export_kind}', 'app_roster_snapshot'),
    nullif(payload #>> '{snapshot,generated_by_teacher_id}', ''),
    coalesce(payload #> '{snapshot,payload}', '{}'::jsonb)
  );

  delete from public.students
  where id in (
    select jsonb_array_elements_text(coalesce(payload -> 'deletedStudentIds', '[]'::jsonb))
  );

  delete from public.students
  where class_group_id in (
    select jsonb_array_elements_text(coalesce(payload -> 'deletedClassIds', '[]'::jsonb))
  );

  delete from public.assignments
  where id in (
    select jsonb_array_elements_text(coalesce(payload -> 'deletedAssignmentIds', '[]'::jsonb))
  );

  delete from public.classes
  where id in (
    select jsonb_array_elements_text(coalesce(payload -> 'deletedClassIds', '[]'::jsonb))
  );

  delete from public.teachers
  where id in (
    select jsonb_array_elements_text(coalesce(payload -> 'deletedTeacherIds', '[]'::jsonb))
  );

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'teachersWithPasswords', '[]'::jsonb))
  loop
    insert into public.teachers (id, display_name, login_id, password_hash, initial_password, updated_at)
    values (item ->> 'id', item ->> 'display_name', item ->> 'login_id', item ->> 'password_hash', null, now())
    on conflict (id) do update set
      display_name = excluded.display_name,
      login_id = excluded.login_id,
      password_hash = excluded.password_hash,
      initial_password = null,
      updated_at = now();
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'teachersWithoutPasswords', '[]'::jsonb))
  loop
    update public.teachers
    set
      display_name = item ->> 'display_name',
      login_id = item ->> 'login_id',
      initial_password = null,
      updated_at = now()
    where id = item ->> 'id';
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'classes', '[]'::jsonb))
  loop
    insert into public.classes (id, name, teacher_id, updated_at)
    values (item ->> 'id', item ->> 'name', item ->> 'teacher_id', now())
    on conflict (id) do update set
      name = excluded.name,
      teacher_id = excluded.teacher_id,
      updated_at = now();
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'assignments', '[]'::jsonb))
  loop
    insert into public.assignments (
      id,
      class_group_id,
      created_by_teacher_id,
      title,
      research_mode,
      research_condition,
      assignment,
      updated_at
    )
    values (
      item ->> 'id',
      nullif(item ->> 'class_group_id', ''),
      item ->> 'created_by_teacher_id',
      item ->> 'title',
      item ->> 'research_mode',
      item ->> 'research_condition',
      coalesce(item -> 'assignment', '{}'::jsonb),
      now()
    )
    on conflict (id) do update set
      class_group_id = excluded.class_group_id,
      created_by_teacher_id = excluded.created_by_teacher_id,
      title = excluded.title,
      research_mode = excluded.research_mode,
      research_condition = excluded.research_condition,
      assignment = excluded.assignment,
      updated_at = now();
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'studentsWithPasswords', '[]'::jsonb))
  loop
    insert into public.students (
      id,
      class_group_id,
      display_label,
      initial_participant_code,
      initial_password,
      login_id,
      participant_code_hash,
      password_hash,
      student_anonymous_id,
      student_number,
      updated_at
    )
    values (
      item ->> 'id',
      item ->> 'class_group_id',
      nullif(item ->> 'display_label', ''),
      nullif(item ->> 'initial_participant_code', ''),
      null,
      nullif(item ->> 'login_id', ''),
      item ->> 'participant_code_hash',
      item ->> 'password_hash',
      item ->> 'student_anonymous_id',
      (item ->> 'student_number')::integer,
      now()
    )
    on conflict (id) do update set
      class_group_id = excluded.class_group_id,
      display_label = excluded.display_label,
      initial_participant_code = excluded.initial_participant_code,
      initial_password = null,
      login_id = excluded.login_id,
      participant_code_hash = excluded.participant_code_hash,
      password_hash = excluded.password_hash,
      student_anonymous_id = excluded.student_anonymous_id,
      student_number = excluded.student_number,
      updated_at = now();
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'studentsWithoutPasswords', '[]'::jsonb))
  loop
    update public.students
    set
      class_group_id = item ->> 'class_group_id',
      display_label = nullif(item ->> 'display_label', ''),
      initial_participant_code = nullif(item ->> 'initial_participant_code', ''),
      initial_password = null,
      login_id = nullif(item ->> 'login_id', ''),
      participant_code_hash = item ->> 'participant_code_hash',
      student_anonymous_id = item ->> 'student_anonymous_id',
      student_number = (item ->> 'student_number')::integer,
      updated_at = now()
    where id = item ->> 'id';
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.delete_research_test_data(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session_ids text[] := array[]::text[];
  deleted_artifacts integer := 0;
  deleted_chat_turns integer := 0;
  deleted_events integer := 0;
  deleted_measures integer := 0;
  deleted_sessions integer := 0;
  log_id text;
begin
  select coalesce(array_agg(session_id), array[]::text[])
  into target_session_ids
  from public.sessions
  where (
      payload ->> 'scope' <> 'current_session'
      or session_id = payload ->> 'sessionId'
    )
    and (
      payload ->> 'scope' <> 'student'
      or student_anonymous_id = payload ->> 'studentAnonymousId'
    )
    and (
      payload ->> 'scope' <> 'assignment'
      or assignment_id = payload ->> 'assignmentId'
    )
    and (
      payload ->> 'classGroupId' is null
      or class_group_id = payload ->> 'classGroupId'
    );

  if exists (
    select 1
    from public.sessions
    where session_id = any(target_session_ids)
      and research_locked
  ) then
    raise exception 'locked research data cannot be deleted';
  end if;

  delete from public.artifacts
  where session_id = any(target_session_ids);
  get diagnostics deleted_artifacts = row_count;

  delete from public.chat_turns
  where session_id = any(target_session_ids);
  get diagnostics deleted_chat_turns = row_count;

  delete from public.events
  where session_id = any(target_session_ids);
  get diagnostics deleted_events = row_count;

  delete from public.measures
  where session_id = any(target_session_ids);
  get diagnostics deleted_measures = row_count;

  delete from public.sessions
  where session_id = any(target_session_ids);
  get diagnostics deleted_sessions = row_count;

  insert into public.deletion_logs (
    assignment_id,
    class_group_id,
    counts,
    deleted_by,
    deletion_scope,
    exported_before_delete,
    reason,
    session_id,
    student_anonymous_id
  )
  values (
    nullif(payload ->> 'assignmentId', ''),
    nullif(payload ->> 'classGroupId', ''),
    jsonb_build_object(
      'artifacts', deleted_artifacts,
      'chat_turns', deleted_chat_turns,
      'events', deleted_events,
      'measures', deleted_measures,
      'sessions', deleted_sessions
    ),
    nullif(payload ->> 'teacherId', ''),
    payload ->> 'scope',
    true,
    nullif(payload ->> 'reason', ''),
    nullif(payload ->> 'sessionId', ''),
    nullif(payload ->> 'studentAnonymousId', '')
  )
  returning id into log_id;

  return jsonb_build_object(
    'deleted',
    jsonb_build_object(
      'artifacts', deleted_artifacts,
      'chat_turns', deleted_chat_turns,
      'events', deleted_events,
      'measures', deleted_measures,
      'sessions', deleted_sessions
    ),
    'logId',
    log_id
  );
end;
$$;

create or replace function public.ensure_session_child_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row record;
begin
  select class_group_id, assignment_id, student_anonymous_id
  into session_row
  from public.sessions
  where session_id = new.session_id;

  if not found then
    raise exception 'child row references unknown session %', new.session_id;
  end if;

  if new.class_group_id is distinct from session_row.class_group_id
    or new.assignment_id is distinct from session_row.assignment_id
    or new.student_anonymous_id is distinct from session_row.student_anonymous_id then
    raise exception 'child row context does not match session %', new.session_id;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_turns_session_child_context on public.chat_turns;
create trigger chat_turns_session_child_context
before insert or update of session_id, class_group_id, assignment_id, student_anonymous_id
on public.chat_turns
for each row execute function public.ensure_session_child_context();

drop trigger if exists events_session_child_context on public.events;
create trigger events_session_child_context
before insert or update of session_id, class_group_id, assignment_id, student_anonymous_id
on public.events
for each row execute function public.ensure_session_child_context();

drop trigger if exists artifacts_session_child_context on public.artifacts;
create trigger artifacts_session_child_context
before insert or update of session_id, class_group_id, assignment_id, student_anonymous_id
on public.artifacts
for each row execute function public.ensure_session_child_context();

drop trigger if exists measures_session_child_context on public.measures;
create trigger measures_session_child_context
before insert or update of session_id, class_group_id, assignment_id, student_anonymous_id
on public.measures
for each row execute function public.ensure_session_child_context();
