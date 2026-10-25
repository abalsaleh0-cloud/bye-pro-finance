alter table public.profiles add column if not exists public_id integer;

create unique index if not exists profiles_public_id_unique on public.profiles(public_id) where public_id is not null;

create or replace function public.generate_unique_public_id()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate integer;
begin
  loop
    candidate := floor(100000 + random() * 900000)::integer;
    exit when not exists (select 1 from public.profiles where public_id = candidate);
  end loop;
  return candidate;
end;
$$;

update public.profiles
set public_id = public.generate_unique_public_id()
where public_id is null;

alter table public.profiles alter column public_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_public_id_range' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_public_id_range check (public_id between 100000 and 999999);
  end if;
end $$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, public_id, full_name, username)
  values (new.id, public.generate_unique_public_id(), coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''), nullif(lower(trim(new.raw_user_meta_data ->> 'username')), ''))
  on conflict (id) do update set full_name = excluded.full_name, username = excluded.username;
  return new;
end;
$$;

revoke execute on function public.generate_unique_public_id() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;