import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

type UserSettingsRow = {
  user_id: string;
  theme: "dark" | "light";
  locale: "ar" | "en";
  timezone: string;
  currency_code: string;
  date_format: string;
  number_format: string;
  email_notifications: boolean;
  transaction_alerts: boolean;
  bill_reminders: boolean;
  budget_alerts: boolean;
  created_at: string;
  updated_at: string;
};

type UserSettingsTable = {
  Row: UserSettingsRow;
  Insert: Partial<UserSettingsRow> & Pick<UserSettingsRow, "user_id">;
  Update: Partial<UserSettingsRow>;
  Relationships: [];
};

/**
 * The schema snapshot is generated and still predates the live user_settings
 * table. Extend it here so the typed client cannot reject the isolated
 * per-user settings feature while the generated snapshot is regenerated.
 */
type DatabaseWithUserSettings = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      user_settings: UserSettingsTable;
    };
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient<DatabaseWithUserSettings>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
