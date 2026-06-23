import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, features } from "../env.js";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase admin client (service-role key). Lazily created and only
 * available on the backend — the service-role key must never reach the client.
 * Returns null when Supabase is not configured so callers can fall back.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!features.supabase) return null;
  if (!client) {
    client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return client;
}
