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
    insert into public.teachers (id, display_name, login_id, password_hash, updated_at)
    values (item ->> 'id', item ->> 'display_name', item ->> 'login_id', item ->> 'password_hash', now())
    on conflict (id) do update set
      display_name = excluded.display_name,
      login_id = excluded.login_id,
      password_hash = excluded.password_hash,
      updated_at = now();
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'teachersWithoutPasswords', '[]'::jsonb))
  loop
    update public.teachers
    set
      display_name = item ->> 'display_name',
      login_id = item ->> 'login_id',
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

alter table public.students drop column if exists initial_password;
alter table public.teachers drop column if exists initial_password;

create or replace function public.research_schema_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', '007_remove_plaintext_roster_passwords',
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
    )
  );
$$;
