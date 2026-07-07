import type { FleetSummaryStats } from '@/lib/vehiclePageUtils'

export type VehicleKpiVisualStyle = {
  baseGradient: string
  baseBorder: string
  leftBorder: string
  baseShadow: string
  glowClass: string
  iconWrap: string
  iconClass: string
  valueClass: string
  labelClass: string
  subtitleClass: string
  hoverGradient: string
  hoverBorder: string
  hoverShadow: string
}

export type VehicleKpiKey = keyof Pick<
  FleetSummaryStats,
  | 'available'
  | 'offRoad'
  | 'maintenanceDue'
  | 'motExpiringSoon'
  | 'insuranceExpiringSoon'
>

export const vehicleKpiVisualStyles: Record<VehicleKpiKey, VehicleKpiVisualStyle> = {
  available: {
    baseGradient: 'bg-gradient-to-br from-emerald-50 via-teal-50/95 to-[#D1FAE5]',
    baseBorder: 'border-emerald-200',
    leftBorder: 'border-l-emerald-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(16,185,129,0.14)]',
    glowClass: 'bg-emerald-300',
    iconWrap: 'bg-emerald-100 ring-1 ring-emerald-200',
    iconClass: 'text-emerald-700',
    valueClass: 'text-emerald-950',
    labelClass: 'text-emerald-800',
    subtitleClass: 'text-emerald-800/75',
    hoverGradient:
      'hover:from-emerald-100/90 hover:via-teal-100/85 hover:to-emerald-200/70',
    hoverBorder: 'hover:border-emerald-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_16px_36px_rgba(16,185,129,0.18)]',
  },
  offRoad: {
    baseGradient: 'bg-gradient-to-br from-rose-50 via-orange-50/85 to-[#FFE4E6]',
    baseBorder: 'border-rose-300',
    leftBorder: 'border-l-rose-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(225,29,72,0.14)]',
    glowClass: 'bg-rose-300',
    iconWrap: 'bg-rose-100 ring-1 ring-rose-200',
    iconClass: 'text-rose-700',
    valueClass: 'text-rose-950',
    labelClass: 'text-rose-800',
    subtitleClass: 'text-rose-800/75',
    hoverGradient:
      'hover:from-rose-100/90 hover:via-rose-100/80 hover:to-rose-200/70',
    hoverBorder: 'hover:border-rose-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(225,29,72,0.2),0_16px_36px_rgba(225,29,72,0.18)]',
  },
  maintenanceDue: {
    baseGradient: 'bg-gradient-to-br from-amber-50 via-orange-50/95 to-[#FFEDD5]',
    baseBorder: 'border-amber-200',
    leftBorder: 'border-l-amber-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(245,158,11,0.14)]',
    glowClass: 'bg-amber-300',
    iconWrap: 'bg-amber-100 ring-1 ring-amber-200',
    iconClass: 'text-amber-700',
    valueClass: 'text-amber-950',
    labelClass: 'text-amber-800',
    subtitleClass: 'text-amber-800/75',
    hoverGradient:
      'hover:from-amber-100/90 hover:via-orange-100/85 hover:to-amber-200/70',
    hoverBorder: 'hover:border-amber-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_16px_36px_rgba(245,158,11,0.18)]',
  },
  motExpiringSoon: {
    baseGradient: 'bg-gradient-to-br from-orange-50 via-amber-50/90 to-[#FFEDD5]',
    baseBorder: 'border-orange-200',
    leftBorder: 'border-l-orange-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(249,115,22,0.14)]',
    glowClass: 'bg-orange-300',
    iconWrap: 'bg-orange-100 ring-1 ring-orange-200',
    iconClass: 'text-orange-700',
    valueClass: 'text-orange-950',
    labelClass: 'text-orange-800',
    subtitleClass: 'text-orange-800/75',
    hoverGradient:
      'hover:from-orange-100/90 hover:via-amber-100/85 hover:to-orange-200/70',
    hoverBorder: 'hover:border-orange-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(249,115,22,0.2),0_16px_36px_rgba(249,115,22,0.18)]',
  },
  insuranceExpiringSoon: {
    baseGradient: 'bg-gradient-to-br from-violet-50 via-purple-50/95 to-[#EDE9FE]',
    baseBorder: 'border-violet-200',
    leftBorder: 'border-l-violet-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(139,92,246,0.14)]',
    glowClass: 'bg-violet-300',
    iconWrap: 'bg-violet-100 ring-1 ring-violet-200',
    iconClass: 'text-violet-700',
    valueClass: 'text-violet-950',
    labelClass: 'text-violet-800',
    subtitleClass: 'text-violet-800/75',
    hoverGradient:
      'hover:from-violet-100/90 hover:via-purple-100/85 hover:to-violet-200/70',
    hoverBorder: 'hover:border-violet-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_16px_36px_rgba(139,92,246,0.18)]',
  },
}
