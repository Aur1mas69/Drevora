/** Shared DREVORA admin dashboard UI class tokens — light preserved, dark glass added. */

export const adminCard =
  'overflow-hidden rounded-[20px] border-0 bg-white py-0 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20 dark:backdrop-blur-xl'

export const adminPanel =
  'rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-white shadow-[0_4px_16px_rgba(40,80,140,0.05)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 dark:backdrop-blur-xl'

export const adminPanelSm =
  'rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white shadow-[0_2px_8px_rgba(40,80,140,0.04)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 dark:backdrop-blur-xl'

export const adminPanelLg =
  'rounded-[22px] bg-white shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20 dark:backdrop-blur-xl'

export const adminFilterPanel = `${adminPanel} p-4`

export const adminGlassToolbar =
  'flex flex-col gap-4 rounded-[20px] bg-white/72 p-5 shadow-[0_18px_45px_rgba(59,130,246,0.07)] ring-1 ring-white/80 backdrop-blur sm:p-6 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20'

export const adminTableShell =
  'overflow-hidden rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-white shadow-[0_4px_16px_rgba(40,80,140,0.05)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 dark:backdrop-blur-xl'

export const adminTableShellSm =
  'overflow-hidden rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white shadow-[0_2px_8px_rgba(40,80,140,0.04)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 dark:backdrop-blur-xl'

export const adminTableHeader =
  'sticky top-0 z-10 bg-[#F4F8FF] shadow-[0_1px_0_rgba(75,120,220,0.10)] dark:bg-slate-800/70 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]'

export const adminTableHeaderAlt =
  'sticky top-0 z-10 bg-[#F8FBFF] shadow-[0_1px_0_rgba(75,120,220,0.10)] dark:bg-slate-800/70 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]'

export const adminTableRow =
  'border-t border-[rgba(70,110,220,0.06)] transition-colors hover:bg-[#F8FBFF] dark:border-white/10 dark:hover:bg-slate-800/50'

export const adminTableRowAlt =
  'text-sm transition-colors hover:bg-[#F8FBFF] dark:hover:bg-slate-800/50'

export const adminTableFooter =
  'border-t border-[rgba(70,110,220,0.08)] bg-[#FAFCFF] dark:border-white/10 dark:bg-slate-900/50'

export const adminTableDivide = 'divide-y divide-blue-50 dark:divide-white/10'

export const adminSelect =
  'h-10 w-full min-w-[140px] rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-blue-500/30'

export const adminSelectSm =
  'h-9 w-full min-w-[128px] rounded-[10px] border border-[rgba(75,120,220,0.12)] bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-blue-500/30'

export const adminSelectXs =
  'h-8 rounded-[8px] border border-[rgba(75,120,220,0.12)] bg-white px-2 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100'

export const adminSearchInput =
  'h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400'

export const adminSearchInputLg =
  'h-11 rounded-[16px] border-0 bg-[#F8FBFF] text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 placeholder:text-slate-400 focus-visible:ring-3 focus-visible:ring-blue-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/10 dark:focus-visible:ring-blue-500/40'

export const adminMetricCard =
  'rounded-[16px] border border-[rgba(75,120,220,0.10)] p-4 shadow-[0_4px_16px_rgba(40,80,140,0.05)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 dark:backdrop-blur-xl'

export const adminMetricCardSm =
  'rounded-[14px] border border-[rgba(75,120,220,0.10)] p-4 shadow-[0_2px_8px_rgba(40,80,140,0.04)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20 dark:backdrop-blur-xl'

/**
 * Dark-mode fragments for pastel Admin KPI / summary cards.
 * Append to existing light classes — do not replace light surfaces.
 */
export type AdminKpiAccent =
  | 'blue'
  | 'cyan'
  | 'green'
  | 'amber'
  | 'orange'
  | 'rose'
  | 'violet'

