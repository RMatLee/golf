import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton — prevents duplicate GoTrueClient instances during HMR in dev
const globalForSupabase = globalThis as unknown as { supabase: SupabaseClient };

export const supabase =
  globalForSupabase.supabase ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabase = supabase;
}
