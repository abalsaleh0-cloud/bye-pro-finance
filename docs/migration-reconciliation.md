# Supabase migration reconciliation

Snapshot checked against Supabase project `ngfaukvfsesoslfiwaue` on 2026-10-26.
This is an inventory, **not** permission to replay SQL. The live migration ledger contains 22 entries; the repository contains 18 SQL files across `database/migrations/` and `supabase/migrations/`. A similar filename is only a candidate mapping: compare SQL bodies and effects before treating it as an exact source match.

## Live ledger and repository source candidates

| Live version | Live migration name | Repository source / status |
|---|---|---|
| 20261023173732 | create_finance_core_schema | **Source missing from current migration directories** |
| 20261023174237 | account_balance_audit_triggers | **Source missing from current migration directories** |
| 20261023174250 | finance_documents_storage_policies | **Source missing from current migration directories** |
| 20261024082002 | harden_finance_rls_and_fk_indexes | **Source missing from current migration directories** |
| 20261024191733 | phase7_security_hardening | Candidate: `database/migrations/phase7_security_hardening.sql` |
| 20261024191754 | phase7_audit_trigger_security | Candidate: `database/migrations/phase7_audit_trigger_security.sql` |
| 20261024195908 | phase7_ownership_and_financial_integrity | Candidate: `database/migrations/phase7_ownership_and_financial_integrity.sql` |
| 20261024203957 | phase_7_permissions_hardening_postgres_defaults | Candidate: `database/migrations/phase7_default_privileges_hardening.sql` |
| 20261024213635 | add_debt_payments_with_timestamped_history | Candidate: `database/migrations/phase8_debt_payments.sql` |
| 20261024223325 | add_profile_username_signup | Candidate: `supabase/migrations/202610250001_profiles_auth.sql` |
| 20261024223433 | deduplicate_profile_rls_policies | Candidate: `supabase/migrations/202610250002_deduplicate_profile_rls_policies.sql` |
| 20261024224239 | complete_profile_settings | Candidate: `supabase/migrations/202610250003_complete_profile_settings.sql` |
| 20261024232707 | index_debt_payments_debt_id | **No clearly matching standalone source file** |
| 20261025130032 | phase9_household_expenses | Candidate: `database/migrations/phase9_household_expenses.sql` |
| 20261025171638 | fix_documents_ownership_trigger_category_reference | Candidate: `supabase/migrations/20261025191500_fix_documents_ownership_trigger_category_reference.sql`; compare duplicate under `database/migrations/` |
| 20261025191606 | create_user_settings_and_harden_profile_fields | Candidate: `supabase/migrations/20261025203000_create_user_settings_and_harden_profile_fields.sql` |
| 20261025195720 | add_six_digit_user_public_id | Candidate: `supabase/migrations/20261025212000_add_six_digit_user_public_id.sql` |
| 20261025202922 | gap_closure_categories_notifications_v2 | Candidate: `supabase/migrations/20261025224500_gap_closure_categories_notifications.sql` |
| 20261025222304 | complete_audit_rbac_and_immutable_logging_v2 | Candidate: `supabase/migrations/202610260001_complete_audit_rbac_and_immutable_logging.sql` |
| 20261025222429 | allow_admin_user_directory | **No clearly matching standalone source file** |
| 20261025235013 | harden_audit_function_search_path | Candidate: `supabase/migrations/202610260002_harden_audit_function_search_path.sql` |
| 20261026070859 | phase10_performance_hardening | Candidate: `database/migrations/phase10_performance_hardening.sql` |

## Additional repository SQL requiring reconciliation

- `database/migrations/phase9_documents_ownership_trigger_fix.sql`: overlaps in purpose/name with the Supabase migration candidate above; compare contents before choosing one canonical copy.
- `database/migrations/phase9_household_expenses_fk_fix.sql`: no separate live ledger entry by this name; determine whether its changes were included in the live household migration or are still unapplied.
- The repository's timestamps/names differ from the live ledger for several later migrations. Do not infer that timestamp difference means unapplied or safe to replay.

## Safe remediation order

1. Retrieve the SQL body for each live migration from the migration history where available and compare it with candidate repository files.
2. Recover missing source SQL for the four initial migrations, `index_debt_payments_debt_id`, and `allow_admin_user_directory`; if original SQL cannot be recovered, document a verified equivalent based on schema diffs rather than guessing.
3. Pick one canonical migration directory and archive/remove duplicate copies only after checking references and history.
4. Verify schema, RLS policies, triggers, indexes, functions, storage policies and grants against the live project in a non-production environment.
5. Only then add a forward-only reconciliation migration if an actual live-schema defect is confirmed. Never replay historical migrations blindly against production.

## Verification limits

This inventory was generated from the live migration ledger and repository file tree. It does not claim SQL-body equivalence for candidate matches, and it does not claim that any migration was applied during this audit.
