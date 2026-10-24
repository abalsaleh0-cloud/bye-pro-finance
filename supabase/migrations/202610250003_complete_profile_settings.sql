-- Complete profile settings: persisted profile fields, cooldown enforcement, and private avatar uploads.
alter table public.profiles
  add column if not exists full_name_changed_at timestamptz,
  add column if not exists username_changed_at timestamptz;

alter table public.profiles alter column full_name set default '';
update public.profiles set full_name = '' where full_name is null;
alter table public.profiles alter column full_name set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,24}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_currency_code_format' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_currency_code_format check (currency_code ~ '^[A-Z]{3}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_locale_supported' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_locale_supported check (locale in ('ar','en'));
  end if;
end $$;

create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;

create or replace function public.enforce_profile_change_windows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.full_name is distinct from old.full_name then
      if old.full_name_changed_at is not null and old.full_name_changed_at > now() - interval '30 days' then
        raise exception 'Full name can only be changed every 30 days' using errcode = 'P0001';
      end if;
      new.full_name_changed_at := now();
    else
      new.full_name_changed_at := old.full_name_changed_at;
    end if;

    if new.username is distinct from old.username then
      if old.username_changed_at is not null and old.username_changed_at > now() - interval '60 days' then
        raise exception 'Username can only be changed every 60 days' using errcode = 'P0001';
      end if;
      new.username_changed_at := now();
    else
      new.username_changed_at := old.username_changed_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_enforce_change_windows on public.profiles;
create trigger profiles_enforce_change_windows
before update on public.profiles
for each row execute function public.enforce_profile_change_windows();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Profile avatars upload own folder" on storage.objects;
create policy "Profile avatars upload own folder" on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Profile avatars update own folder" on storage.objects;
create policy "Profile avatars update own folder" on storage.objects
for update to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Profile avatars delete own folder" on storage.objects;
create policy "Profile avatars delete own folder" on storage.objects
for delete to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

grant select, update on public.profiles to authenticated;
