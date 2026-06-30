import { ScrollReveal } from '@/components/landing/ScrollReveal'
import {
  AlertTriangle,
  CheckCircle2,
  Truck,
  UserCheck,
} from 'lucide-react'
import { Fragment } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const steps = [
  {
    title: 'Vehicle Added',
    description: 'Register fleet assets with documents and compliance dates.',
    icon: Truck,
    color: 'bg-[#EEF4FF] text-[#2563EB] ring-blue-100',
  },
  {
    title: 'Driver Assigned',
    description: 'Link drivers to vehicles with instant visibility for managers.',
    icon: UserCheck,
    color: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  },
  {
    title: 'Check Completed',
    description: 'Digital walkarounds logged with defects and audit trails.',
    icon: CheckCircle2,
    color: 'bg-violet-50 text-violet-600 ring-violet-100',
  },
  {
    title: 'MOT Alert Sent',
    description: 'Proactive reminders before documents expire.',
    icon: AlertTriangle,
    color: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
]

function WorkflowConnector({ index }: { index: number }) {
  const reduceMotion = useReducedMotion()

  return (
    <div
      className="relative hidden flex-1 items-center md:flex"
      aria-hidden="true"
    >
      <div className="h-px w-full bg-gradient-to-r from-[rgba(75,120,220,0.15)] via-[rgba(75,120,220,0.28)] to-[rgba(75,120,220,0.15)]" />
      {!reduceMotion && (
        <motion.div
          className="absolute left-0 top-1/2 h-1 w-8 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-[#2563EB]/60 to-transparent blur-[1px]"
          initial={{ x: '-10%' }}
          animate={{ x: '320%' }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: 'linear',
            delay: index * 0.45,
          }}
        />
      )}
    </div>
  )
}

function WorkflowStep({
  step,
  index,
}: {
  step: (typeof steps)[number]
  index: number
}) {
  const reduceMotion = useReducedMotion()
  const Icon = step.icon

  return (
    <ScrollReveal delay={index * 0.08} className="relative z-10 w-full md:max-w-[180px] md:flex-1 lg:max-w-none">
      <div className="flex flex-col items-center text-center">
        <motion.div
          className={`flex size-12 items-center justify-center rounded-full ring-1 ${step.color}`}
          whileHover={reduceMotion ? undefined : { scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          <Icon className="size-5" strokeWidth={1.85} />
        </motion.div>
        <h3 className="mt-4 text-sm font-semibold text-[#2A376F] sm:text-base">
          {step.title}
        </h3>
        <p className="mt-2 max-w-[200px] text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
          {step.description}
        </p>
      </div>
    </ScrollReveal>
  )
}

export function FleetWorkflowSection() {
  return (
    <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
          Fleet workflow
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2A376F] sm:text-4xl">
          From vehicle to compliance in one flow
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          DREVORA connects every step — so nothing falls through the cracks
          between the yard, the driver, and the office.
        </p>
      </ScrollReveal>

      <div className="relative mt-12 overflow-hidden rounded-[24px] border border-[rgba(75,120,220,0.1)] bg-white px-6 py-10 shadow-[0_12px_40px_rgba(40,80,140,0.06)] sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[72px] hidden h-px bg-blue-100 md:block"
        />

        <div className="flex flex-col items-center md:flex-row md:items-start md:justify-between">
          {steps.map((step, index) => (
            <Fragment key={step.title}>
              <WorkflowStep step={step} index={index} />
              {index < steps.length - 1 && (
                <>
                  <WorkflowConnector index={index} />
                  <div
                    className="flex h-8 items-center md:hidden"
                    aria-hidden="true"
                  >
                    <div className="h-full w-px bg-gradient-to-b from-blue-100 via-blue-200 to-blue-100" />
                  </div>
                </>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}
