import { isSupabaseConfigured } from '@/lib/supabase'
import { authService, AuthServiceError } from '@/services/authService'
import { SecurePasswordForm } from '@/components/auth/SecurePasswordForm'

import { settingsInnerCardClassName } from '@/components/settings/SettingsControls'

export function ChangePasswordCard() {
  if (!isSupabaseConfigured) {
    return (
      <div className={settingsInnerCardClassName}>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Change Password</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Coming later — Supabase Auth is not configured in this environment.
        </p>
      </div>
    )
  }

  async function handleUpdatePassword(password: string) {
    try {
      await authService.updatePassword(password)
    } catch (error) {
      throw new AuthServiceError(
        error instanceof AuthServiceError
          ? error.message
          : 'Unable to update password. Please try again.',
      )
    }
  }

  return <SecurePasswordForm variant="change" onSubmit={handleUpdatePassword} />
}
