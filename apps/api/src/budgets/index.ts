import type { SupabaseClient } from "@supabase/supabase-js";
import { validateBudgetInput, type BudgetInput } from "../finance/budgets.js";

export const BUDGET_SELECT =
  "id,category_id,name,amount,currency_code,period,start_date,end_date,is_active,created_at,updated_at" as const;

export type BudgetApiRecord = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency_code: string;
  period: BudgetInput["period"];
  start_date: string;
  end_date: string | null;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Lists only rows visible to the authenticated user-scoped client. */
export async function listBudgets(client: SupabaseClient) {
  return client.from("budgets")
    .select(BUDGET_SELECT)
    .order("start_date", { ascending: false })
    .limit(100);
}

/** Validates then creates a budget under the verified session identity. */
export async function createBudget(client: SupabaseClient, userId: string, input: unknown) {
  const validated = validateBudgetInput(input);
  if (!validated.ok) return { data: null, error: validated.error, status: 400 as const };
  const result = await client.from("budgets")
    .insert({ ...validated.value, user_id: userId })
    .select(BUDGET_SELECT)
    .single();
  if (result.error) return { data: null, error: "BUDGET_CREATE_FAILED", status: 400 as const };
  return { data: result.data, error: null, status: 201 as const };
}
