import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "database/migrations/phase7_ownership_and_financial_integrity.sql"),
  "utf8",
);

const securityMigration = readFileSync(
  resolve(process.cwd(), "database/migrations/phase7_security_hardening.sql"),
  "utf8",
);

describe("database security invariants", () => {
  it("forces RLS on every financial table", () => {
    const tables = [
      "profiles",
      "accounts",
      "categories",
      "transactions",
      "transfers",
      "budgets",
      "debts",
      "bills",
      "savings_goals",
      "assets",
      "documents",
      "notifications",
      "audit_logs",
    ];

    for (const table of tables) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} force row level security;`));
    }
  });

  it("locks down anonymous financial table privileges", () => {
    const normalizedMigration = securityMigration.replace(/\s+/g, " ").trim();

    expect(normalizedMigration).toContain(
      "revoke all privileges on table public.profiles, public.accounts, public.categories, public.transactions, public.transfers, public.budgets, public.debts, public.bills, public.savings_goals, public.assets, public.documents, public.notifications, public.audit_logs from anon;",
    );
  });

  it("enforces transaction account ownership at the database boundary", () => {
    expect(migration).toContain("ACCOUNT_OWNERSHIP_MISMATCH");
    expect(migration).toContain("CATEGORY_OWNERSHIP_MISMATCH");
    expect(migration).toContain("transactions_validate_ownership");
  });

  it("enforces both sides of transfer ownership", () => {
    expect(migration).toContain("FROM_ACCOUNT_OWNERSHIP_MISMATCH");
    expect(migration).toContain("TO_ACCOUNT_OWNERSHIP_MISMATCH");
    expect(migration).toContain("transfers_validate_ownership");
  });

  it("keeps privileged ownership trigger execution out of client roles", () => {
    expect(migration).toContain(
      "revoke execute on function public.validate_finance_ownership() from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.validate_finance_ownership() to service_role;",
    );
  });
});
