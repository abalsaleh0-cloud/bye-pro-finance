import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  import.meta.dirname,
  "../../../../supabase/migrations/20261026130000_document_processing_queue.sql",
);

const migration = readFileSync(migrationPath, "utf8");

describe("document processing queue migration", () => {
  it("creates a durable, owner-bound queue", () => {
    expect(migration).toContain("create table if not exists public.document_processing_jobs");
    expect(migration).toContain("document_id uuid not null references public.documents(id) on delete cascade");
    expect(migration).toContain("user_id uuid not null references auth.users(id) on delete cascade");
    expect(migration).toContain("unique (document_id, job_type)");
    expect(migration).toContain("alter table public.document_processing_jobs enable row level security");
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
  });

  it("uses an atomic SKIP LOCKED claim and service-role boundary", () => {
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("status='processing'");
    expect(migration).toContain("SERVICE_ROLE_REQUIRED");
    expect(migration).toContain("grant execute on function public.claim_document_processing_jobs(text, integer, integer) to service_role");
  });

  it("supports lease expiry, retries, and bounded errors", () => {
    expect(migration).toContain("requeue_expired_document_processing_jobs");
    expect(migration).toContain("least(3600");
    expect(migration).toContain("left(coalesce(p_error_code");
    expect(migration).toContain("left(coalesce(p_error_message");
  });

  it("enqueues a job automatically when a document is inserted", () => {
    expect(migration).toContain("enqueue_document_processing_job");
    expect(migration).toContain("after insert on public.documents");
    expect(migration).toContain("on conflict (document_id, job_type) do nothing");
  });
});
