create table if not exists public.mobile_runtime_config (
  id smallint primary key default 1 check (id = 1),
  schema_version integer not null default 1 check (schema_version = 1),
  config_version integer not null default 1 check (config_version > 0),
  minimum_supported_version_code integer not null default 0 check (minimum_supported_version_code >= 0),
  maintenance_mode boolean not null default false,
  maintenance_message_ar text not null default '',
  maintenance_message_en text not null default '',
  features jsonb not null default '{"remote_announcements":true,"remote_ui_text":true,"experimental_features":false}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.mobile_runtime_config enable row level security;

drop policy if exists mobile_runtime_config_public_read on public.mobile_runtime_config;
create policy mobile_runtime_config_public_read
  on public.mobile_runtime_config for select to anon, authenticated
  using (true);

drop policy if exists mobile_runtime_config_owner_insert on public.mobile_runtime_config;
create policy mobile_runtime_config_owner_insert
  on public.mobile_runtime_config for insert to authenticated
  with check (private.is_owner() and updated_by = (select auth.uid()));

drop policy if exists mobile_runtime_config_owner_update on public.mobile_runtime_config;
create policy mobile_runtime_config_owner_update
  on public.mobile_runtime_config for update to authenticated
  using (private.is_owner())
  with check (private.is_owner() and updated_by = (select auth.uid()));

revoke all on public.mobile_runtime_config from anon, authenticated;
grant select on public.mobile_runtime_config to anon, authenticated;
grant insert, update on public.mobile_runtime_config to authenticated;

insert into public.mobile_runtime_config (id)
values (1)
on conflict (id) do nothing;
