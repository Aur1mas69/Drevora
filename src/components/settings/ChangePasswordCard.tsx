import { isSupabaseConfigured } from '@/lib/supabase'
import { authService, AuthServiceError } from '@/services/authService'
import { SecurePasswordForm } from '@/components/auth/SecurePasswordForm'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'

import { settingsInnerCardClassName } from '@/components/settings/SettingsControls'

export function ChangePasswordCard() {
  const title = useWorkerChromeText('security.changePasswordTitle', 'Change Password')
  const supabaseMissing = useWorkerChromeText(
    'security.supabaseNotConfigured',
    'Coming later — Supabase Auth is not configured in this environment.',
  )
  const updateFailed = useWorkerChromeText(
    'security.passwordUpdateFailed',
    'Unable to update password. Please try again.',
  )

  if (!isSupabaseConfigured) {
    return (
      <div className={settingsInnerCardClassName}>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {supabaseMissing}
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
          : updateFailed,
      )
    }
  }

  return <SecurePasswordForm variant="change" onSubmit={handleUpdatePassword} />
}