type AdminKpiDarkTokens = {
  surface: string
  border: string
  leftBorder: string
  shadow: string
  glow: string
  iconWrap: string
  icon: string
  value: string
  label: string
  subtitle: string
  hoverSurface: string
  hoverBorder: string
  hoverShadow: string
  activeSurface: string
  activeBorder: string
  activeShadow: string
  selectedSurface: string
  selectedBorder: string
  selectedShadow: string
  selectedRing: string
  focusRing: string
  /** Compact Documents/Contacts-style cards (no left accent strip). */
  compactCard: string
  compactIconWrap: string
  compactHover: string
  compactActive: string
}

export const adminKpiDarkAccent: Record<AdminKpiAccent, AdminKpiDarkTokens> = {
  blue: {
    surface: 'dark:from-slate-900 dark:via-slate-900/95 dark:to-blue-950/45',
    border: 'dark:border-white/10',
    leftBorder: 'dark:border-l-blue-400',
    shadow: 'dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    glow: 'dark:bg-blue-500/35',
    iconWrap: 'dark:bg-blue-950/55 dark:ring-blue-500/35',
    icon: 'dark:text-blue-300',
    value: 'dark:text-slate-100',
    label: 'dark:text-blue-300',
    subtitle: 'dark:text-slate-400',
    hoverSurface:
      'dark:hover:from-slate-800 dark:hover:via-slate-900/95 dark:hover:to-blue-950/55',
    hoverBorder: 'dark:hover:border-blue-500/40',
    hoverShadow:
      'dark:hover:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_16px_36px_rgba(0,0,0,0.4)]',
    activeSurface:
      'dark:active:from-slate-800 dark:active:via-slate-900 dark:active:to-blue-950/55',
    activeBorder: 'dark:active:border-blue-400/70',
    activeShadow:
      'dark:active:shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_8px_22px_rgba(0,0,0,0.4)]',
    selectedSurface: 'dark:from-slate-800 dark:via-slate-900 dark:to-blue-950/60',
    selectedBorder: 'dark:border-blue-400/70',
    selectedShadow:
      'dark:shadow-[0_0_0_2px_rgba(59,130,246,0.28),0_14px_34px_rgba(0,0,0,0.45)]',
    selectedRing: 'dark:ring-blue-500/45',
    focusRing: 'dark:focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-slate-900',
    compactCard:
      'dark:border-white/10 dark:from-slate-900 dark:to-blue-950/45 dark:shadow-black/20',
    compactIconWrap:
      'dark:border-blue-500/35 dark:bg-blue-950/55 dark:text-blue-300',
    compactHover:
      'dark:hover:border-blue-500/40 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.35)]',
    compactActive: 'dark:ring-blue-500/40 dark:border-blue-400/70',
  },
  cyan: {
    surface: 'dark:from-slate-900 dark:via-slate-900/95 dark:to-cyan-950/40',
    border: 'dark:border-white/10',
    leftBorder: 'dark:border-l-cyan-400',
    shadow: 'dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    glow: 'dark:bg-cyan-500/35',
    iconWrap: 'dark:bg-cyan-950/55 dark:ring-cyan-500/35',
    icon: 'dark:text-cyan-300',
    value: 'dark:text-slate-100',
    label: 'dark:text-cyan-300',
    subtitle: 'dark:text-slate-400',
    hoverSurface:
      'dark:hover:from-slate-800 dark:hover:via-slate-900/95 dark:hover:to-cyan-950/50',
    hoverBorder: 'dark:hover:border-cyan-500/40',
    hoverShadow:
      'dark:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_16px_36px_rgba(0,0,0,0.4)]',
    activeSurface:
      'dark:active:from-slate-800 dark:active:via-slate-900 dark:active:to-cyan-950/50',
    activeBorder: 'dark:active:border-cyan-400/70',
    activeShadow:
      'dark:active:shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_8px_22px_rgba(0,0,0,0.4)]',
    selectedSurface: 'dark:from-slate-800 dark:via-slate-900 dark:to-cyan-950/55',
    selectedBorder: 'dark:border-cyan-400/70',
    selectedShadow:
      'dark:shadow-[0_0_0_2px_rgba(34,211,238,0.28),0_14px_34px_rgba(0,0,0,0.45)]',
    selectedRing: 'dark:ring-cyan-500/45',
    focusRing: 'dark:focus-visible:ring-cyan-500/40 dark:focus-visible:ring-offset-slate-900',
    compactCard:
      'dark:border-white/10 dark:from-slate-900 dark:to-cyan-950/40 dark:shadow-black/20',
    compactIconWrap:
      'dark:border-cyan-500/35 dark:bg-cyan-950/55 dark:text-cyan-300',
    compactHover:
      'dark:hover:border-cyan-500/40 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.35)]',
    compactActive: 'dark:ring-cyan-500/40 dark:border-cyan-400/70',
  },
  green: {
    surface: 'dark:from-slate-900 dark:via-slate-900/95 dark:to-emerald-950/40',
    border: 'dark:border-white/10',
    leftBorder: 'dark:border-l-emerald-400',
    shadow: 'dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    glow: 'dark:bg-emerald-500/35',
    iconWrap: 'dark:bg-emerald-950/55 dark:ring-emerald-500/35',
    icon: 'dark:text-emerald-300',
    value: 'dark:text-slate-100',
    label: 'dark:text-emerald-300',
    subtitle: 'dark:text-slate-400',
    hoverSurface:
      'dark:hover:from-slate-800 dark:hover:via-slate-900/95 dark:hover:to-emerald-950/50',
    hoverBorder: 'dark:hover:border-emerald-500/40',
    hoverShadow:
      'dark:hover:shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_16px_36px_rgba(0,0,0,0.4)]',
    activeSurface:
      'dark:active:from-slate-800 dark:active:via-slate-900 dark:active:to-emerald-950/50',
    activeBorder: 'dark:active:border-emerald-400/70',
    activeShadow:
      'dark:active:shadow-[0_0_0_1px_rgba(52,211,153,0.28),0_8px_22px_rgba(0,0,0,0.4)]',
    selectedSurface: 'dark:from-slate-800 dark:via-slate-900 dark:to-emerald-950/55',
    selectedBorder: 'dark:border-emerald-400/70',
    selectedShadow:
      'dark:shadow-[0_0_0_2px_rgba(52,211,153,0.28),0_14px_34px_rgba(0,0,0,0.45)]',
    selectedRing: 'dark:ring-emerald-500/45',
    focusRing: 'dark:focus-visible:ring-emerald-500/40 dark:focus-visible:ring-offset-slate-900',
    compactCard:
      'dark:border-white/10 dark:from-slate-900 dark:to-emerald-950/40 dark:shadow-black/20',
    compactIconWrap:
      'dark:border-emerald-500/35 dark:bg-emerald-950/55 dark:text-emerald-300',
    compactHover:
      'dark:hover:border-emerald-500/40 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.35)]',
    compactActive: 'dark:ring-emerald-500/40 dark:border-emerald-400/70',
  },
  amber: {
    surface: 'dark:from-slate-900 dark:via-slate-900/95 dark:to-amber-950/40',
    border: 'dark:border-white/10',
    leftBorder: 'dark:border-l-amber-400',
    shadow: 'dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    glow: 'dark:bg-amber-500/35',
    iconWrap: 'dark:bg-amber-950/55 dark:ring-amber-500/35',
    icon: 'dark:text-amber-300',
    value: 'dark:text-slate-100',
    label: 'dark:text-amber-300',
    subtitle: 'dark:text-slate-400',
    hoverSurface:
      'dark:hover:from-slate-800 dark:hover:via-slate-900/95 dark:hover:to-amber-950/50',
    hoverBorder: 'dark:hover:border-amber-500/40',
    hoverShadow:
      'dark:hover:shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_16px_36px_rgba(0,0,0,0.4)]',
    activeSurface:
      'dark:active:from-slate-800 dark:active:via-slate-900 dark:active:to-amber-950/50',
    activeBorder: 'dark:active:border-amber-400/70',
    activeShadow:
      'dark:active:shadow-[0_0_0_1px_rgba(251,191,36,0.28),0_8px_22px_rgba(0,0,0,0.4)]',
    selectedSurface: 'dark:from-slate-800 dark:via-slate-900 dark:to-amber-950/55',
    selectedBorder: 'dark:border-amber-400/70',
    selectedShadow:
      'dark:shadow-[0_0_0_2px_rgba(251,191,36,0.28),0_14px_34px_rgba(0,0,0,0.45)]',
    selectedRing: 'dark:ring-amber-500/45',
    focusRing: 'dark:focus-visible:ring-amber-500/40 dark:focus-visible:ring-offset-slate-900',
    compactCard:
      'dark:border-white/10 dark:from-slate-900 dark:to-amber-950/40 dark:shadow-black/20',
    compactIconWrap:
      'dark:border-amber-500/35 dark:bg-amber-950/55 dark:text-amber-300',
    compactHover:
      'dark:hover:border-amber-500/40 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.35)]',
    compactActive: 'dark:ring-amber-500/40 dark:border-amber-400/70',
  },
  orange: {
    surface: 'dark:from-slate-900 dark:via-slate-900/95 dark:to-orange-950/40',
    border: 'dark:border-white/10',
    leftBorder: 'dark:border-l-orange-400',
    shadow: 'dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    glow: 'dark:bg-orange-500/35',
    iconWrap: 'dark:bg-orange-950/55 dark:ring-orange-500/35',
    icon: 'dark:text-orange-300',
    value: 'dark:text-slate-100',
    label: 'dark:text-orange-300',
    subtitle: 'dark:text-slate-400',
    hoverSurface:
      'dark:hover:from-slate-800 dark:hover:via-slate-900/95 dark:hover:to-orange-950/50',
    hoverBorder: 'dark:hover:border-orange-500/40',
    hoverShadow:
      'dark:hover:shadow-[0_0_0_1px_rgba(251,146,60,0.25),0_16px_36px_rgba(0,0,0,0.4)]',
    activeSurface:
      'dark:active:from-slate-800 dark:active:via-slate-900 dark:active:to-orange-950/50',
    activeBorder: 'dark:active:border-orange-400/70',
    activeShadow:
      'dark:active:shadow-[0_0_0_1px_rgba(251,146,60,0.28),0_8px_22px_rgba(0,0,0,0.4)]',
    selectedSurface: 'dark:from-slate-800 dark:via-slate-900 dark:to-orange-950/55',
    selectedBorder: 'dark:border-orange-400/70',
    selectedShadow:
      'dark:shadow-[0_0_0_2px_rgba(251,146,60,0.28),0_14px_34px_rgba(0,0,0,0.45)]',
    selectedRing: 'dark:ring-orange-500/45',
    focusRing: 'dark:focus-visible:ring-orange-500/40 dark:focus-visible:ring-offset-slate-900',
    compactCard:
      'dark:border-white/10 dark:from-slate-900 dark:to-orange-950/40 dark:shadow-black/20',
    compactIconWrap:
      'dark:border-orange-500/35 dark:bg-orange-950/55 dark:text-orange-300',
    compactHover:
      'dark:hover:border-orange-500/40 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.35)]',
    compactActive: 'dark:ring-orange-500/40 dark:border-orange-400/70',
  },
  rose: {
    surface: 'dark:from-slate-900 dark:via-slate-900/95 dark:to-rose-950/40',
    border: 'dark:border-white/10',
    leftBorder: 'dark:border-l-rose-400',
    shadow: 'dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    glow: 'dark:bg-rose-500/35',
    iconWrap: 'dark:bg-rose-950/55 dark:ring-rose-500/35',
    icon: 'dark:text-rose-300',
    value: 'dark:text-slate-100',
    label: 'dark:text-rose-300',
    subtitle: 'dark:text-slate-400',
    hoverSurface:
      'dark:hover:from-slate-800 dark:hover:via-slate-900/95 dark:hover:to-rose-950/50',
    hoverBorder: 'dark:hover:border-rose-500/40',
    hoverShadow:
      'dark:hover:shadow-[0_0_0_1px_rgba(251,113,133,0.25),0_16px_36px_rgba(0,0,0,0.4)]',
    activeSurface:
      'dark:active:from-slate-800 dark:active:via-slate-900 dark:active:to-rose-950/50',
    activeBorder: 'dark:active:border-rose-400/70',
    activeShadow:
      'dark:active:shadow-[0_0_0_1px_rgba(251,113,133,0.28),0_8px_22px_rgba(0,0,0,0.4)]',
    selectedSurface: 'dark:from-slate-800 dark:via-slate-900 dark:to-rose-950/55',
    selectedBorder: 'dark:border-rose-400/70',
    selectedShadow:
      'dark:shadow-[0_0_0_2px_rgba(251,113,133,0.28),0_14px_34px_rgba(0,0,0,0.45)]',
    selectedRing: 'dark:ring-rose-500/45',
    focusRing: 'dark:focus-visible:ring-rose-500/40 dark:focus-visible:ring-offset-slate-900',
    compactCard:
      'dark:border-white/10 dark:from-slate-900 dark:to-rose-950/40 dark:shadow-black/20',
    compactIconWrap:
      'dark:border-rose-500/35 dark:bg-rose-950/55 dark:text-rose-300',
    compactHover:
      'dark:hover:border-rose-500/40 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.35)]',
    compactActive: 'dark:ring-rose-500/40 dark:border-rose-400/70',
  },
  violet: {
    surface: 'dark:from-slate-900 dark:via-slate-900/95 dark:to-violet-950/40',
    border: 'dark:border-white/10',
    leftBorder: 'dark:border-l-violet-400',
    shadow: 'dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    glow: 'dark:bg-violet-500/35',
    iconWrap: 'dark:bg-violet-950/55 dark:ring-violet-500/35',
    icon: 'dark:text-violet-300',
    value: 'dark:text-slate-100',
    label: 'dark:text-violet-300',
    subtitle: 'dark:text-slate-400',
    hoverSurface:
      'dark:hover:from-slate-800 dark:hover:via-slate-900/95 dark:hover:to-violet-950/50',
    hoverBorder: 'dark:hover:border-violet-500/40',
    hoverShadow:
      'dark:hover:shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_16px_36px_rgba(0,0,0,0.4)]',
    activeSurface:
      'dark:active:from-slate-800 dark:active:via-slate-900 dark:active:to-violet-950/50',
    activeBorder: 'dark:active:border-violet-400/70',
    activeShadow:
      'dark:active:shadow-[0_0_0_1px_rgba(167,139,250,0.28),0_8px_22px_rgba(0,0,0,0.4)]',
    selectedSurface: 'dark:from-slate-800 dark:via-slate-900 dark:to-violet-950/55',
    selectedBorder: 'dark:border-violet-400/70',
    selectedShadow:
      'dark:shadow-[0_0_0_2px_rgba(167,139,250,0.28),0_14px_34px_rgba(0,0,0,0.45)]',
    selectedRing: 'dark:ring-violet-500/45',
    focusRing: 'dark:focus-visible:ring-violet-500/40 dark:focus-visible:ring-offset-slate-900',
    compactCard:
      'dark:border-white/10 dark:from-slate-900 dark:to-violet-950/40 dark:shadow-black/20',
    compactIconWrap:
      'dark:border-violet-500/35 dark:bg-violet-950/55 dark:text-violet-300',
    compactHover:
      'dark:hover:border-violet-500/40 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.35)]',
    compactActive: 'dark:ring-violet-500/40 dark:border-violet-400/70',
  },
}

