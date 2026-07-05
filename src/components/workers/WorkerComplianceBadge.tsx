import {
  computeWorkerComplianceStatus,
  workerComplianceStatusClassMap,
  type WorkerComplianceStatus,
} from '@/lib/workerProfileUtils'
import type { Driver } from '@/services/driversService'
import { cn } from '@/lib/utils'

type WorkerComplianceBadgeProps = {
  driver: Pick<
    Driver,
    | 'role'
    | 'drivingLicenceExpiry'
    | 'cpcExpiry'
    | 'driverCardExpiry'
    | 'medicalExpiry'
  >
  status?: WorkerComplianceStatus
  className?: string
}

export function WorkerComplianceBadge({
  driver,
  status,
  className,
}: WorkerComplianceBadgeProps) {
  const resolvedStatus = status ?? computeWorkerComplianceStatus(driver)

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
        workerComplianceStatusClassMap[resolvedStatus],
        className,
      )}
    >
      {resolvedStatus}
    </span>
  )
}
