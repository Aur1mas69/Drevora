import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import type {
  VehicleCheckItem,
  VehicleCheckItemInput,
  VehicleCheckItemResult,
  VehicleCheckListItem,
  VehicleCheckResult,
  VehicleCheckSummaryStats,
  VehicleChecklistSection,
} from '@/lib/vehicleCheckTypes'

type VehicleCheckItemDescriptionSource = {
  description?: string | null
  templateItem?: { description?: string | null } | null
}

export function resolveVehicleCheckItemDescription(
  item: VehicleCheckItemDescriptionSource,
): string | null {
  const fromItem = item.description?.trim()
  if (fromItem) return fromItem

  const fromTemplate = item.templateItem?.description?.trim()
  return fromTemplate || null
}

export function enrichVehicleCheckItemsWithTemplates(
  items: VehicleCheckItem[],
  templates: VehicleCheckTemplateItem[],
): VehicleCheckItem[] {
  return items.map((item) => {
    const template = templates.find(
      (entry) => entry.section === item.category && entry.label === item.itemName,
    )
    const templateItem = template ? { description: template.description } : null

    return {
      ...item,
      templateItem,
      description: resolveVehicleCheckItemDescription({
        description: null,
        templateItem,
      }),
    }
  })
}

export function createChecklistItemsFromTemplates(
  templates: VehicleCheckTemplateItem[],
): VehicleCheckItemInput[] {
  return templates.map((template) => {
    const templateItem = { description: template.description }

    return {
      category: template.section,
      itemName: template.label,
      result: 'Pass' as VehicleCheckItemResult,
      comment: '',
      templateItem,
      description: resolveVehicleCheckItemDescription({
        description: null,
        templateItem,
      }),
      allowNotes: template.allowNotes,
      allowPhoto: template.allowPhoto,
      failOnDefect: template.failOnDefect,
    }
  })
}

export function groupTemplatesBySection(
  templates: VehicleCheckTemplateItem[],
): VehicleChecklistSection[] {
  const order: string[] = []
  const map = new Map<string, string[]>()

  for (const template of templates) {
    if (!map.has(template.section)) {
      order.push(template.section)
      map.set(template.section, [])
    }
    map.get(template.section)?.push(template.label)
  }

  return order.map((section) => ({
    section,
    itemNames: map.get(section) ?? [],
  }))
}

export function mergeChecklistWithExistingItems(
  templates: VehicleCheckTemplateItem[],
  existing: VehicleCheckItemInput[],
): VehicleCheckItemInput[] {
  return templates.map((template) => {
    const match = existing.find(
      (item) =>
        item.category === template.section && item.itemName === template.label,
    )

    const templateItem = { description: template.description }

    return {
      category: template.section,
      itemName: template.label,
      result: match?.result ?? ('Pass' as VehicleCheckItemResult),
      comment: match?.comment ?? '',
      photoUrl: match?.photoUrl,
      templateItem,
      description: resolveVehicleCheckItemDescription({
        description: null,
        templateItem,
      }),
      allowNotes: template.allowNotes,
      allowPhoto: template.allowPhoto,
      failOnDefect: template.failOnDefect,
    }
  })
}

export function computeOverallResult(items: Pick<VehicleCheckItemInput, 'result'>[]): VehicleCheckResult {
  if (items.some((item) => item.result === 'Fail')) return 'Fail'
  if (items.some((item) => item.result === 'Advisory')) return 'Advisory'
  return 'Pass'
}

function normalizeVehicleCheckItemResults(
  itemResults: { result: string }[] | { result: string } | null | undefined,
): { result: string }[] {
  if (!itemResults) return []
  return Array.isArray(itemResults) ? itemResults : [itemResults]
}

export function vehicleCheckHasIssue(
  overallResult: string,
  itemResults: { result: string }[] | { result: string } | null | undefined,
): boolean {
  const items = normalizeVehicleCheckItemResults(itemResults)

  return (
    overallResult === 'Fail' ||
    overallResult === 'Advisory' ||
    items.some((item) => item.result === 'Fail' || item.result === 'Advisory')
  )
}

export type VehicleCheckActivitySeverity = 'success' | 'warning' | 'danger'

export function getVehicleCheckActivitySeverity(
  overallResult: string,
  itemResults: { result: string }[] | { result: string } | null | undefined,
): VehicleCheckActivitySeverity {
  const items = normalizeVehicleCheckItemResults(itemResults)

  const hasFail =
    overallResult === 'Fail' || items.some((item) => item.result === 'Fail')
  if (hasFail) return 'danger'

  const hasAdvisory =
    overallResult === 'Advisory' ||
    items.some((item) => item.result === 'Advisory')
  if (hasAdvisory) return 'warning'

  return 'success'
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getStatusBadgeClass(status: VehicleCheckListItem['status']): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'In Progress':
      return 'bg-blue-50 text-blue-700 ring-blue-100'
    case 'Pending':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
  }
}

export function getResultBadgeClass(result: VehicleCheckResult): string {
  switch (result) {
    case 'Pass':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'Advisory':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'Fail':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
  }
}

export function formatVehicleCheckResultLabel(result: VehicleCheckResult): string {
  switch (result) {
    case 'Pass':
      return 'Passed'
    case 'Advisory':
      return 'Defects'
    case 'Fail':
      return 'Failed'
  }
}

export function getItemResultBadgeClass(result: VehicleCheckItemResult): string {
  return getResultBadgeClass(result)
}

export function computeVehicleCheckSummaryStats(
  checks: Pick<VehicleCheckListItem, 'inspectionDate' | 'overallResult' | 'vehicleId'>[],
  defectItemCount: number,
): VehicleCheckSummaryStats {
  const today = todayIsoDate()
  const todayChecks = checks.filter((check) => check.inspectionDate === today)
  const checksToday = todayChecks.length
  const passedToday = todayChecks.filter((check) => check.overallResult === 'Pass').length
  const failedToday = todayChecks.filter((check) => check.overallResult === 'Fail').length
  const vehiclesChecked = new Set(
    todayChecks.map((check) => check.vehicleId),
  ).size
  const failedInspections = checks.filter((check) => check.overallResult === 'Fail').length

  return {
    totalChecks: checks.length,
    checksToday,
    passedToday,
    failedToday,
    defectsReported: defectItemCount,
    vehiclesChecked,
    openDefects: defectItemCount,
    failedInspections,
  }
}

// TODO: Vehicle checks retention: keep records for 24 months.
