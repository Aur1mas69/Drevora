import type { VehicleCardEventUrgency } from '@/lib/vehicleCardNextEvent'
import type { VehicleStatus } from '@/services/vehiclesService'

export type VehicleCardAccent = 'healthy' | 'due_soon' | 'maintenance' | 'urgent'

/**
 * Visual accent only — does not change Vehicle status or next-event calculation.
 * Priority: urgent (overdue / off road) → maintenance → due soon → healthy blue.
 */
export function resolveVehicleCardAccent(
  status: VehicleStatus,
  eventUrgency: VehicleCardEventUrgency | null,
): VehicleCardAccent {
  if (
    eventUrgency === 'overdue' ||
    status === 'Off Road' ||
    status === 'Out of Service'
  ) {
    return 'urgent'
  }
  if (status === 'Maintenance' || status === 'Workshop') {
    return 'maintenance'
  }
  if (eventUrgency === 'due_soon') {
    return 'due_soon'
  }
  return 'healthy'
}

export const vehicleCardShellClass: Record<VehicleCardAccent, string> = {
  healthy: [
    'border-[#89CFF0]/80 bg-gradient-to-br from-[#F5FAFF] via-[#EEF6FF] to-[#DCEEFF]/90',
    'shadow-[0_8px_20px_rgba(33,142,231,0.10)] ring-1 ring-[#C5DFFB]/55',
    'hover:border-[#218EE7]/55 hover:shadow-[0_12px_26px_rgba(33,142,231,0.14)]',
    'dark:border-blue-400/35 dark:from-slate-900/90 dark:via-blue-950/40 dark:to-slate-900/80',
    'dark:ring-blue-400/20 dark:hover:border-blue-300/50',
  ].join(' '),
  due_soon: [
    'border-amber-300/80 bg-gradient-to-br from-[#FFFBF5] via-[#FFF7ED] to-[#FFEDD5]/90',
    'shadow-[0_8px_20px_rgba(245,158,11,0.10)] ring-1 ring-amber-200/70',
    'hover:border-amber-400/70 hover:shadow-[0_12px_26px_rgba(245,158,11,0.14)]',
    'dark:border-amber-400/35 dark:from-slate-900/90 dark:via-amber-950/35 dark:to-slate-900/80',
    'dark:ring-amber-400/20 dark:hover:border-amber-300/45',
  ].join(' '),
  maintenance: [
    'border-orange-300/80 bg-gradient-to-br from-[#FFF9F5] via-[#FFF4EB] to-[#FFE8D6]/90',
    'shadow-[0_8px_20px_rgba(249,115,22,0.10)] ring-1 ring-orange-200/70',
    'hover:border-orange-400/70 hover:shadow-[0_12px_26px_rgba(249,115,22,0.14)]',
    'dark:border-orange-400/35 dark:from-slate-900/90 dark:via-orange-950/35 dark:to-slate-900/80',
    'dark:ring-orange-400/20 dark:hover:border-orange-300/45',
  ].join(' '),
  urgent: [
    'border-rose-300/80 bg-gradient-to-br from-[#FFF8F8] via-[#FFF1F2] to-[#FFE4E6]/90',
    'shadow-[0_8px_20px_rgba(244,63,94,0.10)] ring-1 ring-rose-200/70',
    'hover:border-rose-400/70 hover:shadow-[0_12px_26px_rgba(244,63,94,0.14)]',
    'dark:border-rose-400/35 dark:from-slate-900/90 dark:via-rose-950/35 dark:to-slate-900/80',
    'dark:ring-rose-400/20 dark:hover:border-rose-300/45',
  ].join(' '),
}

export const vehicleCardTopAccentClass: Record<VehicleCardAccent, string> = {
  healthy: 'from-[#218EE7]/70 via-[#89CFF0]/50 to-transparent',
  due_soon: 'from-amber-400/80 via-amber-300/45 to-transparent',
  maintenance: 'from-orange-400/80 via-orange-300/45 to-transparent',
  urgent: 'from-rose-500/80 via-rose-300/45 to-transparent',
}

export const vehicleCardIconClass: Record<VehicleCardAccent, string> = {
  healthy:
    'bg-[#E8F3FE] text-[#0B68BE] ring-[#89CFF0]/80 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-400/40',
  due_soon:
    'bg-amber-50 text-amber-700 ring-amber-300/80 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/40',
  maintenance:
    'bg-orange-50 text-orange-700 ring-orange-300/80 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-400/40',
  urgent:
    'bg-rose-50 text-rose-700 ring-rose-300/80 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-400/40',
}

export const vehicleCardMetaLabelClass: Record<VehicleCardAccent, string> = {
  healthy: 'text-[#5499BF] dark:text-slate-400',
  due_soon: 'text-amber-700/80 dark:text-amber-300/80',
  maintenance: 'text-orange-700/80 dark:text-orange-300/80',
  urgent: 'text-rose-700/80 dark:text-rose-300/80',
}

export const vehicleCardNextEventPanelClass: Record<VehicleCardAccent, string> = {
  healthy:
    'border-[#C5DFFB]/80 bg-[#E8F3FE]/70 dark:border-blue-400/25 dark:bg-blue-950/35',
  due_soon:
    'border-amber-200/90 bg-amber-50/80 dark:border-amber-400/30 dark:bg-amber-950/35',
  maintenance:
    'border-orange-200/90 bg-orange-50/80 dark:border-orange-400/30 dark:bg-orange-950/35',
  urgent:
    'border-rose-200/90 bg-rose-50/80 dark:border-rose-400/30 dark:bg-rose-950/35',
}

export const vehicleCardNextEventHeadingClass: Record<VehicleCardAccent, string> = {
  healthy: 'text-[#0B68BE] dark:text-blue-300',
  due_soon: 'text-amber-700 dark:text-amber-300',
  maintenance: 'text-orange-700 dark:text-orange-300',
  urgent: 'text-rose-700 dark:text-rose-300',
}
