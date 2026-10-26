# BYE PRO FINANCE Worker

The worker is a separate Node.js process. It provides a guarded scheduler and sequential job runner. Notification processing now calls a dedicated service-only Supabase RPC; document processing remains intentionally disabled until a durable queue and processing operation are implemented.

## Runtime configuration

- `SUPABASE_URL`: HTTPS URL for the intended Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key; never expose it to the browser, logs, or source control.
- `WORKER_INTERVAL_MS`: optional interval, defaults to 60000 ms and is validated.

The notification RPC migration is checked into `supabase/migrations` but must be reviewed and applied through the controlled release process before the worker is enabled against production. Until that migration is applied, the RPC call fails closed and the worker logs the failure; it does not fall back to the user-session RPC.

## Safety properties and limits

- A cycle is not overlapped by the scheduler within one process.
- Notification inserts are serialized per user in the database helper to support retries and concurrent UI/worker calls.
- The batch endpoint is granted only to `service_role` and checks the request role.
- The worker reports aggregate inserted counts only, not notification content or user identifiers.
- Multiple worker replicas still require operational concurrency controls.
- Documents are not scanned or modified by the worker. The existing web UI uploads, lists, opens, and deletes files in the private `finance-documents` bucket. A durable processing queue does not yet exist.

See [Worker job readiness](../../docs/worker-jobs-readiness.md) for the schema review and document-queue acceptance criteria.
