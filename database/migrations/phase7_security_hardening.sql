-- BYE PRO FINANCE — Phase 7 security hardening
-- Keep the Data API surface least-privileged while preserving RLS user isolation.

revoke all privileges on table
  public.profiles,
  public.accounts,
  public.categories,
  public.transactions,
  public.transfers,
  public.budgets,
  public.debts,
  public.bills,
  public.savings_goals,
  public.assets,
  public.documents,
  public.notifications,
  public.audit_logs
from anon;

revoke truncate, references, trigger on table
  public.profiles,
  public.accounts,
  public.categories,
  public.transactions,
  public.transfers,
  public.budgets,
  public.debts,
  public.bills,
  public.savings_goals,
  public.assets,
  public.documents,
  public.notifications,
  public.audit_logs
from authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.accounts,
  public.categories,
  public.transactions,
  public.transfers,
  public.budgets,
  public.debts,
  public.bills,
  public.savings_goals,
  public.assets,
  public.documents,
  public.notifications,
  public.audit_logs
to authenticated;

revoke execute on function public.audit_finance_change() from public, anon, authenticated;
revoke execute on function public.recalculate_account_balance(uuid) from public, anon, authenticated;
revoke execute on function public.recalculate_account_balance_trigger() from public, anon, authenticated;
revoke execute on function public.recalculate_transfer_balances_trigger() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.audit_finance_change() to service_role;
grant execute on function public.recalculate_account_balance(uuid) to service_role;
grant execute on function public.recalculate_account_balance_trigger() to service_role;
grant execute on function public.recalculate_transfer_balances_trigger() to service_role;
grant execute on function public.set_updated_at() to service_role;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers enable row level security;
alter table public.budgets enable row level security;
alter table public.debts enable row level security;
alter table public.bills enable row level security;
alter table public.savings_goals enable row level security;
alter table public.assets enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
