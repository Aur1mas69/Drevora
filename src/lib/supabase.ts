import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseHost } from '@/lib/supabaseQueryLog'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const missingSupabaseEnvVars = [
  !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
  !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter((name): name is string => name !== null)

let supabaseInitError: string | null = null
let supabaseClient: SupabaseClient | null = null

if (missingSupabaseEnvVars.length === 0) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })

    if (import.meta.env.DEV) {
      console.info('[supabase] client configured for host:', getSupabaseHost(supabaseUrl))
    }
  } catch (error) {
    supabaseInitError =
      error instanceof Error
        ? error.message
        : 'Failed to initialize the Supabase client.'
  }
}

export const isSupabaseConfigured = supabaseClient !== null

export const supabaseConfigurationMessage = isSupabaseConfigured
  ? null
  : supabaseInitError
    ? `Supabase client initialization failed: ${supabaseInitError}`
    : `Missing Supabase environment variable(s): ${missingSupabaseEnvVars.join(', ')}. Add them in Vercel project settings and redeploy.`

export function requireSupabase(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      supabaseConfigurationMessage ?? 'Supabase is not configured for this deployment.',
    )
  }

  return supabaseClient
}

/** Supabase client when configured; otherwise null. Prefer requireSupabase() in services. */
export const supabase = supabaseClient
