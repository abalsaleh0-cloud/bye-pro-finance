-- Web Push subscriptions and VAPID configuration. The private VAPID key is inserted separately and is not stored in source control.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

create table if not exists public.push_vapid_config (
  id smallint primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  subject text not null default 'mailto:admin@byepro.finance',
  updated_at timestamptz not null default now()
);
alter table public.push_vapid_config enable row level security;
revoke all on public.push_vapid_config from public, anon, authenticated;
grant select on public.push_vapid_config to service_role;
