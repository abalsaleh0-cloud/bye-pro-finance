-- Timestamped partial/full payments for debts. Applied to Supabase via migration add_debt_payments_with_timestamped_history.
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency_code text not null,
  payment_date timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists debt_payments_user_debt_date_idx on public.debt_payments(user_id, debt_id, payment_date desc);
alter table public.debt_payments enable row level security;
alter table public.debt_payments force row level security;
drop policy if exists debt_payments_select_own on public.debt_payments;
create policy debt_payments_select_own on public.debt_payments for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists debt_payments_insert_own on public.debt_payments;
create policy debt_payments_insert_own on public.debt_payments for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists debt_payments_delete_own on public.debt_payments;
create policy debt_payments_delete_own on public.debt_payments for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.debt_payments from authenticated;
grant select, insert, delete on public.debt_payments to authenticated;
create or replace function public.register_debt_payment(p_debt_id uuid, p_amount numeric, p_payment_date timestamptz, p_notes text default null)
returns public.debt_payments language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_debt public.debts%rowtype; v_payment public.debt_payments%rowtype;
begin
 if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
 if p_amount is null or p_amount <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT' using errcode = '22023'; end if;
 select * into v_debt from public.debts where id = p_debt_id and user_id = v_user_id for update;
 if not found then raise exception 'DEBT_NOT_FOUND' using errcode = 'P0002'; end if;
 if coalesce(v_debt.is_settled,false) or p_amount > v_debt.remaining_amount then raise exception 'PAYMENT_EXCEEDS_REMAINING_BALANCE' using errcode = '22023'; end if;
 insert into public.debt_payments(user_id,debt_id,amount,currency_code,payment_date,notes) values(v_user_id,p_debt_id,p_amount,v_debt.currency_code,coalesce(p_payment_date,now()),nullif(trim(p_notes),'')) returning * into v_payment;
 update public.debts set remaining_amount=greatest(0,remaining_amount-p_amount),is_settled=(greatest(0,remaining_amount-p_amount)=0) where id=p_debt_id and user_id=v_user_id;
 return v_payment;
end; $$;
revoke all on function public.register_debt_payment(uuid,numeric,timestamptz,text) from public, anon;
grant execute on function public.register_debt_payment(uuid,numeric,timestamptz,text) to authenticated;
