create or replace function public.reserve_ai_request(
  principal_kind text,
  principal_id text,
  request_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz := date_trunc('minute', now());
  next_count integer;
begin
  if reserve_ai_request.request_limit <= 0 then
    raise exception 'request limit must be positive';
  end if;

  insert into public.ai_request_buckets (principal_kind, principal_id, bucket_start, request_count, updated_at)
  values (reserve_ai_request.principal_kind, reserve_ai_request.principal_id, bucket, 1, now())
  on conflict on constraint ai_request_buckets_pkey do update
    set request_count = public.ai_request_buckets.request_count + 1,
        updated_at = now()
    where public.ai_request_buckets.request_count < reserve_ai_request.request_limit
  returning request_count into next_count;

  if next_count is null then
    select public.ai_request_buckets.request_count
    into next_count
    from public.ai_request_buckets
    where public.ai_request_buckets.principal_kind = reserve_ai_request.principal_kind
      and public.ai_request_buckets.principal_id = reserve_ai_request.principal_id
      and public.ai_request_buckets.bucket_start = bucket;
    return jsonb_build_object('allowed', false, 'count', coalesce(next_count, reserve_ai_request.request_limit));
  end if;

  return jsonb_build_object('allowed', true, 'count', next_count);
end;
$$;

revoke all on function public.reserve_ai_request(text, text, integer) from public;
revoke all on function public.reserve_ai_request(text, text, integer) from anon;
revoke all on function public.reserve_ai_request(text, text, integer) from authenticated;
grant execute on function public.reserve_ai_request(text, text, integer) to service_role;

create or replace function public.research_schema_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version', '014_fix_ai_request_quota_ambiguity',
    'plaintext_password_columns_removed', not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name in ('students', 'teachers') and column_name = 'initial_password'
    ),
    'apply_roster_mutation_available', exists (
      select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public' and pg_proc.proname = 'apply_roster_mutation'
    ),
    'delete_research_test_data_available', exists (
      select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public' and pg_proc.proname = 'delete_research_test_data'
    ),
    'sync_research_session_available', exists (
      select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public' and pg_proc.proname = 'sync_research_session'
    ),
    'session_uniqueness_available', exists (
      select 1 from pg_indexes
      where schemaname = 'public' and indexname = 'sessions_assignment_student_unique'
    ),
    'ai_request_quota_available', exists (
      select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public' and pg_proc.proname = 'reserve_ai_request'
    ),
    'reset_research_session_available', exists (
      select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public' and pg_proc.proname = 'reset_research_session'
    ),
    'reset_research_session_archives_before_delete', exists (
      select 1
      from pg_proc
      join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
      where pg_namespace.nspname = 'public'
        and pg_proc.proname = 'reset_research_session'
        and pg_get_functiondef(pg_proc.oid) ilike '%session_reset_pre_delete%'
    ),
    'ai_request_quota_ambiguity_fixed', true
  );
$$;

revoke all on function public.research_schema_health() from public;
revoke all on function public.research_schema_health() from anon;
revoke all on function public.research_schema_health() from authenticated;
grant execute on function public.research_schema_health() to service_role;
