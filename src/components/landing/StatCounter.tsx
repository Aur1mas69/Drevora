import { AnimatedCounter } from '@/components/landing/AnimatedCounter'
import type { ReactNode } from 'react'

type StatCounterProps = {
  label: string
  children: ReactNode
}

export function StatCounter({ label, children }: StatCounterProps) {
  return (
    <>
      <p className="text-3xl font-semibold tracking-[-0.04em] text-[#2A376F] sm:text-4xl">
        {children}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-500">{label}</p>
    </>
  )
}

type NumericStatProps = {
  value: number
  suffix?: string
  prefix?: string
  label: string
  delay?: number
}

export function NumericStat({ value, suffix, prefix, label }: NumericStatProps) {
  return (
    <StatCounter label={label}>
      <AnimatedCounter value={value} suffix={suffix} prefix={prefix} />
    </StatCounter>
  )
}
