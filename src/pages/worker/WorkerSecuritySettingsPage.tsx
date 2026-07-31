import { NativeBiometricAppLockSettings } from '@/components/worker/NativeBiometricAppLockSettings'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { ChangePasswordCard } from '@/components/settings/ChangePasswordCard'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Worker Password & Security — change password via Supabase auth;
 * Native Android also shows biometric App Lock controls.
 */
export default function WorkerSecuritySettingsPage() {
  const { session } = useAuth()
  const email = session?.user.email?.trim() || null

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-3">
        <WorkerSettingsBackLink />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
            Password &amp; Security
          </h1>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
            Manage your sign-in password
            {email ? (
              <>
                {' '}
                for <span className="font-medium text-[color:var(--worker-text)]">{email}</span>
              </>
            ) : null}
            .
          </p>
        </div>
      </header>

      <section className="worker-card overflow-hidden rounded-[1.5rem] p-4">
        <ChangePasswordCard />
      </section>

      {import.meta.env.MODE === 'native' ? (
        <section className="worker-card overflow-hidden rounded-[1.5rem]">
          <div className="border-b border-[color:var(--worker-border)] px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]">
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
    </div>
  )
}
