-- Phase 10: targeted performance hardening
-- Adds the missing FK index and removes a duplicate audit-log index.

create index if not exists admin_roles_granted_by_idx
  on public.admin_roles (granted_by);

drop index if exists public.audit_logs_user_date_idx;
