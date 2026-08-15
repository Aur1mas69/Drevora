import { NativeBiometricAppLockSettings } from '@/components/worker/NativeBiometricAppLockSettings'
import { WorkerDeleteAccountDialog } from '@/components/worker/WorkerDeleteAccountDialog'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { ChangePasswordCard } from '@/components/settings/ChangePasswordCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * Worker Password & Security — change password via Supabase auth;
 * Native Android also shows biometric App Lock controls;
 * Delete account schedules a 30-day deletion via Edge Function.
 */
export default function WorkerSecuritySettingsPage() {
  const { t } = useTranslation('worker')
  const isDark = useIsWorkerDarkMode()
  const navigate = useNavigate()
  const { session, signOut } = useAuth()
  const email = session?.user.email?.trim() || null
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleDeletionScheduled(scheduledFor: string) {
    setDeleteOpen(false)
    await signOut()
    navigate(LOGIN_PATH, {
      replace: true,
      state: {
        accountDeletionScheduled: true,
        accountDeletionScheduledFor: scheduledFor,
      },
    })
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-3">
        <WorkerSettingsBackLink />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
            {t('security.title', { defaultValue: 'Password & Security' })}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
            {email
              ? t('security.subtitleFor', {
                  email,
                  defaultValue: `Manage your sign-in password for ${email}.`,
                })
              : t('security.subtitle', {
                  defaultValue: 'Manage your sign-in password',
                })}
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-[1.5rem]">
        <ChangePasswordCard />
      </section>

      {import.meta.env.MODE === 'native' ? (
        <section
          className={workerAccentCardClass(
            1,
            isDark,
            'worker-card overflow-hidden rounded-[1.5rem]',
          )}
        >
          <div
            className={cn(
              'worker-accent-divider border-b px-4 py-3',
              !isDark && 'border-[color:var(--worker-border)]',
            )}
          >
            <h2
              className={cn(
                'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
                !isDark && 'text-[color:var(--worker-text-muted)]',
              )}
            >
              Device lock
            </h2>
          </div>
          <NativeBiometricAppLockSettings />
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-3 text-sm text-[color:var(--worker-text-secondary)]">
          Biometric App Lock is available in the Android app.
        </p>
      )}

      <section
        className={cn(
          '!mt-2 rounded-2xl border bg-[color:var(--worker-card)] px-3.5 py-3',
          isDark ? 'border-rose-500/35' : 'border-rose-200/80',
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h2
              className={cn(
                'flex items-center gap-1.5 text-sm font-semibold',
                isDark ? 'text-rose-300' : 'text-rose-700',
              )}
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden />
              Delete account
            </h2>
            <p className="text-sm leading-5 text-[color:var(--worker-text-secondary)]">
              Schedule permanent account deletion with a 30-day cancellation period.
            </p>
            {!email ? (
              <p className="text-xs text-[color:var(--worker-text-muted)]">
                Sign in again to delete your account.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!email}
            onClick={() => setDeleteOpen(true)}
            className={cn(
              'h-9 w-full shrink-0 rounded-xl px-3 text-sm font-medium sm:w-auto',
              isDark
                ? 'border-rose-400/45 bg-transparent text-rose-300 hover:bg-rose-500/10 hover:text-rose-200'
                : 'border-rose-300 bg-transparent text-rose-700 hover:bg-rose-50 hover:text-rose-800',
            )}
          >
            Delete account
          </Button>
        </div>
      </section>

      {email ? (
        <WorkerDeleteAccountDialog
          open={deleteOpen}
          accountEmail={email}
          onCancel={() => setDeleteOpen(false)}
          onScheduled={(scheduledFor) => {
            void handleDeletionScheduled(scheduledFor)
          }}
        />
      ) : null}
    </div>
  )
}
