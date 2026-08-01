import type {
  TyreMeasurement,
  TyreStatus,
  TyreStatusPalette,
  TyreUnit,
} from '@/lib/tyreCheckTypes'
import {
  compareTyrePositions,
  TREAD_WEAR_LEGEND,
  tyreStatusClasses,
  tyreStatusLabel,
  tyreTreadVisualClasses,
} from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import { TriangleAlert } from 'lucide-react'

type TyreCheckDiagramProps = {
  measurements: TyreMeasurement[]
  selectedTyreId: string | null
  onSelectTyre: (tyreId: string) => void
  /**
   * Stronger cyan selection treatment for Worker mobile inspection.
   * Keeps status rings (e.g. green completed) and adds an outer selection ring.
   * Admin preview leaves this unset to preserve its existing selected look.
   */
  emphasizeSelection?: boolean
  /**
   * 'vivid' (default) is the outdoor-readable Worker mobile palette.
   * 'pastel' is the softer tone used on Admin Configuration / History.
   */
  palette?: TyreStatusPalette
  /** Overrides the "Truck · top view" heading (e.g. for a single-vehicle Admin preview). */
  vehicleUnitTitle?: string
}

/** Worker selected tyre: crisp outline, minimal glow (no soft blur wash). */
const WORKER_SELECTED_OUTLINE =
  'outline outline-[3px] outline-[#38BDF8] outline-offset-[2px] shadow-[0_0_0_2px_rgba(56,189,248,0.35)]'

