create table if not exists public.ai_request_buckets (
  principal_kind text not null,
  principal_id text not null,
  bucket_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (principal_kind, principal_id, bucket_start)
);

alter table public.ai_request_buckets enable row level security;

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
  if request_limit <= 0 then
    raise exception 'request limit must be positive';
  end if;

  insert into public.ai_request_buckets (principal_kind, principal_id, bucket_start, request_count, updated_at)
  values (principal_kind, principal_id, bucket, 1, now())
  on conflict (principal_kind, principal_id, bucket_start) do update
    set request_count = public.ai_request_buckets.request_count + 1,
        updated_at = now()
    where public.ai_request_buckets.request_count < request_limit
  returning request_count into next_count;

  if next_count is null then
    select request_count
    into next_count
    from public.ai_request_buckets
    where ai_request_buckets.principal_kind = reserve_ai_request.principal_kind
      and ai_request_buckets.principal_id = reserve_ai_request.principal_id
      and ai_request_buckets.bucket_start = bucket;
    return jsonb_build_object('allowed', false, 'count', coalesce(next_count, request_limit));
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
    'version', '011_ai_request_quota',
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
    )
  );
$$;
