# BYE PRO FINANCE Worker

The worker is a separate Node.js process. It provides a guarded scheduler and sequential job runner. Notification processing calls a dedicated service-only Supabase RPC. Document processing now has a durable queue with ownership, atomic claiming, leases, retries, and bounded errors; the actual OCR/extraction processor remains disabled until its processing contract is implemented.

## Runtime configuration

- `SUPABASE_URL`: HTTPS URL for the intended Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key; never expose it to the browser, logs, or source control.
- `WORKER_INTERVAL_MS`: optional interval, defaults to 60000 ms and is validated.

The notification and document queue migrations are checked into `supabase/migrations` and must be reviewed and applied through the controlled release process before production worker execution is enabled.

## Safety properties and limits

- A cycle is not overlapped by the scheduler within one process.
- Notification inserts are serialized per user in the database helper to support retries and concurrent UI/worker calls.
- Notification and document queue RPCs are granted only to `service_role` and check the request role.
- Document jobs are bound to their document owner and visible to authenticated users only through a read-only RLS policy.
- Queue claims use `FOR UPDATE SKIP LOCKED`, worker leases, bounded retry delays, and worker ownership checks for completion/failure.
- Multiple worker replicas can safely compete for jobs at the database claim boundary.
- The worker does not scan, download, delete, or mutate document objects. The existing web UI manages the private `finance-documents` bucket.
- No OCR/extraction result is fabricated: the queue is infrastructure only until a real processor is implemented.

See [Worker job readiness](../../docs/worker-jobs-readiness.md) for the schema review and document-queue acceptance criteria.
