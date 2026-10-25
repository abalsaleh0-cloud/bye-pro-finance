create or replace function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE';
end;
$$;

revoke all on function private.reject_audit_mutation() from public, anon, authenticated;
