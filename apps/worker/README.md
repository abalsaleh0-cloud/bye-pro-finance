# BYE PRO FINANCE Worker

The worker is a separate Node.js process. It provides a guarded scheduler and sequential job runner. Notification processing calls a dedicated service-only Supabase RPC. Document processing validates persisted document-row metadata and records `metadata_validated`; it does not download file contents, perform OCR, or extract financial content. The durable queue uses ownership checks, atomic claims, leases, bounded errors, and a maximum of eight attempts including lease-expiry recovery.

## Runtime configuration

- `SUPABASE_URL`: HTTPS URL for the intended Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key; never expose it to the browser, logs, or source control.
- `WORKER_INTERVAL_MS`: optional interval, defaults to 60000 ms and is validated.
- `WORKER_ID`: optional stable worker identifier; generated automatically when omitted.

## Container runtime

The repository includes `Dockerfile.worker` and an opt-in Compose service. The worker does not start during ordinary `docker compose up`; enable it explicitly with `docker compose --profile worker up -d --build worker`. Supply `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through the shell or an untracked `.env` file. Never put real secrets in the repository. Check logs with `docker compose logs -f worker`.

**Do not start the worker against production until the notification and document-queue migrations have passed the release checks and been applied deliberately.**

The notification and document queue migrations are checked into `supabase/migrations` and must be reviewed and applied through the controlled release process before production worker execution is enabled.

## Safety properties and limits

- A cycle is not overlapped by the scheduler within one process.
- Notification inserts are serialized per user in the database helper to support retries and concurrent UI/worker calls.
- Notification and document queue RPCs are granted only to `service_role` and check the request role.
- Queue table access is not granted to `anon` or `authenticated`; the owner RLS policy is defense in depth, not a client-readable queue API.
- Queue claims use `FOR UPDATE SKIP LOCKED`, worker leases, bounded retry delays, and worker ownership checks for completion/failure.
- Multiple worker replicas can safely compete for jobs at the database claim boundary.
- The worker does not download, delete, or mutate document objects. It updates only the document metadata JSON; the existing web UI manages the private `finance-documents` bucket.
- No OCR/extraction result is fabricated: the worker currently validates persisted metadata only. Real file-content extraction is a separate future implementation.

See [Worker job readiness](../../docs/worker-jobs-readiness.md) for the schema review and document-queue acceptance criteria.