export const adminEmptyState = `${adminPanelSm} px-6 py-10 text-center`

export const adminEmptyStateLg = `${adminPanelLg} px-6 py-14 text-center`

export const adminInnerSoft =
  'bg-slate-50 dark:bg-slate-800/60'

export const adminHeading = 'text-[#2A376F] dark:text-slate-100'

export const adminHeadingLg = 'text-slate-950 dark:text-slate-100'

/** Primary entity name in data tables (worker, registration, document title, etc.). */
export const adminTableEntityName =
  'text-sm font-semibold leading-[1.35] text-[#113C69] dark:text-slate-100'

export const adminText = 'text-slate-600 dark:text-slate-300'

export const adminTextStrong = 'text-slate-700 dark:text-slate-300'

export const adminTextMuted = 'text-slate-500 dark:text-slate-400'

export const adminTableHeadText =
  'text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500'

export const adminTabActive =
  'bg-white text-[#2563EB] shadow-sm ring-1 ring-blue-100 dark:bg-slate-800/80 dark:text-blue-300 dark:ring-white/10'

export const adminTabInactive =
  'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'

export const adminFilterChip =
  'inline-flex items-center gap-2 rounded-full bg-[#EAF4FF] px-3 py-1.5 text-sm font-semibold text-[#2563EB] ring-1 ring-blue-100 dark:bg-slate-800/70 dark:text-blue-300 dark:ring-white/10'

