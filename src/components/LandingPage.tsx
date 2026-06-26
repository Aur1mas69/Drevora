import drevoraLogo from '@/assets/drevora-logo.png'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  Truck,
} from 'lucide-react'

type LandingPageProps = {
  onSignIn: () => void
  onGetStarted: () => void
}

const features = [
  {
    title: 'Work entries',
    description: 'Log shifts, breaks, and hours in seconds from any device.',
    icon: ClipboardList,
  },
  {
    title: 'Vehicle checks',
    description: 'Complete daily inspections and keep fleets road-ready.',
    icon: Truck,
  },
  {
    title: 'Driver jobs',
    description: 'Assign routes and track job progress across your team.',
    icon: Briefcase,
  },
  {
    title: 'Holidays',
    description: 'Request time off and manage leave with full visibility.',
    icon: CalendarDays,
  },
]

function LandingPage({ onSignIn, onGetStarted }: LandingPageProps) {
  return (
    <div className="flex min-h-svh flex-col bg-[#0B1023] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 size-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-0 size-[300px] -translate-x-1/2 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src={drevoraLogo}
              alt="DREVORA"
              className="h-9 w-auto object-contain sm:h-10"
            />
            <span className="text-sm font-semibold tracking-[0.2em] sm:text-base">
              DREVORA
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Sign in
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <img
              src={drevoraLogo}
              alt=""
              aria-hidden="true"
              className="mx-auto mb-8 h-auto w-full max-w-[200px] object-contain sm:max-w-[240px]"
            />
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Drive. Work. Earn. Live.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
              Driver operations platform for modern transport companies.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Button
                size="lg"
                onClick={onGetStarted}
                className="h-11 w-full min-w-[160px] bg-blue-600 px-8 text-white hover:bg-blue-700 sm:w-auto"
              >
                Get started
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onSignIn}
                className="h-11 w-full min-w-[160px] border-white/15 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white sm:w-auto"
              >
                Sign in
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ title, description, icon: Icon }) => (
              <Card
                key={title}
                className="gap-0 border-white/10 bg-[#121829]/80 py-0 text-white shadow-lg shadow-black/20 ring-0 backdrop-blur-sm"
              >
                <CardHeader className="px-5 pt-5 pb-5">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-base text-white">{title}</CardTitle>
                  <CardDescription className="text-slate-400">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center">
        <p className="text-sm text-slate-500">© 2026 DREVORA</p>
      </footer>
    </div>
  )
}

export default LandingPage
