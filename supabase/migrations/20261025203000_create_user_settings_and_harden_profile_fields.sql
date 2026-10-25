create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  locale text not null default 'ar' check (locale in ('ar','en')),
  timezone text not null default 'Africa/Tripoli',
  currency_code text not null default 'LYD' check (currency_code in ('LYD','USD','EUR','GBP','SAR','AED','EGP')),
  date_format text not null default 'YYYY-MM-DD' check (date_format in ('YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY')),
  number_format text not null default '1,234.56' check (number_format in ('1,234.56','1.234,56','1 234,56')),
  email_notifications boolean not null default true,
  transaction_alerts boolean not null default true,
  bill_reminders boolean not null default true,
  budget_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_select_own on public.user_settings;
drop policy if exists user_settings_insert_own on public.user_settings;
drop policy if exists user_settings_update_own on public.user_settings;
drop policy if exists user_settings_delete_own on public.user_settings;
create policy user_settings_select_own on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy user_settings_insert_own on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_settings_update_own on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_settings_delete_own on public.user_settings for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;

create or replace function public.touch_user_settings_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at before update on public.user_settings for each row execute function public.touch_user_settings_updated_at();

insert into public.user_settings (user_id)
select id from auth.users
where not exists (select 1 from public.user_settings us where us.user_id = auth.users.id)
on conflict (user_id) do nothing;

create or replace function public.handle_new_user_settings()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.user_settings (user_id, locale, currency_code)
  values (
    new.id,
    case when coalesce(new.raw_user_meta_data->>'locale','ar') = 'en' then 'en' else 'ar' end,
    case when coalesce(new.raw_user_meta_data->>'currency_code','LYD') in ('LYD','USD','EUR','GBP','SAR','AED','EGP') then coalesce(new.raw_user_meta_data->>'currency_code','LYD') else 'LYD' end
  ) on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created_user_settings on auth.users;
create trigger on_auth_user_created_user_settings after insert on auth.users for each row execute function public.handle_new_user_settings();
revoke execute on function public.handle_new_user_settings() from public, anon, authenticated;
grant execute on function public.handle_new_user_settings() to service_role;
