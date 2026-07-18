import { adminKpiDarkAccent } from '@/lib/adminUiStyles'

export type TimesheetKpiVisualStyle = {
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
  activeGradient: string
  activeBorder: string
  activeShadow: string
  selectedRing: string
  selectedShadow: string
  focusRing: string
}

const blue = adminKpiDarkAccent.blue
const cyan = adminKpiDarkAccent.cyan
const amber = adminKpiDarkAccent.amber
const green = adminKpiDarkAccent.green
const rose = adminKpiDarkAccent.rose

export const timesheetKpiVisualStyles = {
  total: {
    baseGradient: `bg-gradient-to-br from-[#E8F3FE] via-[#DFEEFF] to-[#D3E9FC] ${blue.surface}`,
    baseBorder: `border-[#89CFF0] ${blue.border}`,
    leftBorder: `border-l-[#218EE7] ${blue.leftBorder}`,
    baseShadow: `shadow-[0_8px_24px_rgba(33,142,231,0.16)] ${blue.shadow}`,
    glowClass: `bg-[#89CFF0] ${blue.glow}`,
    iconWrap: `bg-[#BFE3F5] ring-1 ring-[#89CFF0] ${blue.iconWrap}`,
    iconClass: `text-[#0B68BE] ${blue.icon}`,
    valueClass: `text-[#0B477F] ${blue.value}`,
    labelClass: `text-[#0B68BE] ${blue.label}`,
    subtitleClass: `text-[#3D7A9C] ${blue.subtitle}`,
    hoverGradient: `hover:from-[#D3E9FC] hover:via-[#C8E4FC] hover:to-[#BFE3F5] ${blue.hoverSurface}`,
    hoverBorder: `hover:border-[#218EE7] ${blue.hoverBorder}`,
    hoverShadow: `hover:shadow-[0_0_0_1px_rgba(33,142,231,0.22),0_16px_36px_rgba(33,142,231,0.22)] ${blue.hoverShadow}`,
    activeGradient: `active:from-[#C8E4FC] active:via-[#BFE3F5] active:to-[#A8D4F7] ${blue.activeSurface}`,
    activeBorder: `active:border-[#0B68BE] ${blue.activeBorder}`,
    activeShadow: `active:shadow-[0_0_0_1px_rgba(33,142,231,0.32),0_8px_22px_rgba(33,142,231,0.18)] ${blue.activeShadow}`,
    selectedRing: `ring-2 ring-[#218EE7]/35 ${blue.selectedRing}`,
    selectedShadow: `shadow-[0_0_0_1px_rgba(33,142,231,0.35),0_10px_28px_rgba(33,142,231,0.22)] ${blue.selectedShadow}`,
    focusRing: `focus-visible:ring-[#218EE7]/40 ${blue.focusRing}`,
  },
  submitted: {
    baseGradient: `bg-gradient-to-br from-[#E0F7FF] via-[#D4F0FE] to-[#BAE6FD] ${cyan.surface}`,
    baseBorder: `border-[#7DD3FC] ${cyan.border}`,
    leftBorder: `border-l-[#0EA5E9] ${cyan.leftBorder}`,
    baseShadow: `shadow-[0_8px_24px_rgba(14,165,233,0.16)] ${cyan.shadow}`,
    glowClass: `bg-[#7DD3FC] ${cyan.glow}`,
    iconWrap: `bg-[#BAE6FD] ring-1 ring-[#7DD3FC] ${cyan.iconWrap}`,
    iconClass: `text-[#0284C7] ${cyan.icon}`,
    valueClass: `text-[#075985] ${cyan.value}`,
    labelClass: `text-[#0369A1] ${cyan.label}`,
    subtitleClass: `text-[#0C4A6E]/80 ${cyan.subtitle}`,
    hoverGradient: `hover:from-[#BAE6FD] hover:via-[#A5E3FC] hover:to-[#7DD3FC] ${cyan.hoverSurface}`,
    hoverBorder: `hover:border-[#0EA5E9] ${cyan.hoverBorder}`,
    hoverShadow: `hover:shadow-[0_0_0_1px_rgba(14,165,233,0.22),0_16px_36px_rgba(14,165,233,0.2)] ${cyan.hoverShadow}`,
    activeGradient: `active:from-[#A5E3FC] active:via-[#7DD3FC] active:to-[#67C8F7] ${cyan.activeSurface}`,
    activeBorder: `active:border-[#0284C7] ${cyan.activeBorder}`,
    activeShadow: `active:shadow-[0_0_0_1px_rgba(14,165,233,0.3),0_8px_22px_rgba(14,165,233,0.16)] ${cyan.activeShadow}`,
    selectedRing: `ring-2 ring-[#0EA5E9]/35 ${cyan.selectedRing}`,
    selectedShadow: `shadow-[0_0_0_1px_rgba(14,165,233,0.35),0_10px_28px_rgba(14,165,233,0.2)] ${cyan.selectedShadow}`,
    focusRing: `focus-visible:ring-[#0EA5E9]/40 ${cyan.focusRing}`,
  },
  drafts: {
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
    activeGradient: `active:from-amber-100 active:via-orange-100 active:to-amber-200/80 ${amber.activeSurface}`,
    activeBorder: `active:border-amber-500 ${amber.activeBorder}`,
    activeShadow: `active:shadow-[0_0_0_1px_rgba(245,158,11,0.28),0_8px_22px_rgba(245,158,11,0.14)] ${amber.activeShadow}`,
    selectedRing: `ring-2 ring-amber-400/40 ${amber.selectedRing}`,
    selectedShadow: `shadow-[0_0_0_1px_rgba(245,158,11,0.38),0_10px_28px_rgba(245,158,11,0.18)] ${amber.selectedShadow}`,
    focusRing: `focus-visible:ring-amber-500/40 ${amber.focusRing}`,
  },
  approved: {
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
    activeGradient: `active:from-emerald-100 active:via-teal-100 active:to-emerald-200/80 ${green.activeSurface}`,
    activeBorder: `active:border-emerald-500 ${green.activeBorder}`,
    activeShadow: `active:shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_8px_22px_rgba(16,185,129,0.14)] ${green.activeShadow}`,
    selectedRing: `ring-2 ring-emerald-500/35 ${green.selectedRing}`,
    selectedShadow: `shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_10px_28px_rgba(16,185,129,0.18)] ${green.selectedShadow}`,
    focusRing: `focus-visible:ring-emerald-500/40 ${green.focusRing}`,
  },
  rejected: {
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
    activeGradient: `active:from-rose-100 active:via-rose-100 active:to-rose-200/80 ${rose.activeSurface}`,
    activeBorder: `active:border-rose-500 ${rose.activeBorder}`,
    activeShadow: `active:shadow-[0_0_0_1px_rgba(225,29,72,0.28),0_8px_22px_rgba(225,29,72,0.14)] ${rose.activeShadow}`,
    selectedRing: `ring-2 ring-rose-500/35 ${rose.selectedRing}`,
    selectedShadow: `shadow-[0_0_0_1px_rgba(225,29,72,0.35),0_10px_28px_rgba(225,29,72,0.18)] ${rose.selectedShadow}`,
    focusRing: `focus-visible:ring-rose-500/40 ${rose.focusRing}`,
  },
} satisfies Record<string, TimesheetKpiVisualStyle>
