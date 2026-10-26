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

Do not treat every uploaded file as a queued job and do not scan or delete files automatically. First define the desired operation (for example OCR/extraction or metadata validation), supported MIME types, size/time limits, retention, and retry policy.

A later migration should add a durable queue containing job ID, document ID, owner ID, job type, status, attempts, next-attempt time, lease/worker identity, bounded error fields, timestamps, and an idempotency key. Claims must be atomic (for example, a reviewed claim RPC using row locking and `SKIP LOCKED`), verify document ownership, and use bounded retries/backoff. Do not log extracted financial text or delete files during retry/failure handling.

Acceptance tests:
- At most one active lease per job; expired leases can be safely reclaimed.
- Duplicate enqueue does not duplicate processing.
- Missing files, unsupported/oversized files, and transient failures have explicit states.
- Users cannot enqueue or read another user's jobs.
- Storage and integration tests use isolated storage and synthetic files.

## Release sequence

1. Complete CI, UI E2E, and authentication E2E for the scheduler change.
2. Apply the notification migration only to a disposable test project and run the role, idempotency, and tenant-isolation tests.
3. Implement a document queue only after the processing operation and resource limits are approved.
4. Run worker build/unit/integration tests and a non-production soak test.
5. Review secret storage and replica count; configure distributed concurrency control if multiple replicas are possible.
6. Only after checks pass, request release approval, apply the reviewed migration, deploy the worker, and observe aggregate counts/errors. Web deployment remains a separate final-stage decision.

## Current implementation status (2026-10-26)

- The durable document queue migration is implemented on the feature branch; it has **not** been applied to production.
- The worker currently validates document-row metadata (owner, filename, MIME type, size up to 20 MiB, and storage path) and records `processing.status = "metadata_validated"`. It does not download file contents and does not perform OCR, financial extraction, or content classification.
- The worker supports only `extract_metadata`; any other job type is marked failed with `UNSUPPORTED_JOB_TYPE` instead of being falsely reported as processed.
- Queue failures use an eight-attempt cap and bounded backoff. Expired leases also become terminally failed after the cap.
- Before release, test the SQL migrations in a disposable Supabase project, add integration coverage for grants/RLS/locking/retry exhaustion, and confirm worker deployment configuration and secrets. Production migrations and Vercel deployment remain gated.

## Remaining release blockers

The queue and worker implementation now exist on the feature branch, but production activation is intentionally blocked until the migrations pass isolated database/security tests, the worker runtime and secrets are configured, and the full release checks are green. The notification batch likewise requires isolated migration/security verification before production use.
