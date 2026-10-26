# Worker job readiness and implementation plan

## Verified baseline

Reviewed against repository commit `6c54f63b57150e1181ee1ee5e5deb1e0eb5ab89d` and the connected Supabase project using read-only inspection.

- The scheduler validates the interval, avoids overlapping cycles within one process, and stops future cycles on shutdown. It is not a distributed lock.
- `public.notifications` stores user-scoped in-app alerts. The existing `public.refresh_finance_notifications()` function requires `auth.uid()`; a service-role worker cannot safely call it as-is.
- `public.documents` stores metadata; the private `finance-documents` bucket stores actual files. The current web UI already uploads, lists, opens via short-lived signed URLs, and deletes documents.
- Repository migration `20261026130000_document_processing_queue.sql` now defines a durable document-processing queue, atomic claims, lease expiry recovery, and server-only RPCs. This migration has not been applied to the live Supabase project, so the live schema still has no queue.
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

The repository migration now adds job ID, document ID, owner ID, job type, status, attempt count, next-attempt time, lease/worker identity, bounded error fields, timestamps, and a uniqueness constraint for document/job type. Claims use row locking and `SKIP LOCKED`; retry/backoff is bounded and the job becomes terminally failed after 8 claims, including expired leases. The migration still needs isolated SQL/security tests and review of the document-owner invariant before any production application. Do not log extracted financial text or delete files during retry/failure handling.

Acceptance tests:
- At most one active lease per job; expired leases are requeued below 8 attempts and become terminally failed at 8 attempts.
- Duplicate enqueue does not duplicate processing.
- Missing files, unsupported/oversized files, and transient failures have explicit states.
- Users cannot enqueue or read another user's jobs.
- Storage and integration tests use isolated storage and synthetic files.

## Release sequence

1. Complete CI, UI E2E, and authentication E2E for the scheduler change.
2. Apply the notification migration only to a disposable test project and run the role, idempotency, and tenant-isolation tests.
3. Finish queue migration review and isolated SQL/security tests; the queue schema is present in the branch but not deployed. Define the processing operation and resource limits before wiring a processor.
4. Run worker build/unit/integration tests and a non-production soak test.
5. Review secret storage and replica count; configure distributed concurrency control if multiple replicas are possible.
6. Only after checks pass, request release approval, apply the reviewed migration, deploy the worker, and observe aggregate counts/errors. Web deployment remains a separate final-stage decision.

## Current blocker

Document processing is not yet an implemented job: queue schema/RPCs are present in the branch but not deployed, and the worker does not yet claim, process, or recover document jobs. The notification batch is implemented in repository code but must pass isolated migration/security tests before production use.
