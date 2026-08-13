import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useState, type FormEvent, type ReactNode } from 'react'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import { ShieldCheck } from 'lucide-react'

export function OfficeMfaShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await signOut()
      navigate(LOGIN_PATH, { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[#F6F9FF] px-4 py-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(191,219,254,0.55),_transparent_58%),radial-gradient(ellipse_at_bottom,_rgba(224,242,254,0.7),_transparent_52%)]"
        aria-hidden
      />

      <section className="relative w-full max-w-lg rounded-[20px] border border-[rgba(75,120,220,0.14)] bg-white/95 p-6 shadow-[0_24px_60px_rgba(37,99,235,0.10)] sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#BFDBFE]">
            <ShieldCheck className="size-5" strokeWidth={1.9} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-7">{children}</div>

        <Button
          type="button"
          variant="ghost"
          className="mt-5 h-11 w-full rounded-[14px] text-sm font-medium text-slate-500 hover:bg-[#F8FBFF] hover:text-[#2563EB]"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </section>
    </div>
  )
}

export function OfficeMfaCodeForm({
  code,
  onCodeChange,
  onSubmit,
  isSubmitting,
  errorMessage,
  submitLabel,
}: {
  code: string
  onCodeChange: (value: string) => void
  onSubmit: () => Promise<void>
  isSubmitting: boolean
  errorMessage: string | null
  submitLabel: string
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit()
  }

  const errorId = 'office-mfa-code-error'

  return (
    <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <label
          htmlFor="office-mfa-code"
          className="text-sm font-semibold text-[#2A376F]"
        >
          Authenticator code
        </label>
        <input
          id="office-mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(event) =>
            onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))
          }
          className="mt-2 h-14 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-center text-[1.35rem] font-semibold tracking-[0.42em] text-[#2A376F] shadow-sm ring-1 ring-[rgba(75,120,220,0.16)] outline-none placeholder:tracking-[0.42em] placeholder:text-slate-300 focus:ring-3 focus:ring-[#2563EB]/25"
          placeholder="000000"
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? errorId : undefined}
        />
      </div>

      {errorMessage ? (
        <p
          id={errorId}
          className="text-sm font-medium text-rose-700"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full rounded-[14px] bg-[#2563EB] text-sm font-semibold text-white shadow-[0_12px_32px_rgba(37,99,235,0.35)] hover:bg-[#1d4ed8]"
        disabled={isSubmitting || code.length !== 6}
      >
        {isSubmitting ? 'Verifying…' : submitLabel}
      </Button>
    </form>
  )
}
