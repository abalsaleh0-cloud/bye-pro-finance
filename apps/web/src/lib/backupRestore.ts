export type BackupTransaction = {
  id?: string | null;
  account_id: string;
  amount: number | string;
  type: string;
  transaction_date: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

function transactionKey(row: BackupTransaction): string {
  return [
    row.account_id,
    Number(row.amount),
    row.type,
    String(row.transaction_date).slice(0, 10),
    (row.description ?? "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Skip records with a matching original ID or backup source ID.
 * The field-based fallback is deliberately restricted to legacy records
 * previously imported without a source ID, since legitimate transactions
 * may otherwise share the same amount, date, type, account and description.
 */
export function selectFreshBackupTransactions<T extends BackupTransaction>(
  incoming: T[],
  existing: BackupTransaction[],
): T[] {
  const existingIds = new Set(existing.map((row) => row.id).filter(Boolean));
  const importedSourceIds = new Set(
    existing.map((row) => row.metadata?.backup_source_id).filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
  );
  const legacyKeys = new Set(
    existing
      .filter((row) => row.metadata?.imported_from_backup === true && !row.metadata?.backup_source_id)
      .map(transactionKey),
  );
  const seenSourceIds = new Set<string>();

  return incoming.filter((row) => {
    if (row.id && (existingIds.has(row.id) || importedSourceIds.has(row.id) || seenSourceIds.has(row.id))) {
      return false;
    }
    if (row.id) seenSourceIds.add(row.id);
    if (!row.id && legacyKeys.has(transactionKey(row))) return false;
    return true;
  });
}
