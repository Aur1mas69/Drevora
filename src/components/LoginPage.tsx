import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-[#0B1023] px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 size-[320px] translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mb-4 -ml-2 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Button>

        <Card className="w-full gap-0 border-white/10 bg-white py-0 shadow-2xl shadow-black/40 ring-0">
          <CardHeader className="items-center space-y-4 px-8 pt-10 pb-6 text-center">
            <img
              src="/drevora-logo.png"
              alt="DREVORA"
              className="mx-auto h-auto w-full max-w-[180px] object-contain"
            />
            <div className="space-y-1">
              {title !== 'DREVORA' ? (
                <CardTitle className="text-2xl font-semibold tracking-[0.2em] text-[#0B1023]">
                  {title}
                </CardTitle>
              ) : null}
              <CardDescription className="text-sm text-slate-500">
                {description}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {errorMessage}
                </p>
              ) : null}

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-700"
                >
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
                  className="h-10 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
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
                  className="h-10 border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked === true)
                    }
                  />
                  <span className="text-sm text-slate-600 select-none">
                    Remember me
                  </span>
                </label>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="mt-1 h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default LoginPage
