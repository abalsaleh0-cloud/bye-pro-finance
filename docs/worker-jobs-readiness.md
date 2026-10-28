# Worker job readiness and implementation plan

## Verified baseline

Reviewed against the audit branch and the connected Supabase project using repository and live-schema inspection.

- The scheduler validates the interval, avoids overlapping cycles within one process, and stops future cycles on shutdown. It is not a distributed lock.
- `public.notifications` stores user-scoped in-app alerts. The notification batch worker uses the server-only `public.process_finance_notifications_batch()` RPC.
- `public.documents` stores metadata; the private `finance-documents` bucket stores actual files. The current web UI uploads, lists, opens via short-lived signed URLs, and deletes documents.
- A durable document-processing queue is implemented in repository migrations `20261026130000_document_processing_queue.sql` and `20261026131500_document_processing_retry_cap.sql`, with owner-bound jobs, RLS, atomic `SKIP LOCKED` claims, leases, retries and service-role-only queue RPCs.
- Those document queue migrations are not present in the live migration ledger as of the current audit snapshot and therefore are not represented as production-applied.
- The worker intentionally does not claim or process document jobs yet. `apps/worker/src/worker.ts` explicitly keeps document processing disabled until a production-ready processor is defined and verified.

## Job A — in-app notification generation

The migration `20261026112538_worker_notification_batch.sql` adds a server-only batch RPC and moves user-scoped generation into a private helper. The user-facing RPC continues to require a signed-in user. The worker RPC is restricted to `service_role`, serializes generation per user with a transaction-scoped advisory lock, and returns only an inserted-row count.

Live verification completed:
1. The migration is present in the live migration ledger.
2. The batch RPC is `SECURITY DEFINER` with a controlled search path.
3. Ordinary `anon`/`authenticated` execution is not granted.
4. The worker calls the RPC with `SUPABASE_SERVICE_ROLE_KEY` and fails closed when configuration is missing.
5. The worker rejects non-HTTPS Supabase URLs except localhost and uses a request timeout.
6. The worker does not echo PostgREST response bodies into errors.

Remaining release checks:
- Verify duplicate prevention and concurrency behavior with synthetic records in an isolated environment.
- Verify failed batches remain observable in monitoring.
- Keep the service-role key only in the worker runtime secret store.

## Job B — durable document processing

### Repository implementation

The queue migration creates `public.document_processing_jobs` with:
- document ID and owner ID;
- job type and lifecycle status;
- attempt count and next-attempt time;
- lease and worker identity;
- bounded error fields;
- timestamps and completion time;
- unique `(document_id, job_type)` protection against duplicate enqueue.

The migration automatically enqueues a metadata-extraction job after a document insert. The claim RPC uses row locking with `SKIP LOCKED`, is service-role-only, and applies bounded lease parameters. Completion, failure/retry and expired-lease recovery are also service-role-only. The retry-cap migration adds a finite attempt budget so permanently failing jobs become terminally failed.

Repository tests assert the queue's owner binding, RLS, atomic claim behavior, service-role boundary, lease/retry controls and automatic enqueue behavior.

### Production state

The queue is **not production-applied**. It must not be treated as live merely because the SQL exists in the repository or because a previous deployment was created from a commit containing the migration file.

The current worker also does **not** call the queue claim/complete/fail RPCs. OCR/extraction remains intentionally disabled. This is the correct state until the actual processing operation is defined, including supported MIME types, size/time limits, resource limits, retention, processor implementation, idempotency and observability.

### Acceptance gates before activation

- At most one active lease per job; expired leases reclaim safely.
- Duplicate enqueue is idempotent.
- Missing files, unsupported files, oversized files and transient failures have explicit states.
- Users cannot enqueue or read another user's jobs.
- Storage and integration tests use isolated storage and synthetic files.
- Worker concurrency is safe for more than one replica.
- OCR/extraction libraries are lazy-loaded and resource-bounded.
- Extracted financial text is not written to ordinary logs.

## Release sequence

1. Keep notification processing on the verified production path.
2. Treat document queue migrations as pending until deliberately reviewed and applied.
3. Define the document processor and supported operations before enabling claims.
4. Apply the queue to an isolated Supabase project first and run RLS, role, retry, lease, idempotency and storage tests.
5. Implement and test the worker processor, including failure recovery and observability.
6. Run a non-production soak test with realistic synthetic documents.
7. Only after all checks pass, apply the reviewed queue migrations to production and deploy the processor.

## Current status

- **Notification worker:** 🟢 implemented and live-verified.
- **Document queue infrastructure:** 🟡 implemented in repository, not production-applied.
- **Document processor/OCR worker:** ⬜ intentionally disabled pending definition and verification.
- **Production certification:** 🟡 blocked until the document-processing decision is completed or explicitly accepted as deferred, plus the broader production gates in `docs/FINAL_TECHNICAL_AUDIT.md`.
