import { adminKpiDarkAccent } from '@/lib/adminUiStyles'
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

const green = adminKpiDarkAccent.green
const rose = adminKpiDarkAccent.rose
const amber = adminKpiDarkAccent.amber
const orange = adminKpiDarkAccent.orange
const violet = adminKpiDarkAccent.violet

export const vehicleKpiVisualStyles: Record<VehicleKpiKey, VehicleKpiVisualStyle> = {
  available: {
    baseGradient: `bg-gradient-to-br from-emerald-50 via-teal-50/95 to-[#D1FAE5] ${green.surface}`,
    baseBorder: `border-emerald-200 ${green.border}`,
    leftBorder: `border-l-emerald-500 ${green.leftBorder}`,
    baseShadow: `shadow-[0_8px_24px_rgba(16,185,129,0.14)] ${green.shadow}`,
    glowClass: `bg-emerald-300 ${green.glow}`,
    iconWrap: `bg-emerald-100 ring-1 ring-emerald-200 ${green.iconWrap}`,
    iconClass: `text-emerald-700 ${green.icon}`,
    valueClass: `text-emerald-950 ${green.value}`,
    labelClass: `text-emerald-800 ${green.label}`,
    subtitleClass: `text-emerald-800/75 ${green.subtitle}`,
    hoverGradient: `hover:from-emerald-100/90 hover:via-teal-100/85 hover:to-emerald-200/70 ${green.hoverSurface}`,
    hoverBorder: `hover:border-emerald-400 ${green.hoverBorder}`,
    hoverShadow: `hover:shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_16px_36px_rgba(16,185,129,0.18)] ${green.hoverShadow}`,
  },
  offRoad: {
    baseGradient: `bg-gradient-to-br from-rose-50 via-orange-50/85 to-[#FFE4E6] ${rose.surface}`,
    baseBorder: `border-rose-300 ${rose.border}`,
    leftBorder: `border-l-rose-500 ${rose.leftBorder}`,
    baseShadow: `shadow-[0_8px_24px_rgba(225,29,72,0.14)] ${rose.shadow}`,
    glowClass: `bg-rose-300 ${rose.glow}`,
    iconWrap: `bg-rose-100 ring-1 ring-rose-200 ${rose.iconWrap}`,
    iconClass: `text-rose-700 ${rose.icon}`,
    valueClass: `text-rose-950 ${rose.value}`,
    labelClass: `text-rose-800 ${rose.label}`,
    subtitleClass: `text-rose-800/75 ${rose.subtitle}`,
    hoverGradient: `hover:from-rose-100/90 hover:via-rose-100/80 hover:to-rose-200/70 ${rose.hoverSurface}`,
    hoverBorder: `hover:border-rose-400 ${rose.hoverBorder}`,
    hoverShadow: `hover:shadow-[0_0_0_1px_rgba(225,29,72,0.2),0_16px_36px_rgba(225,29,72,0.18)] ${rose.hoverShadow}`,
  },
  maintenanceDue: {
    baseGradient: `bg-gradient-to-br from-amber-50 via-orange-50/95 to-[#FFEDD5] ${amber.surface}`,
    baseBorder: `border-amber-200 ${amber.border}`,
    leftBorder: `border-l-amber-500 ${amber.leftBorder}`,
    baseShadow: `shadow-[0_8px_24px_rgba(245,158,11,0.14)] ${amber.shadow}`,
    glowClass: `bg-amber-300 ${amber.glow}`,
    iconWrap: `bg-amber-100 ring-1 ring-amber-200 ${amber.iconWrap}`,
    iconClass: `text-amber-700 ${amber.icon}`,
    valueClass: `text-amber-950 ${amber.value}`,
    labelClass: `text-amber-800 ${amber.label}`,
    subtitleClass: `text-amber-800/75 ${amber.subtitle}`,
    hoverGradient: `hover:from-amber-100/90 hover:via-orange-100/85 hover:to-amber-200/70 ${amber.hoverSurface}`,
    hoverBorder: `hover:border-amber-400 ${amber.hoverBorder}`,
    hoverShadow: `hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_16px_36px_rgba(245,158,11,0.18)] ${amber.hoverShadow}`,
  },
  motExpiringSoon: {
    baseGradient: `bg-gradient-to-br from-orange-50 via-amber-50/90 to-[#FFEDD5] ${orange.surface}`,
    baseBorder: `border-orange-200 ${orange.border}`,
    leftBorder: `border-l-orange-500 ${orange.leftBorder}`,
    baseShadow: `shadow-[0_8px_24px_rgba(249,115,22,0.14)] ${orange.shadow}`,
    glowClass: `bg-orange-300 ${orange.glow}`,
    iconWrap: `bg-orange-100 ring-1 ring-orange-200 ${orange.iconWrap}`,
    iconClass: `text-orange-700 ${orange.icon}`,
    valueClass: `text-orange-950 ${orange.value}`,
    labelClass: `text-orange-800 ${orange.label}`,
    subtitleClass: `text-orange-800/75 ${orange.subtitle}`,
    hoverGradient: `hover:from-orange-100/90 hover:via-amber-100/85 hover:to-orange-200/70 ${orange.hoverSurface}`,
    hoverBorder: `hover:border-orange-400 ${orange.hoverBorder}`,
    hoverShadow: `hover:shadow-[0_0_0_1px_rgba(249,115,22,0.2),0_16px_36px_rgba(249,115,22,0.18)] ${orange.hoverShadow}`,
  },
  insuranceExpiringSoon: {
    baseGradient: `bg-gradient-to-br from-violet-50 via-purple-50/95 to-[#EDE9FE] ${violet.surface}`,
    baseBorder: `border-violet-200 ${violet.border}`,
    leftBorder: `border-l-violet-500 ${violet.leftBorder}`,
    baseShadow: `shadow-[0_8px_24px_rgba(139,92,246,0.14)] ${violet.shadow}`,
    glowClass: `bg-violet-300 ${violet.glow}`,
    iconWrap: `bg-violet-100 ring-1 ring-violet-200 ${violet.iconWrap}`,
    iconClass: `text-violet-700 ${violet.icon}`,
    valueClass: `text-violet-950 ${violet.value}`,
    labelClass: `text-violet-800 ${violet.label}`,
    subtitleClass: `text-violet-800/75 ${violet.subtitle}`,
    hoverGradient: `hover:from-violet-100/90 hover:via-purple-100/85 hover:to-violet-200/70 ${violet.hoverSurface}`,
    hoverBorder: `hover:border-violet-400 ${violet.hoverBorder}`,
    hoverShadow: `hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_16px_36px_rgba(139,92,246,0.18)] ${violet.hoverShadow}`,
  },
}
