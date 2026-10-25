-- Keep household expense ownership intact when a referenced member is removed.
-- PostgreSQL 15+ supports setting only member_id to NULL for this composite FK.
alter table public.household_expenses
  drop constraint if exists household_expenses_member_owner_fk;

alter table public.household_expenses
  add constraint household_expenses_member_owner_fk
  foreign key (member_id, user_id)
  references public.household_members(id, user_id)
  on delete set null (member_id);

create index if not exists household_expenses_member_owner_idx
  on public.household_expenses(member_id, user_id)
  where member_id is not null;
