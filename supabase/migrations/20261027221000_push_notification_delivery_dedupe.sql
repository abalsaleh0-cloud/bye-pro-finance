-- Prevent duplicate push deliveries when the client retries the same event.
create table if not exists public.push_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('message','friend_request','call')),
  event_id uuid not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_type, event_id, recipient_id)
);
alter table public.push_notification_deliveries enable row level security;
revoke all on public.push_notification_deliveries from public, anon, authenticated;
grant all on public.push_notification_deliveries to service_role;
