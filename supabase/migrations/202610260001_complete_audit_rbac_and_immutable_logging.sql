create schema if not exists private;

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','auditor')),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_roles enable row level security;

create or replace function private.is_admin(check_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.admin_roles ar where ar.user_id = check_user and ar.role in ('owner','admin','auditor')); $$;

create or replace function private.is_owner(check_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.admin_roles ar where ar.user_id = check_user and ar.role = 'owner'); $$;

revoke all on function private.is_admin(uuid) from public;
revoke all on function private.is_owner(uuid) from public;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;

create policy admin_roles_select_self_or_admin on public.admin_roles
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy admin_roles_insert_owner on public.admin_roles
  for insert to authenticated with check (private.is_owner() and granted_by = (select auth.uid()));
create policy admin_roles_update_owner on public.admin_roles
  for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy admin_roles_delete_owner on public.admin_roles
  for delete to authenticated using (private.is_owner());

alter table public.audit_logs enable row level security;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated using (private.is_admin());
revoke insert, update, delete on public.audit_logs from anon, authenticated;

create or replace function private.audit_row_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor uuid; entity uuid;
begin
  actor := auth.uid();
  entity := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (actor, lower(tg_op) || '_' || tg_table_name, tg_table_name, entity,
          jsonb_build_object('operation', tg_op, 'table', tg_table_name));
  return case when tg_op = 'DELETE' then old else new end;
end; $$;
revoke all on function private.audit_row_change() from public;

do $$ declare t text; begin
  foreach t in array array['accounts','transactions','transfers','budgets','debts','bills','savings_goals','assets','documents','notifications','user_settings','profiles'] loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function private.audit_row_change()', t, t);
  end loop;
end $$;

create or replace function private.reject_audit_mutation()
returns trigger language plpgsql
as $$ begin raise exception 'AUDIT_LOG_IMMUTABLE'; end; $$;
drop trigger if exists trg_audit_logs_immutable on public.audit_logs;
create trigger trg_audit_logs_immutable before update or delete on public.audit_logs for each row execute function private.reject_audit_mutation();

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

revoke all on public.admin_roles from anon;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.admin_roles to authenticated;

create policy profiles_select_admin on public.profiles for select to authenticated using (private.is_admin());
