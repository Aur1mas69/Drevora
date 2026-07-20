import type { WorkerComplianceStatus } from '@/lib/workerProfileUtils'
import type { DriverStatus } from '@/services/driversService'

export type WorkerCardAccent =
  | 'working_healthy'
  | 'off_duty'
  | 'missing_info'
  | 'expiring'
  | 'non_compliant'
  | 'archived'
  | 'calm'

/**
 * Visual accent only — uses existing duty status + verified compliance status.
 * Does not invent states or change compliance calculation.
 *
 * Priority: archived → non-compliant → missing → expiring → working healthy → off duty → calm.
 */
export function resolveWorkerCardAccent(input: {
  status: DriverStatus
  compliance: WorkerComplianceStatus
  archived: boolean
}): WorkerCardAccent {
  if (input.archived) return 'archived'
  if (input.compliance === 'Expired' || input.status === 'Suspended') {
    return 'non_compliant'
  }
  if (input.compliance === 'Missing Info') return 'missing_info'
  if (input.compliance === 'Expiring Soon') return 'expiring'
  if (input.status === 'Working' && input.compliance === 'Compliant') {
    return 'working_healthy'
  }
  if (input.status === 'Off Duty') return 'off_duty'
  return 'calm'
}

export const workerCardShellClass: Record<WorkerCardAccent, string> = {
  working_healthy: [
    'border-emerald-300/70 bg-gradient-to-br from-[#F5FAFF] via-[#EEF8F4] to-[#DCEEFF]/90',
    'shadow-[0_8px_20px_rgba(16,185,129,0.10)] ring-1 ring-emerald-200/55',
    'hover:border-emerald-400/60 hover:shadow-[0_12px_26px_rgba(16,185,129,0.14)]',
    'dark:border-emerald-400/35 dark:from-slate-900/90 dark:via-emerald-950/30 dark:to-slate-900/80',
    'dark:ring-emerald-400/20 dark:hover:border-emerald-300/45',
  ].join(' '),
  off_duty: [
    'border-[#89CFF0]/70 bg-gradient-to-br from-[#F7FAFC] via-[#F1F5F9] to-[#E8F3FE]/90',
    'shadow-[0_8px_20px_rgba(100,116,139,0.08)] ring-1 ring-slate-200/70',
    'hover:border-[#89CFF0]/80 hover:shadow-[0_12px_26px_rgba(33,142,231,0.10)]',
    'dark:border-slate-500/40 dark:from-slate-900/90 dark:via-slate-800/50 dark:to-slate-900/80',
    'dark:ring-white/10 dark:hover:border-slate-400/40',
  ].join(' '),
  missing_info: [
    'border-amber-300/80 bg-gradient-to-br from-[#FFFBF5] via-[#FFF7ED] to-[#FFEDD5]/90',
    'shadow-[0_8px_20px_rgba(245,158,11,0.10)] ring-1 ring-amber-200/70',
    'hover:border-amber-400/70 hover:shadow-[0_12px_26px_rgba(245,158,11,0.14)]',
    'dark:border-amber-400/35 dark:from-slate-900/90 dark:via-amber-950/35 dark:to-slate-900/80',
    'dark:ring-amber-400/20 dark:hover:border-amber-300/45',
  ].join(' '),
  expiring: [
    'border-amber-300/80 bg-gradient-to-br from-[#FFFBF5] via-[#FFF7ED] to-[#FFEDD5]/90',
    'shadow-[0_8px_20px_rgba(245,158,11,0.10)] ring-1 ring-amber-200/70',
    'hover:border-amber-400/70 hover:shadow-[0_12px_26px_rgba(245,158,11,0.14)]',
    'dark:border-amber-400/35 dark:from-slate-900/90 dark:via-amber-950/35 dark:to-slate-900/80',
    'dark:ring-amber-400/20 dark:hover:border-amber-300/45',
  ].join(' '),
  non_compliant: [
    'border-rose-300/80 bg-gradient-to-br from-[#FFF8F8] via-[#FFF1F2] to-[#FFE4E6]/90',
    'shadow-[0_8px_20px_rgba(244,63,94,0.10)] ring-1 ring-rose-200/70',
    'hover:border-rose-400/70 hover:shadow-[0_12px_26px_rgba(244,63,94,0.14)]',
    'dark:border-rose-400/35 dark:from-slate-900/90 dark:via-rose-950/35 dark:to-slate-900/80',
    'dark:ring-rose-400/20 dark:hover:border-rose-300/45',
  ].join(' '),
  archived: [
    'border-slate-300/70 bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0]/80',
    'shadow-[0_6px_14px_rgba(100,116,139,0.06)] ring-1 ring-slate-200/60 opacity-90',
    'hover:border-slate-400/60 hover:shadow-[0_10px_20px_rgba(100,116,139,0.10)]',
    'dark:border-white/10 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-950/80',
    'dark:ring-white/5 dark:opacity-85',
  ].join(' '),
  calm: [
    'border-[#89CFF0]/80 bg-gradient-to-br from-[#F5FAFF] via-[#EEF6FF] to-[#DCEEFF]/90',
    'shadow-[0_8px_20px_rgba(33,142,231,0.10)] ring-1 ring-[#C5DFFB]/55',
    'hover:border-[#218EE7]/55 hover:shadow-[0_12px_26px_rgba(33,142,231,0.14)]',
    'dark:border-blue-400/35 dark:from-slate-900/90 dark:via-blue-950/40 dark:to-slate-900/80',
    'dark:ring-blue-400/20 dark:hover:border-blue-300/50',
  ].join(' '),
}

