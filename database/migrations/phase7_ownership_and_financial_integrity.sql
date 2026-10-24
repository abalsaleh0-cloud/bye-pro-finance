-- BYE PRO FINANCE — Phase 7 ownership + financial integrity hardening
-- Prevent cross-user foreign-key abuse and enforce currency consistency at the database boundary.

create or replace function public.validate_finance_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_currency text;
  v_is_system boolean;
begin
  if tg_table_name = 'transactions' then
    select a.user_id, a.currency_code into v_owner, v_currency
      from public.accounts a where a.id = new.account_id;
    if v_owner is null or v_owner is distinct from new.user_id then
      raise exception 'ACCOUNT_OWNERSHIP_MISMATCH' using errcode = '42501';
    end if;
    if new.currency_code is distinct from v_currency then
      raise exception 'ACCOUNT_CURRENCY_MISMATCH' using errcode = '23514';
    end if;
    if new.category_id is not null then
      select c.user_id, c.is_system into v_owner, v_is_system
        from public.categories c where c.id = new.category_id;
      if not found or (not coalesce(v_is_system, false) and v_owner is distinct from new.user_id) then
        raise exception 'CATEGORY_OWNERSHIP_MISMATCH' using errcode = '42501';
      end if;
    end if;

  elsif tg_table_name = 'transfers' then
    select a.user_id, a.currency_code into v_owner, v_currency
      from public.accounts a where a.id = new.from_account_id;
    if v_owner is null or v_owner is distinct from new.user_id then
      raise exception 'FROM_ACCOUNT_OWNERSHIP_MISMATCH' using errcode = '42501';
    end if;
    if new.currency_code is distinct from v_currency then
      raise exception 'FROM_ACCOUNT_CURRENCY_MISMATCH' using errcode = '23514';
    end if;
    select a.user_id, a.currency_code into v_owner, v_currency
      from public.accounts a where a.id = new.to_account_id;
    if v_owner is null or v_owner is distinct from new.user_id then
      raise exception 'TO_ACCOUNT_OWNERSHIP_MISMATCH' using errcode = '42501';
    end if;
    if new.currency_code is distinct from v_currency then
      raise exception 'TO_ACCOUNT_CURRENCY_MISMATCH' using errcode = '23514';
    end if;

  elsif tg_table_name = 'documents' and new.related_transaction_id is not null then
    select t.user_id into v_owner from public.transactions t where t.id = new.related_transaction_id;
    if v_owner is null or v_owner is distinct from new.user_id then
      raise exception 'DOCUMENT_TRANSACTION_OWNERSHIP_MISMATCH' using errcode = '42501';
    end if;

  elsif tg_table_name = 'budgets' and new.category_id is not null then
    select c.user_id, c.is_system into v_owner, v_is_system
      from public.categories c where c.id = new.category_id;
    if not found or (not coalesce(v_is_system, false) and v_owner is distinct from new.user_id) then
      raise exception 'BUDGET_CATEGORY_OWNERSHIP_MISMATCH' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_finance_ownership() from public, anon, authenticated;
grant execute on function public.validate_finance_ownership() to service_role;

drop trigger if exists transactions_validate_ownership on public.transactions;
create trigger transactions_validate_ownership before insert or update on public.transactions
for each row execute function public.validate_finance_ownership();

drop trigger if exists transfers_validate_ownership on public.transfers;
create trigger transfers_validate_ownership before insert or update on public.transfers
for each row execute function public.validate_finance_ownership();

drop trigger if exists documents_validate_ownership on public.documents;
create trigger documents_validate_ownership before insert or update on public.documents
for each row execute function public.validate_finance_ownership();

drop trigger if exists budgets_validate_ownership on public.budgets;
create trigger budgets_validate_ownership before insert or update on public.budgets
for each row execute function public.validate_finance_ownership();

revoke insert, update, delete on table public.audit_logs from authenticated;

alter table public.profiles drop constraint if exists profiles_currency_code_format;
alter table public.profiles add constraint profiles_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.accounts drop constraint if exists accounts_currency_code_format;
alter table public.accounts add constraint accounts_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.transactions drop constraint if exists transactions_currency_code_format;
alter table public.transactions add constraint transactions_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.transfers drop constraint if exists transfers_currency_code_format;
alter table public.transfers add constraint transfers_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.budgets drop constraint if exists budgets_currency_code_format;
alter table public.budgets add constraint budgets_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.debts drop constraint if exists debts_currency_code_format;
alter table public.debts add constraint debts_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.bills drop constraint if exists bills_currency_code_format;
alter table public.bills add constraint bills_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.savings_goals drop constraint if exists savings_goals_currency_code_format;
alter table public.savings_goals add constraint savings_goals_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');
alter table public.assets drop constraint if exists assets_currency_code_format;
alter table public.assets add constraint assets_currency_code_format check (currency_code ~ '^[A-Z]{3,5}$');

alter table public.profiles force row level security;
alter table public.accounts force row level security;
alter table public.categories force row level security;
alter table public.transactions force row level security;
alter table public.transfers force row level security;
alter table public.budgets force row level security;
alter table public.debts force row level security;
alter table public.bills force row level security;
alter table public.savings_goals force row level security;
alter table public.assets force row level security;
alter table public.documents force row level security;
alter table public.notifications force row level security;
alter table public.audit_logs force row level security;
