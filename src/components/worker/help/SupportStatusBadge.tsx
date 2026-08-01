import type { SupportRequestStatus } from '@/lib/supportRequestTypes'
import { SUPPORT_STATUS_LABELS } from '@/lib/supportRequestTypes'
import { cn } from '@/lib/utils'

export function SupportStatusBadge({
  status,
}: {
  status: SupportRequestStatus
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset',
        status === 'submitted' &&
          'bg-[#E8F3FE] text-[#0B68BE] ring-[#89CFF0]/70',
        status === 'in_progress' &&
          'bg-amber-50 text-amber-800 ring-amber-200/80',
        status === 'resolved' &&
          'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
        status === 'closed' && 'bg-slate-100 text-slate-600 ring-slate-200/80',
      )}
    >
      {SUPPORT_STATUS_LABELS[status]}
    </span>
  )
}
