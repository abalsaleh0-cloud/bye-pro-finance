-- Extend the existing finance profile table with a unique username for signup.
alter table public.profiles add column if not exists username text;
update public.profiles set full_name = '' where full_name is null;
alter table public.profiles alter column full_name set default '';
alter table public.profiles alter column full_name set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,24}$');
  end if;
end $$;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;
alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;
create or replace function public.handle_new_user_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, username)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''), nullif(lower(trim(new.raw_user_meta_data ->> 'username')), ''))
  on conflict (id) do update set full_name = excluded.full_name, username = excluded.username;
  return new;
end;
$$;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_user_profile();
