import {
  employmentTypeClassMap,
  formatEmploymentType,
  isEmploymentType,
  type EmploymentType,
} from '@/lib/workerProfileUtils'
import { cn } from '@/lib/utils'

type WorkerEmploymentTypeBadgeProps = {
  employmentType: EmploymentType | null | undefined
  className?: string
}

export function WorkerEmploymentTypeBadge({
  employmentType,
  className,
}: WorkerEmploymentTypeBadgeProps) {
  if (!employmentType) {
    return (
      <span className={cn('text-sm font-medium text-slate-400', className)}>
        Not set
      </span>
    )
  }

  const resolvedType = isEmploymentType(employmentType) ? employmentType : 'Other'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        employmentTypeClassMap[resolvedType],
        className,
      )}
    >
      {formatEmploymentType(employmentType)}
    </span>
  )
}
