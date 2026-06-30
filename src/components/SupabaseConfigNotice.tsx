import {
  isSupabaseConfigured,
  missingSupabaseEnvVars,
  supabaseConfigurationMessage,
} from '@/lib/supabase'

export function SupabaseConfigNotice() {
  if (isSupabaseConfigured || !supabaseConfigurationMessage) {
    return null
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Supabase is not configured for this deployment.</p>
      <p className="mt-1">{supabaseConfigurationMessage}</p>
      <p className="mt-2 font-mono text-xs text-amber-900/90">
        Required Vercel variables: {missingSupabaseEnvVars.join(', ')}
      </p>
    </div>
  )
}