export const adminSkeletonPulse = 'animate-pulse bg-[#EEF4FF] dark:bg-slate-800/60'

/** Centered modal panel shell (content only — pair with existing backdrop). */
export const adminModalShell =
  'w-full overflow-hidden rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-950 dark:ring-white/10 dark:shadow-black/50'

export const adminModalShellMd = `${adminModalShell} max-w-md`

export const adminModalShellLg = `${adminModalShell} max-w-3xl`

export const adminModalFooter =
  'shrink-0 border-t border-[#D3E9FC]/80 bg-white px-5 py-4 dark:border-white/10 dark:bg-slate-950 sm:px-6 sm:py-5'

export const adminDrawerShell =
  'relative flex h-full max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden border-l border-[#BDDDFB] bg-white shadow-[-20px_0_60px_rgba(11,38,70,0.16)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 dark:backdrop-blur-xl'

export const adminPopoverShell =
  'overflow-hidden rounded-[12px] border border-[#D3E9FC] bg-white p-2 shadow-[0_12px_32px_rgba(11,38,70,0.14)] dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40'

export const adminMutedPanel =
  'rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-800/60'

/** Dark-mode fragments for Admin table status / category badges (append to light classes). */
export const adminBadgeDark = {
  emerald:
    'dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60 dark:border-emerald-800/60',
  blue: 'dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60 dark:border-blue-800/60',
  sky: 'dark:bg-sky-950/45 dark:text-sky-300 dark:ring-sky-900/60 dark:border-sky-800/60',
  cyan: 'dark:bg-cyan-950/45 dark:text-cyan-300 dark:ring-cyan-900/60 dark:border-cyan-800/60',
  teal: 'dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900/60 dark:border-teal-800/60',
  amber: 'dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60 dark:border-amber-800/60',
  orange:
    'dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60 dark:border-orange-800/60',
  rose: 'dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60 dark:border-rose-800/60',
  red: 'dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900/60 dark:border-red-800/60',
  violet:
    'dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60 dark:border-violet-800/60',
  purple:
    'dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-900/60 dark:border-purple-800/60',
  indigo:
    'dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/60 dark:border-indigo-800/60',
  yellow:
    'dark:bg-yellow-950/45 dark:text-yellow-300 dark:ring-yellow-900/55 dark:border-yellow-800/55',
  slate: 'dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10 dark:border-white/10',
  muted: 'dark:bg-slate-800/50 dark:text-slate-400 dark:ring-white/10 dark:border-white/10',
  softBlue:
    'dark:bg-slate-800/60 dark:text-slate-300 dark:ring-white/10 dark:border-white/10',
} as const

export const adminField =
  'h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-blue-500/30'

export const adminTextarea =
  'min-h-[88px] w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-blue-500/30'
