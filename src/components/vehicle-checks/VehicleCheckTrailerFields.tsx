import { Input } from '@/components/ui/input'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
import { cn } from '@/lib/utils'
import {
  applyVehicleCheckTrailerSource,
  companyTrailerPrimaryLabel,
  companyTrailerSecondaryLabel,
  selectCompanyTrailerForVehicleCheck,
  setThirdPartyTrailerIdentity,
  trailerMatchesSearchQuery,
  type VehicleCheckTrailerDraft,
} from '@/lib/vehicleCheckTrailerAttachment'
import type { VehicleCheckTrailerSource } from '@/lib/vehicleCheckTypes'
import type { Vehicle } from '@/services/vehiclesService'
import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

type VehicleCheckTrailerFieldsProps = {
  draft: VehicleCheckTrailerDraft
  companyTrailers: Vehicle[]
  onChange: (next: VehicleCheckTrailerDraft) => void
  disabled?: boolean
  /** Worker setup uses theme tokens; Admin modal uses existing inspection chrome. */
  tone?: 'worker' | 'admin'
  error?: string | null
}

export function VehicleCheckTrailerFields({
  draft,
  companyTrailers,
  onChange,
  disabled = false,
  tone = 'worker',
  error = null,
}: VehicleCheckTrailerFieldsProps) {
  const trailerLabel = useWorkerChromeText('vehicleChecks.trailer', 'Trailer')
  const noTrailer = useWorkerChromeText('vehicleChecks.noTrailer', 'No trailer')
  const companyTrailer = useWorkerChromeText('vehicleChecks.companyTrailer', 'Company trailer')
  const thirdParty = useWorkerChromeText('vehicleChecks.thirdParty', 'Third-party')
  const thirdPartyAria = useWorkerChromeText(
    'vehicleChecks.thirdPartyAria',
    'Third-party / hired trailer',
  )
  const changeCompanyTrailer = useWorkerChromeText(
    'vehicleChecks.changeCompanyTrailer',
    'Change company trailer',
  )
  const searchCompanyTrailer = useWorkerChromeText(
    'vehicleChecks.searchCompanyTrailer',
    'Search company trailer',
  )
  const trailerSearchPlaceholder = useWorkerChromeText(
    'vehicleChecks.trailerSearchPlaceholder',
    'Trailer number, type, or registration',
  )
  const noCompanyTrailers = useWorkerChromeText(
    'vehicleChecks.noCompanyTrailers',
    'No company trailers in the fleet.',
  )
  const noTrailerMatch = useWorkerChromeText(
    'vehicleChecks.noTrailerMatch',
    'No company trailers match that search.',
  )
  const trailerIdentifier = useWorkerChromeText(
    'vehicleChecks.trailerIdentifier',
    'Trailer identifier / number',
  )
  const registrationOptional = useWorkerChromeText(
    'vehicleChecks.registrationOptional',
    'Registration (optional)',
  )
  const ifKnown = useWorkerChromeText('vehicleChecks.ifKnown', 'If known')

  const sourceOptions = [
    { value: 'none' as const, label: noTrailer, ariaLabel: noTrailer },
    { value: 'company' as const, label: companyTrailer, ariaLabel: companyTrailer },
    { value: 'third_party' as const, label: thirdParty, ariaLabel: thirdPartyAria },
  ]

  const isAdmin = tone === 'admin'
  const [trailerSearch, setTrailerSearch] = useState('')

  const selectedTrailer = useMemo(
    () => companyTrailers.find((row) => row.id === draft.trailerVehicleId) ?? null,
    [companyTrailers, draft.trailerVehicleId],
  )

  const filteredTrailers = useMemo(() => {
    const matches = companyTrailers.filter((trailer) =>
      trailerMatchesSearchQuery(trailer, trailerSearch),
    )
    return [...matches].sort((a, b) =>
      companyTrailerPrimaryLabel(a).localeCompare(companyTrailerPrimaryLabel(b)),
    )
  }, [companyTrailers, trailerSearch])

  function handleSource(next: VehicleCheckTrailerSource) {
    if (disabled || next === draft.source) return
    setTrailerSearch('')
    onChange(applyVehicleCheckTrailerSource(draft, next))
  }

  const optionClass = (active: boolean) =>
    isAdmin
      ? cn(
          'min-h-10 rounded-[12px] border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition-colors',
          active
            ? 'border-[#2563EB] bg-[#EEF6FF] text-[#113C69] dark:border-sky-400 dark:bg-sky-950/40 dark:text-slate-100'
            : 'border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] text-slate-600 hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-300',
        )
      : cn(
          'min-h-11 rounded-2xl border px-2 py-2 text-center text-[11px] font-semibold leading-tight transition-colors',
          active
            ? 'border-[color:var(--worker-primary)] bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-text)]'
            : 'border-[color:var(--worker-border)] bg-[color:var(--worker-input)] text-[color:var(--worker-text-secondary)]',
        )

  return (
    <div className="space-y-3">
      <div>
        <p
          className={
            isAdmin
              ? 'text-sm font-medium text-slate-700 dark:text-slate-200'
              : 'text-xs font-semibold uppercase tracking-[0.12em] text-slate-400'
          }
        >
          {trailerLabel}
        </p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {sourceOptions.map((option) => {
            const active = draft.source === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                aria-label={option.ariaLabel}
                onClick={() => handleSource(option.value)}
                className={optionClass(active)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {draft.source === 'company' ? (
        <div className="space-y-2">
          {selectedTrailer ? (
            <div
              className={
                isAdmin
                  ? 'rounded-[12px] border border-[#C5DFFB]/80 bg-[#F5FAFF] px-3.5 py-3 dark:border-white/10 dark:bg-slate-800/60'
                  : 'rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3.5 py-3'
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    {companyTrailer}
                  </p>
                  <p
                    className={
                      isAdmin
                        ? 'mt-1 text-base font-bold tracking-[0.04em] text-[#113C69] dark:text-slate-100'
                        : 'mt-1 text-base font-bold tracking-[0.04em] text-slate-900'
                    }
                  >
                    {companyTrailerPrimaryLabel(selectedTrailer)}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {companyTrailerSecondaryLabel(selectedTrailer) || trailerLabel}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setTrailerSearch('')
                    onChange(applyVehicleCheckTrailerSource(draft, 'company'))
                  }}
                  aria-label={changeCompanyTrailer}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <label className="block">
                <span
                  className={
                    isAdmin
                      ? 'text-sm font-medium text-slate-700 dark:text-slate-200'
                      : 'text-sm font-medium text-slate-700'
                  }
                >
                  {searchCompanyTrailer}
                </span>
                <div className="relative mt-1.5">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={trailerSearch}
                    disabled={disabled}
                    onChange={(event) => setTrailerSearch(event.target.value)}
                    placeholder={trailerSearchPlaceholder}
                    autoComplete="off"
                    className={
                      isAdmin
                        ? 'h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] pl-9'
                        : 'h-12 rounded-2xl pl-9'
                    }
                  />
                </div>
              </label>

              {companyTrailers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  {noCompanyTrailers}
                </p>
              ) : (
                <div
                  className={
                    isAdmin
                      ? 'max-h-40 overflow-y-auto rounded-[12px] border border-[#C5DFFB] bg-white py-1 dark:border-white/10 dark:bg-slate-900'
                      : 'max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1'
                  }
                >
                  {filteredTrailers.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">
                      {noTrailerMatch}
                    </p>
                  ) : (
                    filteredTrailers.map((trailer) => (
                      <button
                        key={trailer.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setTrailerSearch('')
                          onChange(selectCompanyTrailerForVehicleCheck(trailer))
                        }}
                        className={
                          isAdmin
                            ? 'flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-[#F5FAFF] dark:hover:bg-slate-800/50'
                            : 'flex w-full flex-col items-start px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50'
                        }
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {companyTrailerPrimaryLabel(trailer)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {companyTrailerSecondaryLabel(trailer) || trailerLabel}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {draft.source === 'third_party' ? (
        <div className="space-y-3">
          <label className="block">
            <span
              className={
                isAdmin
                  ? 'text-sm font-medium text-slate-700 dark:text-slate-200'
                  : 'text-sm font-medium text-slate-700'
              }
            >
              {trailerIdentifier}
            </span>
            <Input
              type="text"
              value={draft.trailerNumberSnapshot ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  setThirdPartyTrailerIdentity(
                    event.target.value,
                    draft.trailerRegistrationSnapshot ?? '',
                  ),
                )
              }
              placeholder="e.g. ABC123"
              autoComplete="off"
              className={
                isAdmin
                  ? 'mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]'
                  : 'mt-1.5 h-12 rounded-2xl'
              }
              required
            />
          </label>
          <label className="block">
            <span
              className={
                isAdmin
                  ? 'text-sm font-medium text-slate-700 dark:text-slate-200'
                  : 'text-sm font-medium text-slate-700'
              }
            >
              {registrationOptional}
            </span>
            <Input
              type="text"
              value={draft.trailerRegistrationSnapshot ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  setThirdPartyTrailerIdentity(
                    draft.trailerNumberSnapshot ?? '',
                    event.target.value,
                  ),
                )
              }
              placeholder={ifKnown}
              autoComplete="off"
              className={
                isAdmin
                  ? 'mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]'
                  : 'mt-1.5 h-12 rounded-2xl'
              }
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
    </div>
  )
}
