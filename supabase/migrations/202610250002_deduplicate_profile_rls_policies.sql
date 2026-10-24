-- Remove duplicate ownership policies; the core schema already defines these safely.
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
