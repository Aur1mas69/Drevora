import { TyreCheckDiagram } from '@/components/vehicle-checks/TyreCheckDiagram'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminHeading,
  adminPanel,
  adminSelect,
  adminTableEntityName,
  adminTableFooter,
  adminTableHeader,
  adminTableRow,
  adminTableShell,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import {
  attentionTyres,
  buildTyreLayout,
  formatTyreSummaryLabel,
  summarizeTyreMeasurements,
  treadDepthToStatus,
  tyreStatusClasses,
  tyreStatusLabel,
  type SavedTyreCheck,
  type TyreMeasurement,
} from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { Camera, StickyNote } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type TyreCheckPanelProps = {
  vehicles: Vehicle[]
  drivers: Driver[]
}

function vehicleLabel(vehicle: Vehicle): string {
  return (
    vehicle.registration?.trim() ||
    vehicle.fleetNumber?.trim() ||
    vehicle.id.slice(0, 8)
  )
}

function isTrailerVehicle(vehicle: Vehicle): boolean {
  const type = vehicle.vehicleType?.toLowerCase() ?? ''
  return type.includes('trailer') || type.includes('low loader')
}

export function TyreCheckPanel({ vehicles, drivers }: TyreCheckPanelProps) {
  const tractorVehicles = useMemo(
    () => vehicles.filter((vehicle) => !isTrailerVehicle(vehicle)),
    [vehicles],
  )
  const trailerVehicles = useMemo(
    () => vehicles.filter((vehicle) => isTrailerVehicle(vehicle)),
    [vehicles],
  )

  const [vehicleId, setVehicleId] = useState('')
  const [trailerId, setTrailerId] = useState('')
  const [axleCount, setAxleCount] = useState(3)
  const [checkedAt, setCheckedAt] = useState(() => toLocalDateTimeValue(new Date()))
  const [checkedById, setCheckedById] = useState('')
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [measurements, setMeasurements] = useState<TyreMeasurement[]>(() =>
    buildTyreLayout(3, false),
  )
  const [selectedTyreId, setSelectedTyreId] = useState<string | null>(null)
  const [recentChecks, setRecentChecks] = useState<SavedTyreCheck[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [viewingCheck, setViewingCheck] = useState<SavedTyreCheck | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const tyreEditorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMeasurements((current) => {
      const next = buildTyreLayout(axleCount, Boolean(trailerId))
      return next.map((tyre) => {
        const previous = current.find((item) => item.id === tyre.id)
        if (!previous) return tyre
        return {
          ...tyre,
          treadDepthMm: previous.treadDepthMm,
          status: previous.status,
        }
      })
    })
  }, [axleCount, trailerId])

  useEffect(() => {
    if (!selectedTyreId) return
    tyreEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedTyreId])

  const summary = useMemo(
    () => summarizeTyreMeasurements(measurements),
    [measurements],
  )
  const criticalList = useMemo(() => attentionTyres(measurements), [measurements])
  const selectedTyre =
    measurements.find((tyre) => tyre.id === selectedTyreId) ?? null

  function showToast(message: string) {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }

  function updateTyre(
    tyreId: string,
    patch: { treadDepthMm?: number | null; dirty?: boolean },
  ) {
    setMeasurements((current) =>
      current.map((tyre) => {
        if (tyre.id !== tyreId) return tyre
        const nextDepth =
          patch.treadDepthMm !== undefined ? patch.treadDepthMm : tyre.treadDepthMm
        const dirty =
          patch.dirty !== undefined ? patch.dirty : tyre.status === 'dirty'
        return {
          ...tyre,
          treadDepthMm: nextDepth,
          status: treadDepthToStatus(nextDepth, dirty),
        }
      }),
    )
  }

  function handleSave() {
    const vehicle = tractorVehicles.find((item) => item.id === vehicleId)
    if (!vehicle) {
      showToast('Select a vehicle before saving')
      return
    }

    const trailer = trailerVehicles.find((item) => item.id === trailerId) ?? null
    const checker = drivers.find((item) => item.id === checkedById)
    const checkedBy =
      checker
        ? `${checker.firstName} ${checker.lastName}`.trim()
        : 'Office user'

    const saved: SavedTyreCheck = {
      id: crypto.randomUUID(),
      checkedAt: new Date(checkedAt).toISOString(),
      vehicleId: vehicle.id,
      vehicleLabel: vehicleLabel(vehicle),
      trailerId: trailer?.id ?? null,
      trailerLabel: trailer ? vehicleLabel(trailer) : null,
      checkedBy,
      axleCount,
      summaryLabel: formatTyreSummaryLabel(summary),
      notes: notes.trim(),
      photoCount: photoFiles.length,
      measurements: measurements.map((tyre) => ({ ...tyre })),
    }

    setRecentChecks((current) => [saved, ...current])
    showToast('Tyre check saved')
  }

  function handleViewCritical(tyreId: string) {
    setSelectedTyreId(tyreId)
  }

  function handleViewRecent(check: SavedTyreCheck) {
    setViewingCheck(check)
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className={`text-2xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
          Tyre Check
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Inspect truck and trailer tyres. Vehicle walkaround checks stay on the
          Vehicle Checks tab.
        </p>
      </header>

      <section className={`${adminPanel} grid gap-3 p-4 lg:grid-cols-4`}>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Vehicle
          </span>
          <select
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            className={adminSelect}
          >
            <option value="">Select vehicle</option>
            {tractorVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
                {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Trailer (optional)
          </span>
          <select
            value={trailerId}
            onChange={(event) => setTrailerId(event.target.value)}
            className={adminSelect}
          >
            <option value="">No trailer</option>
            {trailerVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Axle count
          </span>
          <select
            value={axleCount}
            onChange={(event) => setAxleCount(Number(event.target.value))}
            className={adminSelect}
          >
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count} axle{count === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Check date / time
          </span>
          <Input
            type="datetime-local"
            value={checkedAt}
            onChange={(event) => setCheckedAt(event.target.value)}
            className="h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-white"
          />
        </label>

        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
            Checked by
          </span>
          <select
            value={checkedById}
            onChange={(event) => setCheckedById(event.target.value)}
            className={adminSelect}
          >
            <option value="">Select worker</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.firstName} {driver.lastName}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
        <section className={`${adminPanel} p-4`}>
          <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Truck + Trailer diagram
          </h2>
          <p className={`mt-1 text-sm ${adminTextMuted}`}>
            Tap a tyre to enter tread depth or mark it dirty.
          </p>
          <div className="mt-4">
            <TyreCheckDiagram
              measurements={measurements}
              selectedTyreId={selectedTyreId}
              onSelectTyre={setSelectedTyreId}
            />
          </div>

          {selectedTyre ? (
            <div
              ref={tyreEditorRef}
              className="mt-4 rounded-[16px] border border-[#D3E9FC] bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-[#2A376F]">
                {selectedTyre.axleLabel} · {selectedTyre.position}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
                    Tread depth (mm)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={selectedTyre.treadDepthMm ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      updateTyre(selectedTyre.id, {
                        treadDepthMm: raw === '' ? null : Number(raw),
                        dirty: false,
                      })
                    }}
                    className="h-11 rounded-[12px]"
                    placeholder="e.g. 6.8"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-[12px]"
                    onClick={() =>
                      updateTyre(selectedTyre.id, {
                        dirty: selectedTyre.status !== 'dirty',
                        treadDepthMm: selectedTyre.treadDepthMm,
                      })
                    }
                  >
                    {selectedTyre.status === 'dirty' ? 'Clear dirty' : 'Mark dirty'}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Green ≥ 3.0 mm · Amber 2.0–2.9 mm · Red &lt; 2.0 mm · Yellow Dirty · Grey
                Not checked
              </p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className={`${adminPanel} p-4`}>
            <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
              Tyre Check Summary
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SummaryMetric label="Good" value={summary.good} tone="good" />
              <SummaryMetric label="Attention" value={summary.attention} tone="attention" />
              <SummaryMetric label="Critical" value={summary.critical} tone="critical" />
              <SummaryMetric label="Dirty" value={summary.dirty} tone="dirty" />
              <SummaryMetric
                label="Not Checked"
                value={summary.notChecked}
                tone="not_checked"
                className="col-span-2"
              />
            </div>
          </section>

          <section className={`${adminPanel} p-4`}>
            <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
              Critical Tyres
            </h2>
            <p className={`mt-1 text-sm ${adminTextMuted}`}>
              Tyres needing attention, critical depth, or marked dirty.
            </p>
            <div className="mt-3 space-y-2">
              {criticalList.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-[#D3E9FC] bg-[#F8FBFF] px-4 py-6 text-center text-sm text-slate-500">
                  No tyres currently require attention.
                </div>
              ) : (
                criticalList.map((tyre) => {
                  const colours = tyreStatusClasses(tyre.status)
                  return (
                    <div
                      key={tyre.id}
                      className="flex items-center justify-between gap-3 rounded-[14px] border border-[#D3E9FC] bg-white px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#2A376F]">
                          {tyre.axleLabel}
                        </p>
                        <p className="text-sm text-slate-600">{tyre.position}</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-[#113C69]">
                          {tyre.treadDepthMm == null
                            ? '—'
                            : `${tyre.treadDepthMm.toFixed(1)} mm`}
                          <span
                            className={cn(
                              'ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              colours.badge,
                            )}
                          >
                            {tyreStatusLabel(tyre.status)}
                          </span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 shrink-0 rounded-[10px]"
                        onClick={() => handleViewCritical(tyre.id)}
                      >
                        View
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </aside>
      </div>

      {showNotes ? (
        <section className={`${adminPanel} p-4`}>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5499BF]">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Add inspection notes…"
              className="w-full rounded-[14px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </section>
      ) : null}

      <section className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-[12px]"
          onClick={() => setShowNotes((open) => !open)}
        >
          <StickyNote className="size-4" />
          Add Notes
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-[12px]"
          onClick={() => photoInputRef.current?.click()}
        >
          <Camera className="size-4" />
          Upload Photos
          {photoFiles.length > 0 ? ` (${photoFiles.length})` : ''}
        </Button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            setPhotoFiles(files)
            if (files.length > 0) {
              showToast(`${files.length} photo${files.length === 1 ? '' : 's'} attached`)
            }
          }}
        />
        <Button
          type="button"
          className="h-11 rounded-[12px] bg-[#218EE7] px-5 font-semibold text-white hover:bg-[#1B7BC7]"
          onClick={handleSave}
        >
          Save Tyre Check
        </Button>
      </section>

      <section className={adminTableShell}>
        <div className="border-b border-[rgba(75,120,220,0.10)] px-4 py-3">
          <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Recent Tyre Checks
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className={adminTableHeader}>
              <tr>
                {['Date', 'Vehicle', 'Trailer', 'Checked by', 'Axles', 'Summary', 'Actions'].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.07em] text-[#0D477F]"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {recentChecks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No tyre checks saved in this session yet.
                  </td>
                </tr>
              ) : (
                recentChecks.map((check) => (
                  <tr key={check.id} className={adminTableRow}>
                    <td className="px-4 py-3 text-slate-600">
                      {formatCheckedAt(check.checkedAt)}
                    </td>
                    <td className={`px-4 py-3 ${adminTableEntityName}`}>
                      {check.vehicleLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {check.trailerLabel ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{check.checkedBy}</td>
                    <td className="px-4 py-3 text-slate-600">{check.axleCount}</td>
                    <td className="px-4 py-3 text-slate-600">{check.summaryLabel}</td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-[10px] px-3 text-xs"
                        onClick={() => handleViewRecent(check)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className={`${adminTableFooter} px-4 py-3 text-xs text-slate-500`}>
          Session list for this Office page. Durable archive storage can be added next.
        </div>
      </section>

      <div className="rounded-[16px] border border-[#BFE3F5] bg-[#EAF4FF] px-4 py-3 text-sm text-[#2A376F]">
        All tyre inspections are securely archived for 24 months. This page is only
        for tyre inspections. Vehicle inspection remains a separate tab inside Vehicle
        Checks.
      </div>

      {viewingCheck ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[1px]">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={`text-lg font-semibold ${adminHeading}`}>
                  Saved tyre check
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatCheckedAt(viewingCheck.checkedAt)} · {viewingCheck.vehicleLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-[10px]"
                onClick={() => setViewingCheck(null)}
              >
                Close
              </Button>
            </div>
            <p className="mt-3 text-sm text-slate-600">{viewingCheck.summaryLabel}</p>
            {viewingCheck.notes ? (
              <p className="mt-2 rounded-[12px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
                {viewingCheck.notes}
              </p>
            ) : null}
            <div className="mt-4 space-y-2">
              {attentionTyres(viewingCheck.measurements).map((tyre) => (
                <div
                  key={tyre.id}
                  className="rounded-[12px] border border-[#D3E9FC] px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-[#2A376F]">
                    {tyre.axleLabel} · {tyre.position}
                  </p>
                  <p className="text-slate-600">
                    {tyre.treadDepthMm == null
                      ? '—'
                      : `${tyre.treadDepthMm.toFixed(1)} mm`}{' '}
                    · {tyreStatusLabel(tyre.status)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[70] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  tone,
  className,
}: {
  label: string
  value: number
  tone: Parameters<typeof tyreStatusClasses>[0]
  className?: string
}) {
  const colours = tyreStatusClasses(tone)
  return (
    <div
      className={cn(
        'rounded-[14px] border px-3 py-3',
        colours.tile,
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#2A376F]">{value}</p>
    </div>
  )
}

function toLocalDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatCheckedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
