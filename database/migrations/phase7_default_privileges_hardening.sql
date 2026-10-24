-- BYE PRO FINANCE — Phase 7 default privilege hardening
-- Prevent future objects created by the postgres migration role in the exposed public schema
-- from inheriting Data API privileges for anon/authenticated roles.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Profile deletion is controlled by the Auth lifecycle, not by the client Data API.
revoke delete on table public.profiles from anon, authenticated;
