/**
 * Supabase client singleton.
 *
 * Uses the anon key — suitable for public reads and RLS-gated writes.
 * The singleton is pinned to `globalThis` in development to survive Hot Module
 * Replacement without spawning duplicate GoTrueClient instances (which cause
 * "Multiple GoTrueClient instances" warnings and can corrupt auth state).
 * In production, module-level caching is sufficient.
 */
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
