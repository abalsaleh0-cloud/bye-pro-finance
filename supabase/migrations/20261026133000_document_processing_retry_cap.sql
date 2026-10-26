-- Tighten the durable document queue with an explicit retry cap.
-- This migration changes retry semantics only; it does not process documents.

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
  v_retry boolean;
  v_max_attempts constant integer := 8;
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

  v_retry := p_retry and v_attempt < v_max_attempts;
  v_delay := least(3600, greatest(30, (2 ^ least(v_attempt, 7))::integer * 30));

  update public.document_processing_jobs
  set status=case when v_retry then 'pending' else 'failed' end,
      next_attempt_at=case when v_retry then now()+make_interval(secs=>v_delay) else next_attempt_at end,
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
