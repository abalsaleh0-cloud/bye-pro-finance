# Worker job readiness and implementation plan

## Verified baseline

Reviewed against repository commit `6c54f63b57150e1181ee1ee5e5deb1e0eb5ab89d` and the connected Supabase project using read-only inspection.

- The scheduler validates the interval, avoids overlapping cycles within one process, and stops future cycles on shutdown. It is not a distributed lock.
- `public.notifications` stores user-scoped in-app alerts. The existing `public.refresh_finance_notifications()` function requires `auth.uid()`; a service-role worker cannot safely call it as-is.
- `public.documents` stores metadata; the private `finance-documents` bucket stores actual files. The current web UI already uploads, lists, opens via short-lived signed URLs, and deletes documents.
- No durable document-processing queue or processing-state column exists in the inspected schema.
- The notification batch RPC migration is repository code only until reviewed and applied; no production database migration or Vercel deployment was performed.

## Job A — in-app notification generation

The new migration `20261026120000_worker_notification_batch.sql` adds a server-only batch RPC and moves user-scoped generation into a private helper. The user-facing RPC continues to require a signed-in user. The worker RPC checks `auth.role() = 'service_role'`, is not executable by ordinary authenticated clients, serializes generation per user with a transaction-scoped advisory lock, and returns only an inserted-row count.

Before release:
1. Review the SQL and grants; apply it to an isolated Supabase project first.
2. Verify current status values and date semantics with synthetic records.
3. Test duplicate prevention across retries and concurrent calls from the user RPC and service batch.
4. Test that anon/authenticated roles cannot execute the batch RPC and cannot supply another user's identity.
5. Keep the service-role key only in the worker runtime secret store; fail closed if configuration is missing.
6. Test that a failed batch remains visible in logs/monitoring and never reports success.

## Job B — document processing

The feature branch now contains a durable queue and a conservative metadata-validation worker. It does not download files, run OCR, extract financial text, classify content, or fabricate results.

- A trigger enqueues one `extract_metadata` job per document/job type.
- Claims are atomic and use `FOR UPDATE SKIP LOCKED`, worker IDs, and leases.
- The worker checks document ownership, filename, MIME type, storage path, and the 20 MiB size limit.
- Successful processing records `processing.status = "metadata_validated"` in the document metadata. This is validation of stored metadata only, not file-content extraction.
- Unsupported job types fail explicitly. Failures use bounded messages, backoff, and an eight-attempt limit; lease-expiry recovery respects the same limit.
- The queue table has RLS enabled and no direct table grants to `anon` or `authenticated`; the owner policy is defense in depth, not a client-readable queue API.
- The queue and retry migrations remain unapplied to production.

Acceptance criteria before release:
1. Run SQL integration tests against a disposable Supabase project for grants, role checks, tenant isolation, atomic claims, lease expiry, and retry exhaustion.
2. Verify that metadata PATCH requests only affect the expected document row and do not overwrite unrelated metadata.
3. Test missing/invalid/oversized documents, unsupported job types, transient RPC failures, and stale worker completion.
4. Verify the actual worker runtime, secret storage, restart policy, and replica count.
5. Add real OCR/extraction only as a separate feature with explicit supported formats, timeouts, privacy/retention rules, and synthetic-file tests.

## Release sequence

1. Require CI, UI E2E, and authentication E2E to pass on the exact reviewed commit.
2. Review and test the notification migration in an isolated database, including the intended user-scoped function and service-only batch RPC.
3. Test the document queue and retry migrations in an isolated Supabase project; inspect advisor findings after applying there.
4. Confirm worker runtime deployment and server-only secrets without exposing the service key.
5. Run a non-production soak test and verify aggregate logs, retries, lease recovery, and graceful shutdown.
6. Apply approved production migrations and deploy the worker only after the preceding gates pass. Vercel web deployment is a separate final-stage decision.

## Current implementation status (2026-10-26)

- The durable document queue migration is implemented on the feature branch; it has **not** been applied to production.
- The worker currently validates document-row metadata (owner, filename, MIME type, size up to 20 MiB, and storage path) and records `processing.status = "metadata_validated"`. It does not download file contents and does not perform OCR, financial extraction, or content classification.
- The worker supports only `extract_metadata`; any other job type is marked failed with `UNSUPPORTED_JOB_TYPE` instead of being falsely reported as processed.
- Queue failures use an eight-attempt cap and bounded backoff. Expired leases also become terminally failed after the cap.
- Before release, test the SQL migrations in a disposable Supabase project, add integration coverage for grants/RLS/locking/retry exhaustion, and confirm worker deployment configuration and secrets. Production migrations and Vercel deployment remain gated.

## Remaining release blockers

The queue and worker implementation now exist on the feature branch, but production activation is intentionally blocked until the migrations pass isolated database/security tests, the worker runtime and secrets are configured, and the full release checks are green. The notification batch likewise requires isolated migration/security verification before production use.
