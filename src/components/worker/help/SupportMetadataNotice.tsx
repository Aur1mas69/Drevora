import {
  collectSupportDeviceMetadata,
  getSupportMetadataDisclosureLines,
} from '@/lib/supportDeviceMetadata'
import type { SupportDeviceMetadata } from '@/lib/supportRequestTypes'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Collapsed Technical details for Bug reports only.
 * Passwords, tokens and session data are never collected.
 */
export function SupportMetadataNotice() {
  const location = useLocation()
  const [meta, setMeta] = useState<SupportDeviceMetadata | null>(null)

  useEffect(() => {
    let cancelled = false
    void collectSupportDeviceMetadata(location.pathname).then((next) => {
      if (!cancelled) setMeta(next)
    })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  const lines = meta ? getSupportMetadataDisclosureLines(meta) : []

  return (
    <details className="group rounded-2xl border border-[#BFE3F5]/80 bg-[#F5FAFF] dark:border-slate-700 dark:bg-slate-900/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[color:var(--worker-text)] [&::-webkit-details-marker]:hidden">
        <span>Technical details</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[color:var(--worker-text-muted)] transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-2 border-t border-[#BFE3F5]/60 px-4 py-3 dark:border-slate-700">
        <p className="text-xs text-[color:var(--worker-text-secondary)]">
          Safe app details attached to help diagnose this bug. Passwords,
          tokens and session data are never collected.
        </p>
        {lines.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-[color:var(--worker-text-secondary)]">
            {lines.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[color:var(--worker-text-muted)]">Loading…</p>
        )}
      </div>
    </details>
  )
}
