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
    <div className="flex min-h-dvh items-center justify-center bg-[#F6F9FF] px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#BFDBFE]">
            <ShieldCheck className="size-5" strokeWidth={1.9} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-950">{title}</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>

        <div className="mt-6">{children}</div>

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
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

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <label
          htmlFor="office-mfa-code"
          className="text-sm font-medium text-slate-800"
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
          className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-lg font-semibold tracking-[0.35em] text-slate-950 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          placeholder="000000"
          aria-invalid={errorMessage ? true : undefined}
        />
      </div>

      {errorMessage ? (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || code.length !== 6}
      >
        {isSubmitting ? 'Verifying…' : submitLabel}
      </Button>
    </form>
  )
}
