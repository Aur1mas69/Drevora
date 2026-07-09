import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Coffee,
  Clock3,
  Moon,
  Play,
  Sparkles,
  Timer,
} from 'lucide-react'

const accentBlue = '#7DB8FF'

function DashboardHeader() {
  const currentDate = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-slate-950">
            Good Morning 👋
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {currentDate}
          </p>
        </div>
        <div className="flex size-12 items-center justify-center rounded-3xl bg-white shadow-lg shadow-slate-200/70">
          <Sparkles className="size-5 text-[#7DB8FF]" />
        </div>
      </div>

      <Card className="gap-0 rounded-[2rem] border border-slate-100 bg-white py-0 shadow-xl shadow-slate-200/70">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Driver
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">Aurimas</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Company
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              North Haul Ltd
            </p>
          </div>
        </CardContent>
      </Card>
    </header>
  )
}

function StatusCard() {
  return (
    <Card className="overflow-hidden rounded-[2.25rem] border border-slate-100 bg-white py-0 text-center shadow-2xl shadow-slate-200/80">
      <CardContent className="p-7 sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#EAF4FF]">
          <Play className="ml-1 size-7 fill-[#7DB8FF] text-[#7DB8FF]" />
        </div>
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.25em] text-slate-400">
          Status
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Ready to Start
        </h1>
        <Button
          type="button"
          size="lg"
          className="mt-7 h-14 w-full rounded-3xl bg-[#7DB8FF] text-base font-semibold text-white shadow-xl shadow-blue-200/80 hover:bg-[#68A9F8] sm:max-w-xs"
        >
          START SHIFT
        </Button>
      </CardContent>
    </Card>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Clock3
}) {
  return (
    <Card className="rounded-[1.75rem] border border-slate-100 bg-white py-0 shadow-lg shadow-slate-200/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {value}
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FF]">
            <Icon className="size-5 text-[#7DB8FF]" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityTimeline() {
  function TimelineItem({
    label,
    isLast = false,
  }: {
    label: string
    isLast?: boolean
  }) {
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="mt-1 size-3 rounded-full bg-[#7DB8FF] ring-4 ring-[#EAF4FF]" />
          {!isLast ? <div className="h-10 w-px bg-slate-200" /> : null}
        </div>
        <p className="pb-5 text-sm font-medium text-slate-700">{label}</p>
      </div>
    )
  }

  return (
    <Card className="rounded-[2rem] border border-slate-100 bg-white py-0 shadow-xl shadow-slate-200/70">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-lg font-semibold text-slate-950">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-1">
          <TimelineItem label="Shift Started" />
          <TimelineItem label="Break Started" />
          <TimelineItem label="Break Finished" />
          <TimelineItem label="Shift Finished" isLast />
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  return (
    <div className="mx-auto max-w-md space-y-6 lg:max-w-3xl">
      <DashboardHeader />

      <StatusCard />

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5FA7FA]">
              Today&apos;s Summary
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Work overview
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4">
          <SummaryCard label="Today's Hours" value="0.00h" icon={Clock3} />
          <SummaryCard label="Break" value="0m" icon={Coffee} />
          <SummaryCard label="Night Hours" value="0.00h" icon={Moon} />
          <SummaryCard label="Overtime" value="0.00h" icon={Timer} />
        </div>
      </section>

      <ActivityTimeline />

      <div
        aria-hidden="true"
        className="mx-auto h-1 w-28 rounded-full"
        style={{ backgroundColor: accentBlue }}
      />
    </div>
  )
}

export default DashboardPage
