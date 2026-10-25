import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const household = readFileSync("apps/web/src/components/HouseholdView.tsx", "utf8");
const migration = readFileSync("database/migrations/phase9_household_expenses.sql", "utf8");
const fkFix = readFileSync("database/migrations/phase9_household_expenses_fk_fix.sql", "utf8");

describe("household expenses module contract", () => {
  it("uses local calendar dates for monthly boundaries", () => {
    expect(household).toContain("const localDate = (d: Date)");
    expect(household).toContain("const monthStart = ()");
    expect(household).toContain("const monthEnd = ()");
    expect(household).not.toContain("new Date(d.getFullYear(), d.getMonth(), 1).toISOString()");
  });

  it("forces per-user row-level security on all household tables", () => {
    for (const table of ["household_members", "household_budgets", "household_expenses"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
      expect(migration).toContain(`alter table public.${table} force row level security;`);
      expect(migration).toContain(`public.${table} for select to authenticated using ((select auth.uid()) = user_id)`);
      expect(migration).toContain(`create policy ${table}_insert_own on public.${table} for insert to authenticated with check`);
    }
    expect(migration).toContain("revoke all privileges on public.household_members, public.household_budgets, public.household_expenses from anon;");
  });

  it("preserves the expense owner when a household member is deleted", () => {
    expect(migration).toContain("on delete set null (member_id)");
    expect(fkFix).toContain("on delete set null (member_id)");
    expect(fkFix).toContain("household_expenses_member_owner_idx");
    expect(fkFix).not.toContain("on delete set null;");
  });

  it("provides member, budget, and expense create/delete workflows with validation", () => {
    for (const marker of ["addMember", "removeMember", "addBudget", "removeBudget", "addExpense", "removeExpense"]) {
      expect(household).toContain(marker);
    }
    expect(household).toContain("amount <= 0");
    expect(household).toContain("monthlyBudget - totalMonth");
    expect(household).toContain("is_recurring");
  });
});
