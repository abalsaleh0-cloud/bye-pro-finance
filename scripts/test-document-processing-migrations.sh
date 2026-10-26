#!/usr/bin/env bash
set -euo pipefail

container="bye-pro-finance-migration-test-$RANDOM"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --name "$container" \
  --env POSTGRES_PASSWORD=test \
  --env POSTGRES_DB=finance_test \
  postgres:16-alpine >/dev/null

ready=false
for _ in $(seq 1 45); do
  if docker exec "$container" pg_isready -U postgres -d finance_test >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo "PostgreSQL test container did not become ready" >&2
  exit 1
fi

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d finance_test <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (id uuid primary key);

create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create function auth.role()
returns text
language sql
stable
as $
  select auth.jwt() ->> 'role';
$;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
SQL

for migration in \
  supabase/migrations/20261026130000_document_processing_queue.sql \
  supabase/migrations/20261026131500_document_processing_retry_cap.sql \
  supabase/migrations/20261026133000_document_processing_retry_cap.sql; do
  echo "Applying $migration to disposable PostgreSQL"
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d finance_test < "$migration"
done

docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d finance_test <<'SQL'
insert into auth.users (id) values ('11111111-1111-4111-8111-111111111111');

-- The queue is not a client-readable table, and only service_role can execute RPCs.
do $$
begin
  if has_table_privilege('anon', 'public.document_processing_jobs', 'select')
    or has_table_privilege('authenticated', 'public.document_processing_jobs', 'select') then
    raise exception 'Client roles unexpectedly have queue table SELECT access';
  end if;
  if has_function_privilege('anon', 'public.claim_document_processing_jobs(text,integer,integer)', 'execute')
    or has_function_privilege('authenticated', 'public.claim_document_processing_jobs(text,integer,integer)', 'execute') then
    raise exception 'Client roles unexpectedly can execute the claim RPC';
  end if;
  if not has_function_privilege('service_role', 'public.claim_document_processing_jobs(text,integer,integer)', 'execute') then
    raise exception 'service_role cannot execute the claim RPC';
  end if;
end;
$$;

-- A non-service JWT role must be rejected even if it can reach the function through a privileged SQL caller.
select set_config('request.jwt.claims', '{"role":"authenticated"}', false);
do $$
begin
  begin
    perform public.claim_document_processing_jobs('unauthorized-worker', 1, 300);
    raise exception 'Expected non-service role to be rejected';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"role":"service_role"}', false);

-- Document insertion enqueues exactly one owner-bound job.
insert into public.documents (id, user_id, file_name, storage_path, mime_type, file_size, metadata)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'receipt.pdf', '11111111-1111-4111-8111-111111111111/receipt.pdf',
  'application/pdf', 1024, '{"source":"integration-test"}'::jsonb
);

do $$
declare
  v_count integer;
  v_job_id uuid;
  v_completed boolean;
begin
  select count(*) into v_count
  from public.document_processing_jobs
  where document_id='22222222-2222-4222-8222-222222222222'
    and user_id='11111111-1111-4111-8111-111111111111'
    and status='pending';
  if v_count <> 1 then raise exception 'Expected one pending owner-bound job, got %', v_count; end if;

  select id into v_job_id
  from public.claim_document_processing_jobs('ci-worker', 10, 300);
  if v_job_id is null then raise exception 'Claim RPC did not return the queued job'; end if;

  v_completed := public.complete_document_processing_job(v_job_id, 'wrong-worker');
  if v_completed then raise exception 'A different worker completed a leased job'; end if;

  v_completed := public.complete_document_processing_job(v_job_id, 'ci-worker');
  if not v_completed then raise exception 'Owning worker could not complete its job'; end if;

  select count(*) into v_count
  from public.document_processing_jobs
  where id=v_job_id and status='completed' and lease_until is null and worker_id is null;
  if v_count <> 1 then raise exception 'Completed job did not reach the expected terminal state'; end if;
end;
$$;

-- Expired leases obey the same eight-attempt cap as ordinary failures.
insert into public.documents (id, user_id, file_name, storage_path, mime_type, file_size)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'expired.pdf', '11111111-1111-4111-8111-111111111111/expired.pdf',
  'application/pdf', 2048
);

do $$
declare
  v_job_id uuid;
  v_count integer;
begin
  select id into v_job_id
  from public.claim_document_processing_jobs('dead-worker', 10, 300)
  where document_id='33333333-3333-4333-8333-333333333333';
  if v_job_id is null then raise exception 'Expired-lease test job was not claimed'; end if;

  update public.document_processing_jobs
  set attempt_count=8, lease_until=now()-interval '1 minute'
  where id=v_job_id;

  v_count := public.requeue_expired_document_processing_jobs(100);
  if v_count <> 1 then raise exception 'Expected one expired job to be handled, got %', v_count; end if;

  select count(*) into v_count
  from public.document_processing_jobs
  where id=v_job_id and status='failed' and error_code='MAX_ATTEMPTS_EXCEEDED'
    and lease_until is null and worker_id is null;
  if v_count <> 1 then raise exception 'Expired lease exceeded the retry budget'; end if;
end;
$$;

-- Ordinary transient failures retry with a bounded delay; the final attempt is terminal.
insert into public.documents (id, user_id, file_name, storage_path, mime_type, file_size)
values (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'retry.pdf', '11111111-1111-4111-8111-111111111111/retry.pdf',
  'application/pdf', 512
);

do $$
declare
  v_job_id uuid;
  v_ok boolean;
  v_count integer;
begin
  select id into v_job_id
  from public.claim_document_processing_jobs('retry-worker', 10, 300)
  where document_id='44444444-4444-4444-8444-444444444444';
  if v_job_id is null then raise exception 'Retry test job was not claimed'; end if;

  v_ok := public.fail_document_processing_job(v_job_id, 'retry-worker', 'TRANSIENT_TEST', 'synthetic transient failure', true);
  if not v_ok then raise exception 'Failure RPC did not acknowledge the active lease'; end if;

  select count(*) into v_count
  from public.document_processing_jobs
  where id=v_job_id and status='pending' and next_attempt_at > now()
    and lease_until is null and worker_id is null and error_code='TRANSIENT_TEST';
  if v_count <> 1 then raise exception 'Transient failure was not safely rescheduled'; end if;

  update public.document_processing_jobs
  set status='processing', worker_id='last-worker', attempt_count=8, lease_until=now()+interval '1 minute'
  where id=v_job_id;

  v_ok := public.fail_document_processing_job(v_job_id, 'last-worker', 'LAST_ATTEMPT', 'synthetic final failure', true);
  if not v_ok then raise exception 'Final failure RPC did not acknowledge the active lease'; end if;

  select count(*) into v_count
  from public.document_processing_jobs
  where id=v_job_id and status='failed' and error_code='LAST_ATTEMPT'
    and lease_until is null and worker_id is null;
  if v_count <> 1 then raise exception 'Retry cap did not terminate the final failed attempt'; end if;
end;
$$;

select 'document-processing migrations integration checks passed' as result;
SQL
