/**
 * Backend selector. When all three Supabase env vars are present the
 * production Supabase backend is used; otherwise the app falls back to the
 * local in-memory backend so development/preview works with zero setup.
 */

import { localBackend } from "./local"
import { supabaseBackend } from "./supabase"
import type { Backend } from "./contract"

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export function getBackend(): Backend {
  return isSupabaseConfigured() ? supabaseBackend : localBackend
}

export type { Backend } from "./contract"
