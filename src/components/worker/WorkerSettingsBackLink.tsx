import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export type WorkerSettingsBackLinkProps = {
  to?: string
  label?: string
}

/** Shared back control for Worker Settings sub-pages. */
export function WorkerSettingsBackLink({
  to = '/worker/settings',
  label,
}: WorkerSettingsBackLinkProps) {
  const settingsLabel = useWorkerChromeText('settings.title', 'Settings')
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-[color:var(--worker-primary)] transition-colors hover:text-[color:var(--worker-primary-hover)]"
    >
      <ChevronLeft className="size-5 shrink-0" aria-hidden />
      {label ?? settingsLabel}
    </Link>
  )
}
