-- Durable document-processing queue.
-- This migration only creates queue state and secure claim/finish primitives.
-- No OCR/extraction work is performed by the queue itself.

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null default 'extract_metadata',
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  worker_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint document_processing_jobs_unique_type unique (document_id, job_type),
  constraint document_processing_jobs_owner_match check (user_id is not null)
);

create index if not exists document_processing_jobs_claim_idx
  on public.document_processing_jobs (status, next_attempt_at, lease_until, created_at);
create index if not exists document_processing_jobs_user_idx
  on public.document_processing_jobs (user_id, created_at desc);

create or replace function public.enqueue_document_processing_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.document_processing_jobs (document_id, user_id)
  values (new.id, new.user_id)
  on conflict (document_id, job_type) do nothing;
  return new;
end;
$$;

revoke all on function public.enqueue_document_processing_job() from public, anon, authenticated;

drop trigger if exists documents_enqueue_processing_job on public.documents;
create trigger documents_enqueue_processing_job
after insert on public.documents
for each row execute function public.enqueue_document_processing_job();

alter table public.document_processing_jobs enable row level security;
drop policy if exists document_processing_jobs_own on public.document_processing_jobs;
create policy document_processing_jobs_own
on public.document_processing_jobs
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.document_processing_jobs from public, anon, authenticated;

create or replace function public.claim_document_processing_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns setof public.document_processing_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'WORKER_ID_REQUIRED' using errcode='22023';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_LIMIT' using errcode='22023';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'INVALID_LEASE' using errcode='22023';
  end if;

  return query
  with candidates as (
    select j.id
    from public.document_processing_jobs j
    where j.status = 'pending'
      and j.next_attempt_at <= now()
    order by j.next_attempt_at, j.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.document_processing_jobs j
    set status='processing',
        attempt_count=j.attempt_count+1,
        lease_until=now()+make_interval(secs=>p_lease_seconds),
        worker_id=p_worker_id,
        error_code=null,
        error_message=null,
        updated_at=now()
    from candidates c
    where j.id=c.id
    returning j.*
  )
  select * from claimed order by created_at;
end;
$$;

revoke all on function public.claim_document_processing_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_document_processing_jobs(text, integer, integer) to service_role;

create or replace function public.complete_document_processing_job(
  p_job_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  update public.document_processing_jobs
  set status='completed',
      lease_until=null,
      worker_id=null,
      completed_at=now(),
      updated_at=now()
  where id=p_job_id and status='processing' and worker_id=p_worker_id;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

revoke all on function public.complete_document_processing_job(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_document_processing_job(uuid, text) to service_role;

create or replace function public.fail_document_processing_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text,
  p_retry boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt integer;
  v_updated integer;
  v_delay integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  select attempt_count into v_attempt
  from public.document_processing_jobs
  where id=p_job_id and status='processing' and worker_id=p_worker_id
  for update;

  if not found then
    return false;
  end if;

  v_delay := least(3600, greatest(30, (2 ^ least(v_attempt, 7))::integer * 30));

  update public.document_processing_jobs
  set status=case when p_retry then 'pending' else 'failed' end,
      next_attempt_at=case when p_retry then now()+make_interval(secs=>v_delay) else next_attempt_at end,
      lease_until=null,
      worker_id=null,
      error_code=left(coalesce(p_error_code,'PROCESSING_FAILED'),100),
      error_message=left(coalesce(p_error_message,'Document processing failed'),1000),
      updated_at=now()
  where id=p_job_id;
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;

revoke all on function public.fail_document_processing_job(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.fail_document_processing_job(uuid, text, text, text, boolean) to service_role;

create or replace function public.requeue_expired_document_processing_jobs(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'INVALID_LIMIT' using errcode='22023';
  end if;

  with expired as (
    select id
    from public.document_processing_jobs
    where status='processing' and lease_until is not null and lease_until < now()
    order by lease_until
    for update skip locked
    limit p_limit
  )
  update public.document_processing_jobs j
  set status='pending',
      next_attempt_at=now(),
      lease_until=null,
      worker_id=null,
      error_code='LEASE_EXPIRED',
      error_message='Worker lease expired before completion',
      updated_at=now()
  from expired e
  where j.id=e.id;
  get diagnostics v_updated=row_count;
  return v_updated;
end;
$$;

revoke all on function public.requeue_expired_document_processing_jobs(integer) from public, anon, authenticated;
grant execute on function public.requeue_expired_document_processing_jobs(integer) to service_role;
