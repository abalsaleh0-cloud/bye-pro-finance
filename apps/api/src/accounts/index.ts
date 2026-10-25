import type { SupabaseClient } from "@supabase/supabase-js";

/** Public account fields returned to the authenticated owner. Never use a service-role client here. */
export const ACCOUNT_SELECT =
  "id,name,type,currency_code,opening_balance,current_balance,institution_name,last_four,is_active,created_at,updated_at" as const;

export type AccountApiRecord = {
  id: string;
  name: string;
  type: string;
  currency_code: string;
  opening_balance: number;
  current_balance: number;
  institution_name: string | null;
  last_four: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Lists accounts using the caller's user-scoped Supabase client.
 * Row-level security remains the authority for tenant isolation.
 */
export async function listAccounts(client: SupabaseClient) {
  return client.from("accounts").select(ACCOUNT_SELECT).order("created_at", { ascending: false });
}
