import type { SupportRequestStatus } from '@/lib/supportRequestTypes'
import { supportStatusDisplayLabel } from '@/i18n/workerFinalDisplay'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export function SupportStatusBadge({
  status,
}: {
  status: SupportRequestStatus
}) {
  const { t } = useTranslation('worker')
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
      {supportStatusDisplayLabel(status, t)}
    </span>
  )
}