function TyreShape({
  tyre,
  selected,
  onSelect,
  emphasizeSelection,
  palette,
}: {
  tyre: TyreMeasurement
  selected: boolean
  onSelect: () => void
  emphasizeSelection: boolean
  palette: TyreStatusPalette
}) {
  const colours = tyreTreadVisualClasses(tyre.treadDepthMm, {
    dirty: Boolean(tyre.isDirty) || tyre.status === 'dirty',
    palette,
  })
  const depthLabel =
    tyre.treadDepthMm == null ? '—' : `${tyre.treadDepthMm.toFixed(1)} mm`

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${tyre.axleLabel} ${tyre.position}, ${depthLabel}, ${tyreStatusLabel(tyre.status)}`}
      aria-pressed={selected}
      className={cn(
        'group flex w-[4.6rem] flex-col items-center gap-1.5 rounded-[16px] p-1 transition-all sm:w-[5.25rem]',
        selected ? 'scale-[1.03]' : 'hover:scale-[1.02]',
        emphasizeSelection &&
          selected &&
          'bg-[#E0F2FE]/90 ring-1 ring-[#38BDF8]/50 dark:bg-[#1a2740] dark:ring-[#38BDF8]/55',
      )}
    >
      <div
        className={cn(
          'relative flex h-[5.75rem] w-[2.85rem] items-center justify-center rounded-[999px] border-[3px] transition-all sm:h-[6.5rem] sm:w-[3.15rem]',
          // Black tyre body — never recoloured by selection.
          'border-[#2C3548] bg-gradient-to-b from-[#4B5568] via-[#2F3645] to-[#1F2430]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_10px_rgba(33,62,110,0.16)]',
          emphasizeSelection
            ? cn(
                // Wear-legend ring always stays visible when selected.
                'ring-2 ring-offset-1 ring-offset-[#F8FBFF] dark:ring-offset-[#10141c]',
                colours.ringClass,
                colours.glowClass,
                selected && WORKER_SELECTED_OUTLINE,
              )
            : cn(
                colours.glowClass,
                selected
                  ? 'ring-2 ring-[#218EE7] ring-offset-2 ring-offset-[#F8FBFF] dark:ring-offset-[#10141c]'
                  : cn(
                      'ring-2 ring-offset-1 ring-offset-[#F8FBFF] dark:ring-offset-[#10141c]',
                      colours.ringClass,
                    ),
              ),
        )}
      >
        {/* Soft cyan wash over the black tyre when selected (Worker only). */}
        {emphasizeSelection && selected ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[999px] bg-[#38BDF8]/12"
          />
        ) : null}

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
        <div className="relative z-[1] flex w-[2.15rem] flex-col items-center rounded-[10px] bg-[#F8FBFF] px-1 py-1.5 text-center shadow-sm ring-1 ring-[#C5DFFB] dark:bg-[#1a1f2b] dark:ring-white/20 sm:w-[2.35rem]">
          <span className={cn('mb-1 size-2 rounded-full', colours.dot)} />
          <span className="tyre-diagram-depth text-[10px] font-bold leading-tight tabular-nums text-[#0B1F3A] sm:text-[11px]">
            {depthLabel}
          </span>
        </div>
      </div>

      <div className="min-h-[2.6rem] w-full text-center">
        <p className="tyre-diagram-position text-[10px] font-bold leading-tight text-[#0B1F3A] sm:text-[11px]">
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
  emphasizeSelection,
  palette,
}: {
  label: string
  tyres: TyreMeasurement[]
  selectedTyreId: string | null
  onSelectTyre: (tyreId: string) => void
  emphasizeSelection: boolean
  palette: TyreStatusPalette
}) {
  // Outer → Inner on each side so dual axles render outermost wheels first.
  const leftTyres = tyres
    .filter((tyre) => tyre.position.toLowerCase().includes('left'))
    .slice()
    .sort((a, b) => compareTyrePositions(a.position, b.position))
  const rightTyres = tyres
    .filter((tyre) => tyre.position.toLowerCase().includes('right'))
    .slice()
    .sort((a, b) => compareTyrePositions(a.position, b.position))

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#89CFF0] dark:bg-white/35" />
        <p className="tyre-diagram-axle-label text-[11px] font-bold uppercase tracking-[0.12em] text-[#0B68BE]">
          {label}
        </p>
        <div className="h-px flex-1 bg-[#89CFF0] dark:bg-white/35" />
      </div>

      <div className="relative flex items-center justify-center gap-1 sm:gap-2">
        <div className="pointer-events-none absolute left-[12%] right-[12%] top-[2.7rem] h-[3px] rounded-full bg-[#5BA3D9] dark:bg-[#6f80ff] sm:top-[3.1rem]" />
        <div className="pointer-events-none absolute left-1/2 top-[2.45rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#4344F6] ring-2 ring-white dark:ring-[#10141c] sm:top-[2.85rem]" />

        <div className="relative z-[1] flex items-start justify-end gap-0.5 sm:gap-1">
          {leftTyres.map((tyre) => (
            <TyreShape
              key={tyre.id}
              tyre={tyre}
              selected={selectedTyreId === tyre.id}
              onSelect={() => onSelectTyre(tyre.id)}
              emphasizeSelection={emphasizeSelection}
              palette={palette}
            />
          ))}
        </div>

        <div className="relative z-[1] mx-1 hidden h-16 w-8 shrink-0 rounded-[10px] border border-[#D3E9FC] bg-white/70 dark:border-white/10 dark:bg-slate-800/70 sm:block" />

        <div className="relative z-[1] flex items-start justify-start gap-0.5 sm:gap-1">
          {rightTyres.map((tyre) => (
            <TyreShape
              key={tyre.id}
              tyre={tyre}
              selected={selectedTyreId === tyre.id}
              onSelect={() => onSelectTyre(tyre.id)}
              emphasizeSelection={emphasizeSelection}
              palette={palette}
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
  emphasizeSelection,
  palette,
}: {
  unit: TyreUnit
  title: string
  measurements: TyreMeasurement[]
  selectedTyreId: string | null
  onSelectTyre: (tyreId: string) => void
  emphasizeSelection: boolean
  palette: TyreStatusPalette
}) {
  const unitTyres = measurements.filter((tyre) => tyre.unit === unit)
  if (unitTyres.length === 0) return null

  const axleNumbers = [...new Set(unitTyres.map((tyre) => tyre.axleNumber))].sort(
    (a, b) => a - b,
  )

  return (
    <div className="rounded-[18px] border border-[#D3E9FC] bg-gradient-to-b from-[#F3F8FF] to-[#EAF4FF] p-3 shadow-[0_2px_10px_rgba(33,142,231,0.06)] dark:border-white/20 dark:bg-[#10141c] dark:bg-none dark:shadow-none sm:p-4">
      <div className="mb-3 flex items-center justify-center">
        <div className="rounded-[12px] bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A] shadow-sm ring-1 ring-[#C5DFFB] dark:bg-[#1a1f2b] dark:text-white dark:ring-white/20">
          {title}
        </div>
      </div>

      <div className="mx-auto mb-4 flex w-full max-w-[16rem] flex-col items-center">
        <div className="h-4 w-16 rounded-t-[10px] border border-b-0 border-[#89CFF0] bg-[#DDF0FF] dark:border-[#4344F6]/50 dark:bg-[#1a1f2b]" />
        <div className="h-14 w-28 rounded-[16px] border-2 border-[#89CFF0] bg-gradient-to-b from-[#EAF4FF] to-white shadow-inner dark:border-[#4344F6]/55 dark:bg-[#151922] dark:bg-none dark:shadow-none" />
        <div className="mt-1 h-2 w-10 rounded-full bg-[#BFE3F5] dark:bg-[#4344F6]/70" />
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
              emphasizeSelection={emphasizeSelection}
              palette={palette}
            />
          )
        })}
      </div>
    </div>
  )
}

function TyreCheckLegends({ palette }: { palette: TyreStatusPalette }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 md:items-start">
      <div className="rounded-[16px] border border-[#D3E9FC] bg-white/90 p-3.5 shadow-[0_2px_8px_rgba(40,80,140,0.04)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#2A376F] dark:text-slate-100">
          Tyre Tread Depth & Wear Scale
        </h3>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Visual tread wear reference only.
        </p>

        <div className="mt-3 overflow-hidden rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-800/60">
          <div className="grid grid-cols-2 gap-2 bg-[#EAF4FF] px-3 py-2 dark:bg-slate-800/70">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
              Tyre tread depth
            </span>
            <span className="text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
              % worn
            </span>
          </div>

          <div className="space-y-1 p-1.5">
            {TREAD_WEAR_LEGEND.map((item) => (
              <div
                key={item.depthLabel}
                className={cn(
                  'grid grid-cols-2 items-center gap-2 rounded-[10px] px-3 py-1.5',
                  item.rowClass,
                )}
              >
                <span className="min-w-0 text-xs font-bold tabular-nums leading-tight">
                  {item.depthLabel}
                </span>
                <span className="min-w-0 text-right text-xs font-semibold tabular-nums leading-tight">
                  {item.wornLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#D3E9FC] bg-[#F8FBFF] p-3.5 shadow-[0_2px_8px_rgba(40,80,140,0.04)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#2A376F] dark:text-slate-100">
          Tyre Condition Indicators
        </h3>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Tread depth statuses are separate from Dirty and Defect flags.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-[12px] border border-[#D3E9FC] bg-[#EAF4FF]/70 px-3 py-2.5 dark:border-white/10 dark:bg-slate-800/50">
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
                      tyreStatusClasses(status, palette).dot,
                    )}
                  />
                  <span className="text-xs font-semibold text-[#113C69] dark:text-slate-100">
                    {tyreStatusLabel(status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[12px] border border-[#D3E9FC] bg-[#EAF4FF]/70 px-3 py-2.5 dark:border-white/10 dark:bg-slate-800/50">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
              Additional condition
            </p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full bg-yellow-400" />
                <span className="text-xs font-semibold text-[#113C69] dark:text-slate-100">Dirty</span>
              </li>
              <li className="flex items-center gap-2.5">
                <TriangleAlert
                  className="size-3.5 shrink-0 text-rose-600"
                  aria-hidden
                />
                <span className="text-xs font-semibold text-[#113C69] dark:text-slate-100">Defect</span>
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
  emphasizeSelection = false,
  palette = 'vivid',
  vehicleUnitTitle = 'Truck · top view',
}: TyreCheckDiagramProps) {
  return (
    <div className="space-y-4">
      <TyreCheckLegends palette={palette} />
      <UnitDiagram
        unit="vehicle"
        title={vehicleUnitTitle}
        measurements={measurements}
        selectedTyreId={selectedTyreId}
        onSelectTyre={onSelectTyre}
        emphasizeSelection={emphasizeSelection}
        palette={palette}
      />
      <UnitDiagram
        unit="trailer"
        title="Trailer · top view"
        measurements={measurements}
        selectedTyreId={selectedTyreId}
        onSelectTyre={onSelectTyre}
        emphasizeSelection={emphasizeSelection}
        palette={palette}
      />
    </div>
  )
}
