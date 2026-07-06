
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

export const timesheetKpiVisualStyles = {
  total: {
    baseGradient: 'bg-gradient-to-br from-[#E8F3FE] via-[#DFEEFF] to-[#D3E9FC]',
    baseBorder: 'border-[#89CFF0]',
    leftBorder: 'border-l-[#218EE7]',
    baseShadow: 'shadow-[0_8px_24px_rgba(33,142,231,0.16)]',
    glowClass: 'bg-[#89CFF0]',
    iconWrap: 'bg-[#BFE3F5] ring-1 ring-[#89CFF0]',
    iconClass: 'text-[#0B68BE]',
    valueClass: 'text-[#0B477F]',
    labelClass: 'text-[#0B68BE]',
    subtitleClass: 'text-[#3D7A9C]',
    hoverGradient:
      'hover:from-[#D3E9FC] hover:via-[#C8E4FC] hover:to-[#BFE3F5]',
    hoverBorder: 'hover:border-[#218EE7]',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(33,142,231,0.22),0_16px_36px_rgba(33,142,231,0.22)]',
    activeGradient:
      'active:from-[#C8E4FC] active:via-[#BFE3F5] active:to-[#A8D4F7]',
    activeBorder: 'active:border-[#0B68BE]',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(33,142,231,0.32),0_8px_22px_rgba(33,142,231,0.18)]',
    selectedRing: 'ring-2 ring-[#218EE7]/35',
    selectedShadow:
      'shadow-[0_0_0_1px_rgba(33,142,231,0.35),0_10px_28px_rgba(33,142,231,0.22)]',
    focusRing: 'focus-visible:ring-[#218EE7]/40',
  },
  submitted: {
    baseGradient: 'bg-gradient-to-br from-[#E0F7FF] via-[#D4F0FE] to-[#BAE6FD]',
    baseBorder: 'border-[#7DD3FC]',
    leftBorder: 'border-l-[#0EA5E9]',
    baseShadow: 'shadow-[0_8px_24px_rgba(14,165,233,0.16)]',
    glowClass: 'bg-[#7DD3FC]',
    iconWrap: 'bg-[#BAE6FD] ring-1 ring-[#7DD3FC]',
    iconClass: 'text-[#0284C7]',
    valueClass: 'text-[#075985]',
    labelClass: 'text-[#0369A1]',
    subtitleClass: 'text-[#0C4A6E]/80',
    hoverGradient:
      'hover:from-[#BAE6FD] hover:via-[#A5E3FC] hover:to-[#7DD3FC]',
    hoverBorder: 'hover:border-[#0EA5E9]',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(14,165,233,0.22),0_16px_36px_rgba(14,165,233,0.2)]',
    activeGradient:
      'active:from-[#A5E3FC] active:via-[#7DD3FC] active:to-[#67C8F7]',
    activeBorder: 'active:border-[#0284C7]',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(14,165,233,0.3),0_8px_22px_rgba(14,165,233,0.16)]',
    selectedRing: 'ring-2 ring-[#0EA5E9]/35',
    selectedShadow:
      'shadow-[0_0_0_1px_rgba(14,165,233,0.35),0_10px_28px_rgba(14,165,233,0.2)]',
    focusRing: 'focus-visible:ring-[#0EA5E9]/40',
  },
  drafts: {
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
    activeGradient:
      'active:from-amber-100 active:via-orange-100 active:to-amber-200/80',
    activeBorder: 'active:border-amber-500',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(245,158,11,0.28),0_8px_22px_rgba(245,158,11,0.14)]',
    selectedRing: 'ring-2 ring-amber-400/40',
    selectedShadow:
      'shadow-[0_0_0_1px_rgba(245,158,11,0.38),0_10px_28px_rgba(245,158,11,0.18)]',
    focusRing: 'focus-visible:ring-amber-500/40',
  },
  approved: {
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
    activeGradient:
      'active:from-emerald-100 active:via-teal-100 active:to-emerald-200/80',
    activeBorder: 'active:border-emerald-500',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_8px_22px_rgba(16,185,129,0.14)]',
    selectedRing: 'ring-2 ring-emerald-500/35',
    selectedShadow:
      'shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_10px_28px_rgba(16,185,129,0.18)]',
    focusRing: 'focus-visible:ring-emerald-500/40',
  },
  rejected: {
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
    activeGradient:
      'active:from-rose-100 active:via-rose-100 active:to-rose-200/80',
    activeBorder: 'active:border-rose-500',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(225,29,72,0.28),0_8px_22px_rgba(225,29,72,0.14)]',
    selectedRing: 'ring-2 ring-rose-500/35',
    selectedShadow:
      'shadow-[0_0_0_1px_rgba(225,29,72,0.35),0_10px_28px_rgba(225,29,72,0.18)]',
    focusRing: 'focus-visible:ring-rose-500/40',
  },
} satisfies Record<string, TimesheetKpiVisualStyle>
