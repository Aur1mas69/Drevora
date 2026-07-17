import type { TyreMeasurement, TyreStatus, TyreUnit } from '@/lib/tyreCheckTypes'
import { tyreStatusClasses, tyreStatusLabel } from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import { TriangleAlert } from 'lucide-react'

type TyreCheckDiagramProps = {
  measurements: TyreMeasurement[]
  selectedTyreId: string | null
  onSelectTyre: (tyreId: string) => void
}

const STATUS_RING: Record<TyreStatus, string> = {
  good: 'ring-emerald-500',
  attention: 'ring-amber-500',
  critical: 'ring-rose-500',
  dirty: 'ring-yellow-400',
  not_checked: 'ring-slate-400',
}

const STATUS_GLOW: Record<TyreStatus, string> = {
  good: 'shadow-[0_0_0_3px_rgba(16,185,129,0.18)]',
  attention: 'shadow-[0_0_0_3px_rgba(245,158,11,0.20)]',
  critical: 'shadow-[0_0_0_3px_rgba(244,63,94,0.20)]',
  dirty: 'shadow-[0_0_0_3px_rgba(250,204,21,0.28)]',
  not_checked: 'shadow-[0_0_0_3px_rgba(148,163,184,0.22)]',
}

function TyreShape({
  tyre,
  selected,
  onSelect,
}: {
  tyre: TyreMeasurement
  selected: boolean
  onSelect: () => void
}) {
  const colours = tyreStatusClasses(tyre.status)
  const depthLabel =
    tyre.treadDepthMm == null ? '—' : `${tyre.treadDepthMm.toFixed(1)} mm`

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${tyre.axleLabel} ${tyre.position}, ${depthLabel}, ${tyreStatusLabel(tyre.status)}`}
      className={cn(
        'group flex w-[4.6rem] flex-col items-center gap-1.5 rounded-[16px] p-1 transition-all sm:w-[5.25rem]',
        selected ? 'scale-[1.03]' : 'hover:scale-[1.02]',
      )}
    >
      <div
        className={cn(
          'relative flex h-[5.75rem] w-[2.85rem] items-center justify-center rounded-[999px] border-[3px] transition-all sm:h-[6.5rem] sm:w-[3.15rem]',
          'border-[#2C3548] bg-gradient-to-b from-[#4B5568] via-[#2F3645] to-[#1F2430]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_10px_rgba(33,62,110,0.16)]',
          STATUS_GLOW[tyre.status],
          selected
            ? 'ring-2 ring-[#218EE7] ring-offset-2 ring-offset-[#F8FBFF]'
            : cn('ring-2 ring-offset-1 ring-offset-[#F8FBFF]', STATUS_RING[tyre.status]),
        )}
      >
        {/* Tread grooves */}
        <div className="pointer-events-none absolute inset-[5px] flex justify-between rounded-[999px] px-[3px]">
          {[0, 1, 2, 3].map((groove) => (
            <span
              key={groove}
              className="w-[2px] rounded-full bg-gradient-to-b from-[#9AA3B5]/70 via-[#6B7286]/55 to-[#9AA3B5]/40"
            />
          ))}
        </div>

        {/* Sidewall highlight */}
        <div className="pointer-events-none absolute inset-y-2 left-[3px] w-[3px] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute inset-y-2 right-[3px] w-[3px] rounded-full bg-black/25" />

        {/* Centre info chip */}
        <div className="relative z-[1] flex w-[2.15rem] flex-col items-center rounded-[10px] bg-[#F8FBFF]/95 px-1 py-1.5 text-center shadow-sm ring-1 ring-white/40 sm:w-[2.35rem]">
          <span className={cn('mb-1 size-2 rounded-full', colours.dot)} />
          <span className="text-[10px] font-bold leading-tight tabular-nums text-[#2A376F] sm:text-[11px]">
            {depthLabel}
          </span>
        </div>
      </div>

      <div className="min-h-[2.6rem] w-full text-center">
        <p className="text-[10px] font-semibold leading-tight text-[#113C69] sm:text-[11px]">
          {tyre.position}
        </p>
        <p
          className={cn(
            'mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px]',
            colours.badge,
          )}
        >
          {tyreStatusLabel(tyre.status)}
        </p>
      </div>
    </button>
  )
}

function AxleRow({
  label,
  tyres,
  selectedTyreId,
  onSelectTyre,
}: {
  label: string
  tyres: TyreMeasurement[]
  selectedTyreId: string | null
  onSelectTyre: (tyreId: string) => void
}) {
  const leftTyres = tyres.filter((tyre) => tyre.position.toLowerCase().includes('left'))
  const rightTyres = tyres.filter((tyre) => tyre.position.toLowerCase().includes('right'))

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#D3E9FC]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5499BF]">
          {label}
        </p>
        <div className="h-px flex-1 bg-[#D3E9FC]" />
      </div>

      <div className="relative flex items-center justify-center gap-1 sm:gap-2">
        <div className="pointer-events-none absolute left-[12%] right-[12%] top-[2.7rem] h-[6px] rounded-full bg-gradient-to-r from-transparent via-[#89CFF0]/70 to-transparent sm:top-[3.1rem]" />
        <div className="pointer-events-none absolute left-1/2 top-[2.4rem] h-3 w-3 -translate-x-1/2 rounded-full bg-[#89CFF0] ring-2 ring-white sm:top-[2.8rem]" />

        <div className="relative z-[1] flex items-start justify-end gap-0.5 sm:gap-1">
          {leftTyres.map((tyre) => (
            <TyreShape
              key={tyre.id}
              tyre={tyre}
              selected={selectedTyreId === tyre.id}
              onSelect={() => onSelectTyre(tyre.id)}
            />
          ))}
        </div>

        <div className="relative z-[1] mx-1 hidden h-16 w-8 shrink-0 rounded-[10px] border border-[#D3E9FC] bg-white/70 sm:block" />

        <div className="relative z-[1] flex items-start justify-start gap-0.5 sm:gap-1">
          {rightTyres.map((tyre) => (
            <TyreShape
              key={tyre.id}
              tyre={tyre}
              selected={selectedTyreId === tyre.id}
              onSelect={() => onSelectTyre(tyre.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function UnitDiagram({
  unit,
  title,
  measurements,
  selectedTyreId,
  onSelectTyre,
}: {
  unit: TyreUnit
  title: string
  measurements: TyreMeasurement[]
  selectedTyreId: string | null
  onSelectTyre: (tyreId: string) => void
}) {
  const unitTyres = measurements.filter((tyre) => tyre.unit === unit)
  if (unitTyres.length === 0) return null

  const axleNumbers = [...new Set(unitTyres.map((tyre) => tyre.axleNumber))].sort(
    (a, b) => a - b,
  )

  return (
    <div className="rounded-[18px] border border-[#D3E9FC] bg-gradient-to-b from-[#F3F8FF] to-[#EAF4FF] p-3 shadow-[0_2px_10px_rgba(33,142,231,0.06)] sm:p-4">
      <div className="mb-3 flex items-center justify-center">
        <div className="rounded-[12px] bg-white/90 px-4 py-2 text-sm font-semibold text-[#2A376F] shadow-sm ring-1 ring-blue-100">
          {title}
        </div>
      </div>

      <div className="mx-auto mb-4 flex w-full max-w-[16rem] flex-col items-center">
        <div className="h-4 w-16 rounded-t-[10px] border border-b-0 border-[#89CFF0] bg-[#DDF0FF]" />
        <div className="h-14 w-28 rounded-[16px] border-2 border-[#89CFF0] bg-gradient-to-b from-[#EAF4FF] to-white shadow-inner" />
        <div className="mt-1 h-2 w-10 rounded-full bg-[#BFE3F5]" />
      </div>

      <div className="space-y-5">
        {axleNumbers.map((axleNumber) => {
          const tyres = unitTyres.filter((tyre) => tyre.axleNumber === axleNumber)
          const label = tyres[0]?.axleLabel ?? `Axle ${axleNumber}`
          return (
            <AxleRow
              key={`${unit}-${axleNumber}`}
              label={label}
              tyres={tyres}
              selectedTyreId={selectedTyreId}
              onSelectTyre={onSelectTyre}
            />
          )
        })}
      </div>
    </div>
  )
}

const TREAD_WEAR_SCALE = [
  { depth: '8 mm', worn: '0% worn', row: 'bg-[#0F7A3A]', text: 'text-white' },
  { depth: '7 mm', worn: '16% worn', row: 'bg-[#22A34A]', text: 'text-white' },
  { depth: '6 mm', worn: '31% worn', row: 'bg-[#8BC34A]', text: 'text-[#14301A]' },
  { depth: '5 mm', worn: '47% worn', row: 'bg-[#F6D23A]', text: 'text-[#3A2E05]' },
  { depth: '4 mm', worn: '62% worn', row: 'bg-[#F0A020]', text: 'text-[#2E1F05]' },
  { depth: '3 mm', worn: '78% worn', row: 'bg-[#E86B12]', text: 'text-white' },
  { depth: '2 mm', worn: '94% worn', row: 'bg-[#E04A2F]', text: 'text-white' },
  { depth: '1.6 mm', worn: '100% worn', row: 'bg-[#9B1C1C]', text: 'text-white' },
] as const

function TyreCheckLegends() {
  return (
    <div className="grid gap-3 md:grid-cols-2 md:items-start">
      <div className="rounded-[16px] border border-[#D3E9FC] bg-white/90 p-3.5 shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#2A376F]">
          Tyre Tread Depth & Wear Scale
        </h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Visual tread wear reference only.
        </p>

        <div className="mt-3 overflow-hidden rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF]">
          <div className="grid grid-cols-2 gap-2 bg-[#EAF4FF] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
              Tyre tread depth
            </span>
            <span className="text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
              % worn
            </span>
          </div>

          <div className="space-y-1 p-1.5">
            {TREAD_WEAR_SCALE.map((item) => (
              <div
                key={item.depth}
                className={cn(
                  'grid grid-cols-2 items-center gap-2 rounded-[10px] px-3 py-1.5',
                  item.row,
                  item.text,
                )}
              >
                <span className="min-w-0 text-xs font-bold tabular-nums leading-tight">
                  {item.depth}
                </span>
                <span className="min-w-0 text-right text-xs font-semibold tabular-nums leading-tight">
                  {item.worn}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#D3E9FC] bg-[#F8FBFF] p-3.5 shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#2A376F]">
          Tyre Condition Indicators
        </h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Tread depth statuses are separate from Dirty and Defect flags.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-[12px] border border-[#D3E9FC] bg-[#EAF4FF]/70 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
              Tread condition
            </p>
            <ul className="mt-2 space-y-1.5">
              {(
                [
                  'good',
                  'attention',
                  'critical',
                  'not_checked',
                ] as const satisfies readonly TyreStatus[]
              ).map((status) => (
                <li key={status} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      tyreStatusClasses(status).dot,
                    )}
                  />
                  <span className="text-xs font-semibold text-[#113C69]">
                    {tyreStatusLabel(status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[12px] border border-[#D3E9FC] bg-[#EAF4FF]/70 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
              Additional condition
            </p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-yellow-400" />
                <span className="text-xs font-semibold text-[#113C69]">Dirty</span>
              </li>
              <li className="flex items-center gap-2.5">
                <TriangleAlert
                  className="size-3.5 shrink-0 text-rose-600"
                  aria-hidden
                />
                <span className="text-xs font-semibold text-[#113C69]">Defect</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TyreCheckDiagram({
  measurements,
  selectedTyreId,
  onSelectTyre,
}: TyreCheckDiagramProps) {
  return (
    <div className="space-y-4">
      <TyreCheckLegends />
      <UnitDiagram
        unit="vehicle"
        title="Truck · top view"
        measurements={measurements}
        selectedTyreId={selectedTyreId}
        onSelectTyre={onSelectTyre}
      />
      <UnitDiagram
        unit="trailer"
        title="Trailer · top view"
        measurements={measurements}
        selectedTyreId={selectedTyreId}
        onSelectTyre={onSelectTyre}
      />
    </div>
  )
}