export const workerCardTopAccentClass: Record<WorkerCardAccent, string> = {
  working_healthy: 'from-emerald-400/75 via-cyan-300/45 to-transparent',
  off_duty: 'from-slate-400/60 via-[#89CFF0]/35 to-transparent',
  missing_info: 'from-amber-400/80 via-amber-300/45 to-transparent',
  expiring: 'from-amber-400/80 via-amber-300/45 to-transparent',
  non_compliant: 'from-rose-500/80 via-rose-300/45 to-transparent',
  archived: 'from-slate-400/50 via-slate-300/30 to-transparent',
  calm: 'from-[#218EE7]/70 via-[#89CFF0]/50 to-transparent',
}

export const workerCardAvatarClass: Record<WorkerCardAccent, string> = {
  working_healthy:
    'ring-emerald-300/80 shadow-[0_2px_8px_rgba(16,185,129,0.18)] dark:ring-emerald-400/40',
  off_duty:
    'ring-slate-300/80 shadow-[0_2px_8px_rgba(100,116,139,0.12)] dark:ring-slate-500/40',
  missing_info:
    'ring-amber-300/80 shadow-[0_2px_8px_rgba(245,158,11,0.18)] dark:ring-amber-400/40',
  expiring:
    'ring-amber-300/80 shadow-[0_2px_8px_rgba(245,158,11,0.18)] dark:ring-amber-400/40',
  non_compliant:
    'ring-rose-300/80 shadow-[0_2px_8px_rgba(244,63,94,0.18)] dark:ring-rose-400/40',
  archived:
    'ring-slate-300/70 shadow-none grayscale-[0.15] dark:ring-white/15',
  calm:
    'ring-[#89CFF0]/90 shadow-[0_2px_8px_rgba(33,142,231,0.16)] dark:ring-blue-400/40',
}

export const workerCardMetaLabelClass: Record<WorkerCardAccent, string> = {
  working_healthy: 'text-emerald-700/80 dark:text-emerald-300/80',
  off_duty: 'text-slate-500 dark:text-slate-400',
  missing_info: 'text-amber-700/80 dark:text-amber-300/80',
  expiring: 'text-amber-700/80 dark:text-amber-300/80',
  non_compliant: 'text-rose-700/80 dark:text-rose-300/80',
  archived: 'text-slate-500 dark:text-slate-500',
  calm: 'text-[#5499BF] dark:text-slate-400',
}

export const workerCardCompliancePanelClass: Record<WorkerCardAccent, string> = {
  working_healthy:
    'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-emerald-950/30',
  off_duty:
    'border-slate-200/80 bg-slate-50/80 dark:border-white/10 dark:bg-slate-800/40',
  missing_info:
    'border-amber-200/90 bg-amber-50/80 dark:border-amber-400/30 dark:bg-amber-950/35',
  expiring:
    'border-amber-200/90 bg-amber-50/80 dark:border-amber-400/30 dark:bg-amber-950/35',
  non_compliant:
    'border-rose-200/90 bg-rose-50/80 dark:border-rose-400/30 dark:bg-rose-950/35',
  archived:
    'border-slate-200/70 bg-slate-100/70 dark:border-white/10 dark:bg-slate-800/30',
  calm:
    'border-[#C5DFFB]/80 bg-[#E8F3FE]/70 dark:border-blue-400/25 dark:bg-blue-950/35',
}

/** Card-only badge reinforce for Missing Info (shared badge map stays slate for List/profile). */
export const workerCardMissingInfoBadgeClass =
  'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60'
