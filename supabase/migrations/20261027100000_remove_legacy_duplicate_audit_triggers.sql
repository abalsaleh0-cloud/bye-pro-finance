-- Remove legacy audit triggers left behind by the original finance audit implementation.
-- The canonical audit path is private.audit_row_change(), installed by
-- complete_audit_rbac_and_immutable_logging. Keeping both paths causes two
-- audit rows for a single mutation.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts',
    'assets',
    'bills',
    'budgets',
    'debts',
    'documents',
    'savings_goals',
    'transactions',
    'transfers'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit ON public.%I', t, t);
  END LOOP;
END $$;

-- Keep the canonical audit trigger exactly once per audited table.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts',
    'assets',
    'bills',
    'budgets',
    'debts',
    'documents',
    'notifications',
    'profiles',
    'savings_goals',
    'transactions',
    'transfers',
    'user_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.audit_row_change()',
      t, t
    );
  END LOOP;
END $$;
