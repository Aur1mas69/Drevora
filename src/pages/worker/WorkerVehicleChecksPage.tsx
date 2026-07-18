import { WorkerComingSoonPanel } from '@/components/worker/WorkerComingSoonPanel'

/** Worker entry point from Vehicles → Start Vehicle Check. */
export default function WorkerVehicleChecksPage() {
  return (
    <WorkerComingSoonPanel
      title="Vehicle Checks"
      description="Start and complete your vehicle walkaround checks here."
    />
  )
}
