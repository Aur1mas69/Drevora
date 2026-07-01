import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  authService,
  AuthServiceError,
  type AuthSession,
} from '@/services/authService'
import { ArrowLeft } from 'lucide-react'

type LoginPageProps = {
  onBack: () => void
  onSignInSuccess: (session: AuthSession) => void
  title?: string
  description?: string
}

const inputClassName =
  'h-11 border-[#1E2636] bg-[#161B26] text-white shadow-none placeholder:text-slate-500 focus-visible:border-[#3B6FFF] focus-visible:ring-[#3B6FFF]/30'

function LoginPage({
  onBack,
  onSignInSuccess,
  title = 'DREVORA',
  description = 'Driver portal',
}: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await authService.signIn(email, password)
      onSignInSuccess(result.session)
    } catch (error) {
      setErrorMessage(
        error instanceof AuthServiceError
          ? error.message
          : 'Unable to sign in. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#0A0D1A] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mb-8 -ml-2 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Button>

        <div className="flex flex-col items-center">
          <img
            src="/drevora-logo.png"
            alt="DREVORA"
            className="h-[250px] w-[450px] max-w-full object-contain bg-transparent mix-blend-lighten"
          />

          <div className="mt-8 w-full space-y-1 text-center">
            {title !== 'DREVORA' ? (
              <h1 className="text-2xl font-semibold tracking-[0.12em] text-white">
                {title}
              </h1>
            ) : null}
            <p className="bg-[linear-gradient(90deg,rgba(88,146,213,1)_51%,rgba(255,255,255,1)_100%)] bg-clip-text text-sm font-medium capitalize leading-[30px] text-transparent">
              {description}
            </p>
          </div>

          <form className="mt-8 w-full space-y-5" onSubmit={handleSubmit}>
            {errorMessage ? (
              <p
                role="alert"
                className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300"
              >
                {errorMessage}
              </p>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email
              </label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setErrorMessage(null)
                  setEmail(e.target.value)
                }}
                autoComplete="email"
                required
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-300">
                Password
              </label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setErrorMessage(null)
                  setPassword(e.target.value)
                }}
                autoComplete="current-password"
                required
                className={inputClassName}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <span className="text-sm text-slate-400 select-none">Remember me</span>
              </label>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-sm font-medium text-[#3B6FFF] transition-colors hover:text-[#5B87FF] hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="mt-1 h-11 w-full bg-[#3B6FFF] text-white hover:bg-[#3258E0]"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
