create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  role text not null default 'family' check (role in ('owner','partner','child','parent','family','other')),
  monthly_contribution numeric(14,2) not null default 0 check (monthly_contribution >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.household_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0),
  currency_code text not null default 'LYD' check (char_length(currency_code) between 3 and 5),
  period text not null default 'monthly' check (period in ('weekly','monthly','yearly')),
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.household_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid,
  category text not null default 'عام' check (char_length(trim(category)) between 1 and 80),
  description text,
  amount numeric(14,2) not null check (amount > 0),
  currency_code text not null default 'LYD' check (char_length(currency_code) between 3 and 5),
  expense_date date not null default current_date,
  is_recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_expenses_member_owner_fk foreign key (member_id, user_id) references public.household_members(id, user_id) on delete set null
);

create index if not exists household_members_user_idx on public.household_members(user_id, is_active);
create index if not exists household_budgets_user_idx on public.household_budgets(user_id, is_active, start_date);
create index if not exists household_expenses_user_date_idx on public.household_expenses(user_id, expense_date desc);
create index if not exists household_expenses_user_category_idx on public.household_expenses(user_id, category);

alter table public.household_members enable row level security;
alter table public.household_members force row level security;
alter table public.household_budgets enable row level security;
alter table public.household_budgets force row level security;
alter table public.household_expenses enable row level security;
alter table public.household_expenses force row level security;

create policy household_members_select_own on public.household_members for select to authenticated using ((select auth.uid()) = user_id);
create policy household_members_insert_own on public.household_members for insert to authenticated with check ((select auth.uid()) = user_id);
create policy household_members_update_own on public.household_members for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy household_members_delete_own on public.household_members for delete to authenticated using ((select auth.uid()) = user_id);

create policy household_budgets_select_own on public.household_budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy household_budgets_insert_own on public.household_budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy household_budgets_update_own on public.household_budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy household_budgets_delete_own on public.household_budgets for delete to authenticated using ((select auth.uid()) = user_id);

create policy household_expenses_select_own on public.household_expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy household_expenses_insert_own on public.household_expenses for insert to authenticated with check ((select auth.uid()) = user_id and (member_id is null or exists (select 1 from public.household_members m where m.id = member_id and m.user_id = (select auth.uid()))));
create policy household_expenses_update_own on public.household_expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and (member_id is null or exists (select 1 from public.household_members m where m.id = member_id and m.user_id = (select auth.uid()))));
create policy household_expenses_delete_own on public.household_expenses for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.household_members, public.household_budgets, public.household_expenses to authenticated;
revoke all privileges on public.household_members, public.household_budgets, public.household_expenses from anon;
