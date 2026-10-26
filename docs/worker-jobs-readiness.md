# Worker job readiness and implementation plan

## Verified baseline

Reviewed against repository commit `7fa2ee41511750fd376a6111dadb8ed23785a0ce` and the connected Supabase project using read-only inspection.

- `apps/worker/src/worker.ts` currently runs two placeholder callbacks that only log timestamps.
- The scheduler prevents overlapping cycles **within one process**, validates the interval, and stops scheduling on shutdown. It is not a distributed lock.
- `public.notifications` has `user_id`, `title`, `body`, `type`, `is_read`, `data`, and `created_at`.
- The existing `public.refresh_finance_notifications()` function requires `auth.uid()` and generates bill, debt, and budget alerts for the signed-in user. The web Notifications view calls it on load. A service-role worker cannot safely call this function as-is because its request has no end-user identity.
- `public.documents` stores metadata (`user_id`, `file_name`, `storage_path`, `mime_type`, `file_size`, `related_transaction_id`, `metadata`, `created_at`). The private `finance-documents` storage bucket contains the actual files. The current UI already uploads, lists, opens via short-lived signed URLs, and deletes documents.
- There is no durable document-processing queue or processing-state column in the inspected schema. The API documents module is only a type declaration.
- No production database migration or Vercel deployment was performed during this review.

## Job A — real notification generation

### Required design

1. Add a reviewed database migration for a service-only, explicitly scoped batch RPC. It must not impersonate `auth.uid()` or expose a caller-supplied user ID to ordinary authenticated clients.
2. Have the RPC enumerate only eligible users, generate the existing bill/debt/budget rules, and return counts rather than sensitive notification contents.
3. Make deduplication safe under retries and concurrent invocations. Prefer a database-enforced unique idempotency key plus conflict-safe inserts; reconcile any existing duplicates before creating a unique index.
4. Bound work per call, use the user's relevant date/timezone policy, and emit aggregate structured metrics. A failed user batch must not silently mark the whole cycle successful.
5. Avoid sending external push/email messages in the first iteration. The first production-capable milestone should only create in-app notification rows.

### Acceptance tests

- Due/overdue bills, debts due within the configured window, and budgets at the threshold produce the expected notification.
- Re-running the same batch produces no duplicate rows.
- Concurrent calls do not duplicate rows.
- One user's run never reads or writes another user's notification data.
- Anonymous and ordinary authenticated clients cannot call the service-only batch RPC.
- Invalid or missing server configuration causes a clear startup failure; no fallback to public credentials.
- Tests run against a disposable database or isolated test project, not production user records.

## Job B — document processing

### Required design decision

Do not treat every uploaded file as a queued job and do not run OCR/extraction by scanning the entire storage bucket. First define the desired operation (for example, metadata validation, OCR/extraction, or user-requested export), its supported MIME types, size/time limits, retention, and failure/retry behavior.

When a real processing feature is approved, add a durable queue with at least:
- job ID, document ID, owner ID, job type, status, attempt count, next-attempt time;
- lease/claim timestamp and worker identifier;
- bounded error code/message, created/updated timestamps, and completion timestamp;
- uniqueness/idempotency key and foreign keys to the document and owner.

Claim jobs atomically (for example, with row locking and `SKIP LOCKED` or a carefully reviewed claim RPC), enforce owner matching with the document metadata, and use bounded retries with backoff. Do not store extracted sensitive text in ordinary logs. Keep the private Storage bucket and existing per-user access policies intact. A document row alone is not evidence that its Storage object exists.

### Acceptance tests

- A job can be claimed by at most one active worker lease.
- Expired leases can be reclaimed safely.
- Duplicate enqueue attempts do not create duplicate processing.
- Missing files, unsupported types, oversized files, and transient provider failures produce explicit terminal/retry states.
- A user cannot enqueue or read another user's document job.
- No file is deleted by retry/failure handling.
- Integration tests use isolated storage and synthetic files.

## Release sequence

1. Complete CI, UI E2E, and authentication E2E for the scheduler change.
2. Implement and test notification batch RPC + worker client against an isolated Supabase project; review migration SQL and RLS/grants.
3. Implement document queue only after the processing operation and resource limits are specified; test claim/retry/idempotency separately.
4. Run worker build/unit/integration tests and a non-production soak test.
5. Review deployment secrets and worker hosting/replica count; configure distributed concurrency control if multiple replicas are possible.
6. Only after all checks pass, request explicit release approval, apply the reviewed migration, deploy the worker, and observe counts/errors. Web deployment remains a separate final-stage decision.

## Current blocker

The worker's notification callback cannot safely reuse the user-session RPC, and document processing has no durable queue or specified processing operation. Wiring either callback directly to production now would be unsafe or misleading. The next implementation increment should be the service-only notification batch RPC and its isolated tests; document processing should follow the explicit queue design above.
