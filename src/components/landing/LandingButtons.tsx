import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'
import type { ComponentProps } from 'react'

type LandingButtonProps = ComponentProps<typeof Button> & {
  motionVariant?: 'primary' | 'secondary' | 'secondary-light' | 'primary-on-dark'
}

const hoverLift = {
  rest: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1.01 },
  tap: { y: 0, scale: 0.99 },
} as const

export function LandingButton({
  motionVariant = 'primary',
  className,
  children,
  ...props
}: LandingButtonProps) {
  const reduceMotion = useReducedMotion()

  const variantClasses: Record<NonNullable<LandingButtonProps['motionVariant']>, string> = {
    primary:
      'rounded-[14px] bg-[#2563EB] font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.28)] hover:bg-[#1D4ED8] hover:shadow-[0_16px_36px_rgba(37,99,235,0.32)]',
    secondary:
      'rounded-[14px] border-[rgba(75,120,220,0.2)] bg-white/90 font-semibold text-[#2A376F] shadow-sm hover:border-[rgba(37,99,235,0.35)] hover:bg-white hover:shadow-[0_0_0_3px_rgba(37,99,235,0.08),0_8px_24px_rgba(40,80,140,0.08)]',
    'secondary-light':
      'rounded-[14px] border-white/30 bg-white/10 font-semibold text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/20 hover:shadow-[0_0_0_3px_rgba(255,255,255,0.12)]',
    'primary-on-dark':
      'rounded-[14px] bg-white font-semibold text-[#2563EB] shadow-lg hover:bg-blue-50 hover:shadow-xl',
  }

  if (reduceMotion) {
    return (
      <Button className={cn(variantClasses[motionVariant], className)} {...props}>
        {children}
      </Button>
    )
  }

  return (
    <motion.div
      className="inline-flex"
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={hoverLift}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <Button className={cn(variantClasses[motionVariant], className)} {...props}>
        {children}
      </Button>
    </motion.div>
  )
}
