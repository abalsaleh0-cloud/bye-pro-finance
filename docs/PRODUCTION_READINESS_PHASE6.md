# Production Readiness — Phase 6

Last reviewed: 2026-10-26 (UTC)

This checklist records evidence, not intentions. A checkbox is marked complete only after a repeatable check or a restore drill has succeeded.

## Current status

- [x] Dependency versions are pinned in package manifests.
- [ ] A committed `pnpm-lock.yaml` exists and installs with `pnpm install --frozen-lockfile`. A GitHub Actions workflow was added to generate the missing lockfile; wait for its run and verify the resulting commit before marking this complete.
- [ ] Leaked-password protection is enabled in Supabase Auth. The live Supabase security advisor reports it disabled. Supabase documentation currently limits this feature to Pro and above; the project must not be upgraded without explicit approval. On the current plan this requirement is blocked, not complete.
- [ ] Real cross-user isolation tests have passed with two distinct Supabase test accounts and their own access tokens. Existing static tests are not evidence of a real two-user test.
- [ ] A database + Storage backup has been restored into a separate non-production project and validated.
- [ ] CI, authentication E2E, RLS checks, and a clean frozen-lockfile install pass on the same commit.

## 1. Leaked-password protection

Evidence at review: Supabase security advisor reported `auth_leaked_password_protection` as a warning on 2026-10-25.

Official guidance: https://supabase.com/docs/guides/auth/password-security

The feature checks passwords against the HaveIBeenPwned Pwned Passwords corpus and is currently documented as available on Pro and above. Do not attempt to emulate it in client code, send passwords to a third party, or expose credentials. Until the project's plan supports it, keep this item blocked and document the limitation. If the owner later authorizes a plan change, enable the setting in Supabase Dashboard → Authentication → Password Security and verify by attempting a signup/password change with a known compromised test password (never a real user password).

## 2. Two-user isolation test procedure

Use only two dedicated, disposable test accounts in a non-production environment, for example `rls-a-<run-id>` and `rls-b-<run-id>`. Never use real customer accounts or commit passwords/tokens.

1. Create each account independently and obtain its own user access token.
2. With account A, create a uniquely named account, transaction, budget, transfer, document object, and user setting. Record only generated test IDs.
3. With account B's token, attempt to list, fetch by ID, update, and delete each A-owned record; every read must return no A-owned rows and every write must be denied or affect zero rows.
4. Repeat in reverse (A attempting to access B's records).
5. Test Storage separately: B must not read, overwrite, or delete A's private finance-document object.
6. Verify each user can still CRUD their own data; clean up only the test-owned rows and objects.
7. Preserve sanitized test results (pass/fail and resource type only). Do not save tokens, passwords, personal data, or request headers.

Run against a dedicated staging project. If only the production project is available, create a staging project first; do not insert disposable fixtures into production. Until this procedure has been run with two real access tokens, cross-user isolation is not certified.

## 3. Backup and restore runbook

Official guidance:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

The Free plan does not include Supabase's managed daily database backups. Schedule regular off-site logical exports and keep them encrypted outside this repository. Database exports do not include Storage object bytes, so copy private Storage objects separately and securely.

### Backup

1. Announce a maintenance window if the app is actively writing financial records.
2. Install a current Supabase CLI and use the project's **Connect** dialog to obtain a database connection string. Store it in a local environment variable or secret manager; never put it in shell history, logs, GitHub files, or chat.
3. Export roles and schema/data using the official Supabase CLI `db dump` procedure. Keep role, schema, and data dumps separate as recommended by Supabase.
4. Export the Storage objects from each bucket separately, preserving object paths and metadata needed by the app. Do not make the private finance-documents bucket public.
5. Encrypt the resulting backup, store it outside the project/repository, record the timestamp and checksum, and verify the files are non-empty.
6. Retain multiple dated backups in a separate location; do not rely on the source project as the only copy.

### Restore drill

1. Restore into a separate staging Supabase project, never directly over production.
2. Follow Supabase's documented restore order for roles, schema, and data. Apply the repository migrations as appropriate and resolve migration/schema drift before switching traffic.
3. Restore Storage objects and verify private/public bucket settings and ownership policies.
4. Run authentication, RLS, financial-integrity, and app smoke tests; compare table row counts and sampled non-sensitive invariants.
5. Record the backup timestamp, restore start/end, failures, and validation results. Mark the drill complete only after the app can read and write its own test data while cross-user access remains blocked.

### Current evidence

- [ ] Backup artifact generated and checksum recorded.
- [ ] Storage objects exported separately.
- [ ] Restore completed in a separate project.
- [ ] Post-restore smoke and isolation tests passed.

No backup or restore drill is claimed complete by this document alone.

## 4. Reproducible pnpm install

Required repository checks after the lockfile workflow completes:

```sh
pnpm --version
# Must report 10.15.0
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

CI must use `pnpm install --frozen-lockfile` and must not silently regenerate the lockfile. Update the lockfile intentionally whenever a manifest changes.

## Completion gate

Phase 6 is complete only when the lockfile is committed and frozen install passes, the two-user tests pass with real isolated test accounts, the backup restore drill passes, and leaked-password protection is enabled. If plan limits block the last item, report the phase as **blocked**, not complete, and do not change billing without explicit approval.
