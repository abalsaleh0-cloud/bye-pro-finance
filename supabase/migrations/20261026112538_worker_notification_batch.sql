-- Real server-side notification batch for the worker.
-- Applied to the controlled Supabase project as migration worker_notification_batch.

create schema if not exists private;

create or replace function private.refresh_finance_notifications_for_user(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_inserted integer := 0;
  v_rows integer := 0;
  v_today date := current_date;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED' using errcode = '22023';
  end if;

  -- Serialize check-then-insert deduplication for each user across worker and UI RPC calls.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  insert into public.notifications (user_id,title,body,type,is_read,data)
  select b.user_id,
    case when b.status='overdue' then 'فاتورة متأخرة' else 'فاتورة مستحقة قريبًا' end,
    case when b.status='overdue' then 'الفاتورة «'||b.name||'» متأخرة عن موعدها.' else 'الفاتورة «'||b.name||'» تستحق في '||to_char(b.due_date,'YYYY-MM-DD')||'.' end,
    'bill',false,
    jsonb_build_object('dedupe_key',case when b.status='overdue' then 'bill-overdue:'||b.id::text else 'bill-due:'||b.id::text end,'bill_id',b.id)
  from public.bills b
  where b.user_id=p_user_id
    and (b.status='overdue' or (b.status='upcoming' and b.due_date between v_today and v_today+7))
    and not exists (
      select 1 from public.notifications n
      where n.user_id=p_user_id and n.type='bill'
        and n.data->>'dedupe_key'=case when b.status='overdue' then 'bill-overdue:'||b.id::text else 'bill-due:'||b.id::text end
    );
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  insert into public.notifications (user_id,title,body,type,is_read,data)
  select d.user_id,
    case when d.type='i_owe' then 'استحقاق دين قريب' else 'موعد تحصيل دين قريب' end,
    'الدين مع «'||d.person_name||'» يستحق في '||to_char(d.due_date,'YYYY-MM-DD')||'. المتبقي: '||d.remaining_amount||' '||d.currency_code||'.',
    'debt',false,jsonb_build_object('dedupe_key','debt-due:'||d.id::text,'debt_id',d.id)
  from public.debts d
  where d.user_id=p_user_id and not d.is_settled and d.due_date between v_today and v_today+7
    and not exists (
      select 1 from public.notifications n
      where n.user_id=p_user_id and n.type='debt' and n.data->>'dedupe_key'='debt-due:'||d.id::text
    );
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  insert into public.notifications (user_id,title,body,type,is_read,data)
  select b.user_id,'الميزانية تقترب من الحد','الميزانية «'||b.name||'» تجاوزت 80% من المبلغ المخصص لها.','budget',false,
    jsonb_build_object('dedupe_key','budget-80:'||b.id::text,'budget_id',b.id)
  from public.budgets b
  where b.user_id=p_user_id and b.is_active and b.start_date<=v_today and (b.end_date is null or b.end_date>=v_today)
    and (select coalesce(sum(t.amount),0) from public.transactions t
         where t.user_id=p_user_id and t.category_id=b.category_id and t.type='expense'
           and t.status='completed' and t.transaction_date::date between b.start_date and coalesce(b.end_date,v_today)) >= b.amount*0.8
    and not exists (
      select 1 from public.notifications n
      where n.user_id=p_user_id and n.type='budget' and n.data->>'dedupe_key'='budget-80:'||b.id::text
    );
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  return v_inserted;
end;
$$;

revoke all on function private.refresh_finance_notifications_for_user(uuid) from public, anon, authenticated, service_role;

create or replace function public.refresh_finance_notifications()
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';
  end if;
  return private.refresh_finance_notifications_for_user(v_user_id);
end;
$$;
revoke all on function public.refresh_finance_notifications() from public, anon;
grant execute on function public.refresh_finance_notifications() to authenticated;

create or replace function public.process_finance_notifications_batch()
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid;
  v_total integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;

  for v_user_id in
    select user_id from (
      select b.user_id from public.bills b
        where b.status='overdue' or (b.status='upcoming' and b.due_date between current_date and current_date+7)
      union
      select d.user_id from public.debts d
        where not d.is_settled and d.due_date between current_date and current_date+7
      union
      select b.user_id from public.budgets b
        where b.is_active and b.start_date<=current_date and (b.end_date is null or b.end_date>=current_date)
    ) eligible_users
  loop
    v_total := v_total + private.refresh_finance_notifications_for_user(v_user_id);
  end loop;

  return v_total;
end;
$$;
revoke all on function public.process_finance_notifications_batch() from public, anon, authenticated;
grant execute on function public.process_finance_notifications_batch() to service_role;
