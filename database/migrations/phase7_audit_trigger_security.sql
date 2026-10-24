-- BYE PRO FINANCE — Phase 7 audit trigger security
-- Audit writes are internal. The trigger needs elevated rights to write audit_logs,
-- while the function must not be callable through the public Data API.

create or replace function public.audit_finance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_entity_id uuid;
begin
  v_user_id := coalesce(new.user_id, old.user_id, (select auth.uid()));
  v_entity_id := coalesce(new.id, old.id);

  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_finance_change() from public, anon, authenticated;
grant execute on function public.audit_finance_change() to service_role;
