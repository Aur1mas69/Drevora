import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { LogOut } from 'lucide-react'

const fieldClassName =
  'h-10 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30'

const labelClassName = 'text-sm font-medium text-slate-300'

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseHours(value: string): number {
  return Number(value) || 0
}

function parseTimeToMinutes(time: string): number | null {
  if (!time) return null

  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  return hours * 60 + minutes
}

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`
}

function WorkEntryPage() {
  const { signOut } = useAuth()
  const [date, setDate] = useState(todayString)
  const [startTime, setStartTime] = useState('')
  const [finishTime, setFinishTime] = useState('')
  const [breakMinutes, setBreakMinutes] = useState('')
  const [overtimeHours, setOvertimeHours] = useState('')
  const [nightShiftHours, setNightShiftHours] = useState('')
  const [extraHours, setExtraHours] = useState('')
  const [notes, setNotes] = useState('')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const breakMinutesNum = parseHours(breakMinutes)
  const overtimeHoursNum = parseHours(overtimeHours)
  const nightShiftHoursNum = parseHours(nightShiftHours)
  const extraHoursNum = parseHours(extraHours)

  const totalShiftHours = useMemo(() => {
    const startMinutes = parseTimeToMinutes(startTime)
    const finishMinutes = parseTimeToMinutes(finishTime)

    if (startMinutes === null || finishMinutes === null) {
      return 0
    }

    return Math.max(0, (finishMinutes - startMinutes - breakMinutesNum) / 60)
  },
    [startTime, finishTime, breakMinutesNum],
  )

  const regularHours = useMemo(() => {
    return (
      totalShiftHours - overtimeHoursNum - nightShiftHoursNum - extraHoursNum
    )
  }, [totalShiftHours, overtimeHoursNum, nightShiftHoursNum, extraHoursNum])

  const totalPaidHours = useMemo(() => {
    return regularHours + overtimeHoursNum + nightShiftHoursNum + extraHoursNum
  }, [regularHours, overtimeHoursNum, nightShiftHoursNum, extraHoursNum])

  function resetMessages() {
    setErrorMessage(null)
    setSaveMessage(null)
  }

  function validateForm(): string | null {
    const startMinutes = parseTimeToMinutes(startTime)
    const finishMinutes = parseTimeToMinutes(finishTime)

    if (startMinutes === null || finishMinutes === null) {
      return 'Start time and finish time are required.'
    }

    if (finishMinutes <= startMinutes) {
      return 'Finish time must be after start time.'
    }

    if (breakMinutesNum < 0) {
      return 'Break minutes cannot be negative.'
    }

    if (overtimeHoursNum < 0 || nightShiftHoursNum < 0 || extraHoursNum < 0) {
      return 'Overtime, night shift and extra hours cannot be negative.'
    }

    if (regularHours < 0) {
      return 'Regular hours cannot be negative.'
    }

    return null
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()

    const validationError = validateForm()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setSaveMessage('Entry saved locally. Backend connection will be added later.')
  }

  function clearForm() {
    setDate(todayString())
    setStartTime('')
    setFinishTime('')
    setBreakMinutes('')
    setOvertimeHours('')
    setNightShiftHours('')
    setExtraHours('')
    setNotes('')
    resetMessages()
  }

  return (
    <div className="min-h-svh bg-[#0B1023] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 size-[320px] translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#0B1023]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/drevora-logo.png"
              alt="DREVORA"
              className="h-8 w-auto max-w-[140px] shrink-0 object-contain"
            />
            <p className="truncate text-xs text-slate-400">Driver work entry</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="shrink-0 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-lg px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white sm:text-2xl">
            Today&apos;s Work
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your shift details and review calculated hours.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300"
            >
              {errorMessage}
            </p>
          ) : null}

          {saveMessage ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              {saveMessage}
            </p>
          ) : null}

          <Card className="gap-0 border-white/10 bg-[#121829] py-0 text-white shadow-xl shadow-black/30 ring-0">
            <CardHeader className="px-4 pt-5 pb-4 sm:px-6">
              <CardTitle className="text-base text-white">
                Shift details
              </CardTitle>
              <CardDescription className="text-slate-400">
                All times use 24-hour format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-5 sm:px-6 sm:pb-6">
              <div className="space-y-2">
                <label htmlFor="date" className={labelClassName}>
                  Date
                </label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    resetMessages()
                    setDate(e.target.value)
                  }}
                  required
                  className={fieldClassName}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="start-time" className={labelClassName}>
                    Start time
                  </label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      resetMessages()
                      setStartTime(e.target.value)
                    }}
                    required
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="finish-time" className={labelClassName}>
                    Finish time
                  </label>
                  <Input
                    id="finish-time"
                    type="time"
                    value={finishTime}
                    onChange={(e) => {
                      resetMessages()
                      setFinishTime(e.target.value)
                    }}
                    required
                    className={fieldClassName}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="break-minutes" className={labelClassName}>
                    Break minutes
                  </label>
                  <Input
                    id="break-minutes"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={breakMinutes}
                    onChange={(e) => {
                      resetMessages()
                      setBreakMinutes(e.target.value)
                    }}
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="overtime-hours" className={labelClassName}>
                    Overtime hours
                  </label>
                  <Input
                    id="overtime-hours"
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="0"
                    value={overtimeHours}
                    onChange={(e) => {
                      resetMessages()
                      setOvertimeHours(e.target.value)
                    }}
                    className={fieldClassName}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="night-shift-hours" className={labelClassName}>
                    Night shift hours
                  </label>
                  <Input
                    id="night-shift-hours"
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="0"
                    value={nightShiftHours}
                    onChange={(e) => {
                      resetMessages()
                      setNightShiftHours(e.target.value)
                    }}
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="extra-hours" className={labelClassName}>
                    Extra hours
                  </label>
                  <Input
                    id="extra-hours"
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="0"
                    value={extraHours}
                    onChange={(e) => {
                      resetMessages()
                      setExtraHours(e.target.value)
                    }}
                    className={fieldClassName}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="notes" className={labelClassName}>
                  Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Optional notes about your shift..."
                  value={notes}
                  onChange={(e) => {
                    resetMessages()
                    setNotes(e.target.value)
                  }}
                  className={cn(
                    fieldClassName,
                    'min-h-20 resize-none py-2.5',
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 border-blue-500/20 bg-blue-950/30 py-0 text-white ring-0">
            <CardHeader className="px-4 pt-5 pb-3 sm:px-6">
              <CardTitle className="text-base text-white">Calculated</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 px-4 pb-5 sm:grid-cols-3 sm:px-6 sm:pb-6">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Total shift hours
                </p>
                <p className="mt-1 text-2xl font-semibold text-blue-400">
                  {formatHours(totalShiftHours)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Regular hours
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-400">
                  {formatHours(regularHours)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Total paid hours
                </p>
                <p className="mt-1 text-2xl font-semibold text-violet-300">
                  {formatHours(totalPaidHours)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              Save entry
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={clearForm}
              className="h-11 w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Clear form
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default WorkEntryPage
