import { Clock3, ShieldCheck } from 'lucide-react'

import { settingsInnerCardClassName } from '@/components/settings/SettingsControls'

export function TwoFactorAuthComingLaterCard() {
  return (
    <div className={`${settingsInnerCardClassName} opacity-90`}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white ring-1 ring-[#E2E8F0] dark:bg-slate-800/70 dark:ring-white/10">
          <ShieldCheck className="size-5 text-slate-400 dark:text-slate-500" strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Two-factor authentication</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
              <Clock3 className="size-3" strokeWidth={2.2} />
              Coming later
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
            MFA enrollment and verification are not implemented yet. This control will remain
            disabled until Supabase MFA is wired into DREVORA.
          </p>
        </div>
      </div>
    </div>
  )
}
