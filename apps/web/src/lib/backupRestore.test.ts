import { describe, expect, it } from "vitest";
import { selectFreshBackupTransactions, type BackupTransaction } from "./backupRestore.js";

const row = (overrides: Partial<BackupTransaction> = {}): BackupTransaction => ({
  id: "source-1",
  account_id: "account-1",
  amount: 25,
  type: "expense",
  transaction_date: "2026-10-01",
  description: "Groceries",
  metadata: {},
  ...overrides,
});

describe("backup restore duplicate detection", () => {
  it("skips a source ID that already exists as a transaction ID", () => {
    expect(selectFreshBackupTransactions([row()], [row()])).toEqual([]);
  });

  it("skips a source ID already recorded in backup_source_id", () => {
    expect(selectFreshBackupTransactions([row({ id: "original-id" })], [
      row({ id: "new-database-id", metadata: { imported_from_backup: true, backup_source_id: "original-id" } }),
    ])).toEqual([]);
  });

  it("keeps distinct source IDs even when transaction fields are identical", () => {
    const first = row({ id: "source-a" });
    const second = row({ id: "source-b" });
    expect(selectFreshBackupTransactions([first, second], [])).toEqual([first, second]);
  });

  it("uses the field-based fallback only for previously imported legacy rows without a source ID", () => {
    const incoming = row({ id: null });
    const legacy = row({ id: "legacy-db-id", metadata: { imported_from_backup: true } });
    expect(selectFreshBackupTransactions([incoming], [legacy])).toEqual([]);
    expect(selectFreshBackupTransactions([incoming], [row({ metadata: {} })])).toEqual([incoming]);
  });

  it("does not treat a repeated source ID inside one backup as two new transactions", () => {
    const first = row({ id: "same-source" });
    const second = row({ id: "same-source", description: "different display text" });
    expect(selectFreshBackupTransactions([first, second], [])).toEqual([first]);
  });
});
