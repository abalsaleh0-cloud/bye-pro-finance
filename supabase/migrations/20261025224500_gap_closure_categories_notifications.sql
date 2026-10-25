-- Gap Closure: system categories + secure on-demand finance notification refresh.
insert into public.categories (user_id, name, kind, icon, color, is_system)
select null, v.name, v.kind::transaction_type, v.icon, v.color, true
from (values
  ('Salary','income','wallet','#4f8cff'),('Freelance','income','briefcase','#6f7bf7'),('Other income','income','plus-circle','#5bb98c'),
  ('Food','expense','utensils','#e08a5b'),('Transport','expense','car','#7aa2f7'),('Housing','expense','home','#b07adf'),
  ('Utilities','expense','zap','#d5a84f'),('Shopping','expense','shopping-bag','#d66a8a'),('Health','expense','heart-pulse','#5aa9d6'),
  ('Education','expense','graduation-cap','#7d9f72'),('Entertainment','expense','clapperboard','#b58ad8'),('Other expense','expense','more-horizontal','#8b929c')
) as v(name,kind,icon,color)
where not exists (select 1 from public.categories c where c.is_system and c.user_id is null and c.name=v.name and c.kind=v.kind::transaction_type);

create or replace function public.refresh_finance_notifications()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_rows integer := 0;
  v_today date := current_date;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;

  insert into public.notifications (user_id,title,body,type,is_read,data)
  select b.user_id,
    case when b.status='overdue' then 'فاتورة متأخرة' else 'فاتورة مستحقة قريبًا' end,
    case when b.status='overdue' then 'الفاتورة «'||b.name||'» متأخرة عن موعدها.' else 'الفاتورة «'||b.name||'» تستحق في '||to_char(b.due_date,'YYYY-MM-DD')||'.' end,
    'bill',false,
    jsonb_build_object('dedupe_key',case when b.status='overdue' then 'bill-overdue:'||b.id::text else 'bill-due:'||b.id::text end,'bill_id',b.id)
  from public.bills b
  where b.user_id=v_user_id
    and (b.status='overdue' or (b.status='upcoming' and b.due_date between v_today and v_today+7))
    and not exists (select 1 from public.notifications n where n.user_id=v_user_id and n.type='bill' and n.data->>'dedupe_key'=case when b.status='overdue' then 'bill-overdue:'||b.id::text else 'bill-due:'||b.id::text end);
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  insert into public.notifications (user_id,title,body,type,is_read,data)
  select d.user_id,
    case when d.type='i_owe' then 'استحقاق دين قريب' else 'موعد تحصيل دين قريب' end,
    'الدين مع «'||d.person_name||'» يستحق في '||to_char(d.due_date,'YYYY-MM-DD')||'. المتبقي: '||d.remaining_amount||' '||d.currency_code||'.',
    'debt',false,jsonb_build_object('dedupe_key','debt-due:'||d.id::text,'debt_id',d.id)
  from public.debts d
  where d.user_id=v_user_id and not d.is_settled and d.due_date between v_today and v_today+7
    and not exists (select 1 from public.notifications n where n.user_id=v_user_id and n.type='debt' and n.data->>'dedupe_key'='debt-due:'||d.id::text);
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  insert into public.notifications (user_id,title,body,type,is_read,data)
  select b.user_id,'الميزانية تقترب من الحد','الميزانية «'||b.name||'» تجاوزت 80% من المبلغ المخصص لها.','budget',false,
    jsonb_build_object('dedupe_key','budget-80:'||b.id::text,'budget_id',b.id)
  from public.budgets b
  where b.user_id=v_user_id and b.is_active and b.start_date<=v_today and (b.end_date is null or b.end_date>=v_today)
    and (select coalesce(sum(t.amount),0) from public.transactions t where t.user_id=v_user_id and t.category_id=b.category_id and t.type='expense' and t.status='completed' and t.transaction_date::date between b.start_date and coalesce(b.end_date,v_today)) >= b.amount*0.8
    and not exists (select 1 from public.notifications n where n.user_id=v_user_id and n.type='budget' and n.data->>'dedupe_key'='budget-80:'||b.id::text);
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  return v_inserted;
end;
$$;
revoke all on function public.refresh_finance_notifications() from public;
grant execute on function public.refresh_finance_notifications() to authenticated;
