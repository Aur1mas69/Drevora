import { useState, type FormEvent } from 'react'
import drevoraLogo from '@/assets/drevora-logo.png'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('Thanks. We will let you know when DREVORA is ready.')
  }

  return (
    <div className="flex min-h-svh flex-col bg-[#0B1023] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 size-[380px] translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-0 size-[280px] -translate-x-1/2 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-[520px] gap-0 border-white/10 bg-[#121829]/90 py-0 text-center text-white shadow-2xl shadow-black/40 ring-0 backdrop-blur-sm">
          <CardHeader className="items-center px-6 pt-10 pb-6 sm:px-10">
            <img
              src={drevoraLogo}
              alt="DREVORA"
              className="mb-8 h-auto w-full max-w-[220px] object-contain"
            />
            <CardTitle className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              DREVORA is coming soon
            </CardTitle>
            <CardDescription className="mt-3 max-w-sm text-base text-slate-400">
              Driver operations platform for modern transport companies.
            </CardDescription>
            <p className="mt-4 text-sm font-medium tracking-[0.2em] text-blue-300 uppercase">
              Drive. Work. Earn. Live.
            </p>
          </CardHeader>

          <CardContent className="px-6 pb-10 sm:px-10">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => {
                    setMessage(null)
                    setEmail(event.target.value)
                  }}
                  required
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 bg-blue-600 px-6 text-white hover:bg-blue-700"
                >
                  Notify me
                </Button>
              </div>
              {message ? (
                <p className="text-sm text-emerald-300">{message}</p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </main>

      <footer className="relative z-10 px-4 py-6 text-center">
        <p className="text-sm text-slate-500">© 2026 DREVORA</p>
      </footer>
    </div>
  )
}

export default ComingSoonPage
