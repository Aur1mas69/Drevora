import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/** Shared back control for Worker Settings sub-pages. */
export function WorkerSettingsBackLink() {
  return (
    <Link
      to="/worker/settings"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-[color:var(--worker-primary)] transition-colors hover:text-[color:var(--worker-primary-hover)]"
    >
      <ChevronLeft className="size-5 shrink-0" aria-hidden />
      Settings
    </Link>
  )
}
