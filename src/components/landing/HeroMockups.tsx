import drevoraLogo from '@/assets/drevora-logo.png'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck2,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

type FloatingCardProps = {
  title: string
  subtitle: string
  icon: typeof Clock
  accent: string
  className: string
  delay?: number
}

function FloatingCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  className,
  delay = 0,
}: FloatingCardProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={`absolute z-30 rounded-[14px] border border-white/80 bg-white/95 px-3.5 py-2.5 shadow-[0_12px_32px_rgba(59,130,246,0.12)] ring-1 ring-blue-100/80 backdrop-blur-sm max-lg:hidden ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 + delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 4.8 + delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${accent}`}
          >
            <Icon className="size-4" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-900">{title}</p>
            <p className="text-[10px] font-medium text-slate-500">{subtitle}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function DashboardMockup() {
  const reduceMotion = useReducedMotion()
  const bars = [72, 58, 86, 64, 90, 48]

  return (
    <div className="relative mx-auto hidden w-full max-w-[580px] lg:block">
      <FloatingCard
        title="MOT Alert"
        subtitle="PN23 JUF — due in 12 days"
        icon={AlertTriangle}
        accent="bg-amber-50 text-amber-600 ring-1 ring-amber-100"
        className="right-[-12px] top-[28px]"
        delay={0}
      />
      <FloatingCard
        title="Vehicle Checks"
        subtitle="3 checks completed today"
        icon={FileCheck2}
        accent="bg-[#EAF4FF] text-[#2563EB] ring-1 ring-blue-100"
        className="left-[-24px] top-[96px]"
        delay={0.12}
      />
      <FloatingCard
        title="Timesheets"
        subtitle="42 hours logged this week"
        icon={Clock}
        accent="bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"
        className="right-[-28px] top-[148px]"
        delay={0.24}
      />
      <FloatingCard
        title="Holiday Request"
        subtitle="Sarah — 2 days pending"
        icon={CalendarDays}
        accent="bg-violet-50 text-violet-600 ring-1 ring-violet-100"
        className="bottom-[100px] right-[-20px]"
        delay={0.36}
      />
      <FloatingCard
        title="Driver Assigned"
        subtitle="James → Truck NG17VDV"
        icon={UserCheck}
        accent="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
        className="bottom-[48px] left-[-8px]"
        delay={0.48}
      />

      <motion.div
        className="relative z-10 overflow-hidden rounded-[20px] border border-[rgba(75,120,220,0.12)] bg-white shadow-[0_24px_64px_rgba(59,130,246,0.14)]"
        initial={reduceMotion ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex">
          <aside className="w-[72px] shrink-0 bg-[#0F2744] px-2 py-4">
            <div className="mb-4 flex flex-col items-center gap-1">
              <img src={drevoraLogo} alt="" className="size-5 object-contain" />
              <span className="text-[7px] font-bold tracking-wider text-white/90">
                DREVORA
              </span>
            </div>
            {['Dashboard', 'Workers', 'Vehicles', 'Compliance', 'Reports'].map(
              (item, index) => (
                <div
                  key={item}
                  className={`mb-1 rounded-md px-2 py-1.5 text-[7px] font-medium ${
                    index === 0
                      ? 'bg-[#2563EB] text-white'
                      : 'text-blue-100/70'
                  }`}
                >
                  {item}
                </div>
              ),
            )}
          </aside>

          <div className="min-w-0 flex-1 bg-[#F4F8FF] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#2A376F]">
                Fleet Operations Centre
              </p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Healthy
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['Workers', '48', Users],
                ['Available', '12', Truck],
                ['Alerts', '3', AlertTriangle],
              ].map(([label, value, Icon]) => (
                <div
                  key={label as string}
                  className="rounded-[12px] border border-[rgba(75,120,220,0.08)] bg-[#EEF4FF] p-2.5"
                >
                  <p className="text-[7px] font-medium text-slate-500">
                    {label as string}
                  </p>
                  <div className="mt-1 flex items-end justify-between">
                    <p className="text-lg font-semibold text-[#2A376F]">
                      {value as string}
                    </p>
                    <Icon className="size-3.5 text-[#2563EB]" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[12px] border border-[rgba(75,120,220,0.08)] bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[8px] font-semibold text-slate-700">
                  Weekly Timesheets
                </p>
                <p className="text-[7px] text-slate-400">This week</p>
              </div>
              <div className="flex h-[72px] items-end gap-1.5">
                {bars.map((height, index) => (
                  <div key={height} className="flex flex-1 flex-col items-center gap-1">
                    <motion.div
                      className="w-full rounded-t-sm bg-gradient-to-t from-[#2563EB] to-[#60A5FA]"
                      initial={reduceMotion ? false : { height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{
                        duration: 0.6,
                        delay: 0.5 + index * 0.06,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                    <span className="text-[6px] text-slate-400">
                      {['M', 'T', 'W', 'T', 'F', 'S'][index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function PhoneTimesheetMockup() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="relative z-20 mx-auto w-[168px] shrink-0"
      initial={reduceMotion ? false : { opacity: 0, y: 36, x: 16 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.75, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }
        }
        className="overflow-hidden rounded-[28px] border-[6px] border-slate-900 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.22)]"
      >
        <div className="bg-slate-900 px-4 py-1.5 text-center">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-700" />
        </div>
        <div className="bg-[#F4F8FF] px-3 pb-4 pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#2563EB]">
            Timesheet
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#2A376F]">
            Good morning, James
          </p>
          <p className="text-[8px] text-slate-500">Friday, 27 Jun 2026</p>

          <div className="mt-3 rounded-[14px] border border-[rgba(75,120,220,0.1)] bg-white p-3 text-center shadow-sm">
            <Clock className="mx-auto size-4 text-[#2563EB]" />
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-[#2A376F]">
              07:42
            </p>
            <p className="text-[8px] font-medium text-slate-500">Clocked in</p>
            <div className="mt-2 rounded-full bg-[#2563EB] px-3 py-1.5 text-[8px] font-semibold text-white">
              End Shift
            </div>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {[
              ['Regular hours', '6h 12m'],
              ['Break', '30m'],
              ['Overtime', '—'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-blue-50"
              >
                <span className="text-[7px] text-slate-500">{label}</span>
                <span className="text-[8px] font-semibold text-slate-800">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 ring-1 ring-emerald-100">
            <CheckCircle2 className="size-3 text-emerald-600" />
            <span className="text-[7px] font-medium text-emerald-700">
              Vehicle check complete
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function HeroMockups() {
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="flex items-end justify-center gap-4 lg:justify-end lg:pr-4">
        <DashboardMockup />
        <div className="hidden lg:block">
          <PhoneTimesheetMockup />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 lg:hidden">
        {[
          { title: 'Vehicle Checks', subtitle: '3 completed today', icon: FileCheck2 },
          { title: 'MOT Alert', subtitle: 'Due in 12 days', icon: AlertTriangle },
          { title: 'Timesheets', subtitle: '42 hrs this week', icon: Clock },
          { title: 'Driver Assigned', subtitle: 'James → NG17VDV', icon: UserCheck },
        ].map((card) => (
          <Card
            key={card.title}
            className="rounded-[14px] border border-[rgba(75,120,220,0.12)] bg-white/95 py-0 shadow-sm"
          >
            <CardContent className="flex items-center gap-2.5 p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
                <card.icon className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#2A376F]">
                  {card.title}
                </p>
                <p className="truncate text-[10px] text-slate-500">{card.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
