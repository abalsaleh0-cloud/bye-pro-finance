-- Communication reliability: persisted friend requests, peer profile visibility,
-- and Realtime publication for conversations/participants.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (sender_id <> recipient_id)
);
create unique index if not exists friend_requests_one_pending_pair
  on public.friend_requests (sender_id, recipient_id) where status = 'pending';
create index if not exists friend_requests_recipient_status_created
  on public.friend_requests (recipient_id, status, created_at desc);

alter table public.friend_requests enable row level security;
grant select, insert on public.friend_requests to authenticated;
revoke update on public.friend_requests from authenticated;

drop policy if exists friend_requests_select_participants on public.friend_requests;
create policy friend_requests_select_participants on public.friend_requests
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
drop policy if exists friend_requests_insert_sender on public.friend_requests;
create policy friend_requests_insert_sender on public.friend_requests
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and status = 'pending' and sender_id <> recipient_id);
drop policy if exists friend_requests_update_recipient on public.friend_requests;

drop policy if exists profiles_select_conversation_peers on public.profiles;
create policy profiles_select_conversation_peers on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.conversation_participants mine
      join public.conversation_participants peer on peer.conversation_id = mine.conversation_id
      where mine.user_id = (select auth.uid()) and peer.user_id = profiles.id
    )
    or exists (
      select 1 from public.friend_requests fr
      where (fr.sender_id = profiles.id and fr.recipient_id = (select auth.uid()))
         or (fr.recipient_id = profiles.id and fr.sender_id = (select auth.uid()))
    )
  );

create or replace function public.respond_to_friend_request(request_id uuid, accept_request boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor uuid := auth.uid();
  request_row public.friend_requests%rowtype;
  conversation_id uuid;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into request_row
  from public.friend_requests
  where id = request_id and recipient_id = actor and status = 'pending'
  for update;
  if not found then
    raise exception 'friend request not found or already handled' using errcode = 'P0002';
  end if;
  update public.friend_requests
  set status = case when accept_request then 'accepted' else 'rejected' end,
      responded_at = now()
  where id = request_row.id;
  if accept_request then
    conversation_id := public.get_or_create_direct_conversation(request_row.sender_id);
    return conversation_id;
  end if;
  return null;
end;
$function$;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversation_participants') then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_requests') then
    alter publication supabase_realtime add table public.friend_requests;
  end if;
end $$;
