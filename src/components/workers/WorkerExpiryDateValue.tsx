import {
  formatWorkerProfileDate,
  getWorkerExpiryDateStatus,
  workerExpiryDateClassMap,
} from '@/lib/workerProfileUtils'

type WorkerExpiryDateValueProps = {
  value: string | null | undefined
  emphasized?: boolean
  emptyLabel?: string
}

export function WorkerExpiryDateValue({
  value,
  emphasized = false,
  emptyLabel = 'Not set',
}: WorkerExpiryDateValueProps) {
  const status = getWorkerExpiryDateStatus(value)
  const label = status === 'missing' ? emptyLabel : formatWorkerProfileDate(value)

  return (
    <span
      className={`font-semibold ${emphasized ? 'text-base' : 'text-sm'} ${
        status === 'missing'
          ? 'font-medium text-slate-400'
          : workerExpiryDateClassMap[status]
      }`}
    >
      {label}
    </span>
  )
}
