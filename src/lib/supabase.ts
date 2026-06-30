import { createClient } from '@supabase/supabase-js'
import { getSupabaseHost } from '@/lib/supabaseQueryLog'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable.')
}

if (import.meta.env.DEV) {
  console.info('[supabase] client configured for host:', getSupabaseHost(supabaseUrl))
  console.info('[supabase] using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
