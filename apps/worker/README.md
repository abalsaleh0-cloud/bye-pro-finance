# BYE PRO FINANCE Worker

The worker is a separate Node.js process. It currently provides a guarded scheduler and sequential job runner, but **its notification and document callbacks are placeholders**: they only log messages and do not process records.

## Current behavior

- `WORKER_INTERVAL_MS` is validated before the loop starts.
- A new cycle is scheduled only after the previous cycle finishes, so one process does not overlap its own cycles.
- `SIGINT` and `SIGTERM` stop future cycles.
- Individual job failures are logged and do not prevent later jobs from running.
- These protections do not provide distributed locking across multiple worker replicas.

## Safety contract before enabling real jobs

1. Never use a browser/client key in the worker. Use a server-only secret supplied through the runtime environment, and fail closed if required configuration is missing.
2. Do not run data-changing jobs against production until the migration has been reviewed and applied through the normal release process.
3. Every mutating job must be idempotent, tenant-scoped, bounded per cycle, and observable through structured counts and errors.
4. Do not treat a database row as proof that a storage object exists, or delete storage objects as an automatic cleanup without a separately reviewed retention policy.
5. Keep notification generation and document processing independently configurable. Do not claim a document is processed until a durable job result is recorded.
6. A successful GitHub workflow is not proof that a worker has been deployed or run against production.

See [Worker job readiness](../../docs/worker-jobs-readiness.md) for the schema review, recommended implementation sequence, and acceptance checks.
