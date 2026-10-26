import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  import.meta.dirname,
  "../../../../supabase/migrations/20261026131500_document_processing_retry_cap.sql",
);

const migration = readFileSync(migrationPath, "utf8");

describe("document processing retry policy", () => {
  it("enforces a finite retry budget", () => {
    expect(migration).toContain("v_max_attempts constant integer := 8");
    expect(migration).toContain("p_retry and v_attempt < v_max_attempts");
    expect(migration).toContain("else 'failed'");
  });

  it("keeps the service-role boundary and bounded backoff", () => {
    expect(migration).toContain("SERVICE_ROLE_REQUIRED");
    expect(migration).toContain("least(3600");
    expect(migration).toContain("left(coalesce(p_error_code");
    expect(migration).toContain("left(coalesce(p_error_message");
  });
});
