import type { VehicleCheckTemplate } from '@/lib/vehicleCheckTemplateTypes'
import type {
  VehicleCheckItemInput,
  VehicleCheckItemResult,
  VehicleCheckListItem,
  VehicleCheckResult,
  VehicleCheckSummaryStats,
  VehicleChecklistSection,
} from '@/lib/vehicleCheckTypes'

export function createChecklistItemsFromTemplates(
  templates: VehicleCheckTemplate[],
): VehicleCheckItemInput[] {
  return templates.map((template) => ({
    category: template.section,
    itemName: template.itemName,
    result: 'Pass' as VehicleCheckItemResult,
    comment: '',
  }))
}

export function groupTemplatesBySection(
  templates: VehicleCheckTemplate[],
): VehicleChecklistSection[] {
  const order: string[] = []
  const map = new Map<string, string[]>()

  for (const template of templates) {
    if (!map.has(template.section)) {
      order.push(template.section)
      map.set(template.section, [])
    }
    map.get(template.section)?.push(template.itemName)
  }

  return order.map((section) => ({
    section,
    itemNames: map.get(section) ?? [],
  }))
}

export function mergeChecklistWithExistingItems(
  templates: VehicleCheckTemplate[],
  existing: VehicleCheckItemInput[],
): VehicleCheckItemInput[] {
  return templates.map((template) => {
    const match = existing.find(
      (item) =>
        item.category === template.section && item.itemName === template.itemName,
    )

    return {
      category: template.section,
      itemName: template.itemName,
      result: match?.result ?? ('Pass' as VehicleCheckItemResult),
      comment: match?.comment ?? '',
      photoUrl: match?.photoUrl,
    }
  })
}

export function computeOverallResult(items: Pick<VehicleCheckItemInput, 'result'>[]): VehicleCheckResult {
  if (items.some((item) => item.result === 'Fail')) return 'Fail'
  if (items.some((item) => item.result === 'Advisory')) return 'Advisory'
  return 'Pass'
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

export function getItemResultBadgeClass(result: VehicleCheckItemResult): string {
  return getResultBadgeClass(result)
}

export function computeVehicleCheckSummaryStats(
  checks: Pick<VehicleCheckListItem, 'inspectionDate' | 'overallResult' | 'vehicleId'>[],
  failItemCount: number,
): VehicleCheckSummaryStats {
  const today = todayIsoDate()
  const checksToday = checks.filter((check) => check.inspectionDate === today).length
  const vehiclesChecked = new Set(
    checks.filter((check) => check.inspectionDate === today).map((check) => check.vehicleId),
  ).size
  const failedInspections = checks.filter((check) => check.overallResult === 'Fail').length

  return {
    checksToday,
    openDefects: failItemCount,
    vehiclesChecked,
    failedInspections,
  }
}
