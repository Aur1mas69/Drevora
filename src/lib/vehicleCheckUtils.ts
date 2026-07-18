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

export function getVehicleCheckTemplateGuidance(
  item: Pick<VehicleCheckItemInput, 'templateItem' | 'description'>,
): string | null {
  const fromTemplate = item.templateItem?.description?.trim()
  if (fromTemplate) return fromTemplate

  const fromItem = item.description?.trim()
  return fromItem || null
}

export function getVehicleCheckItemKey(
  item: Pick<VehicleCheckItemInput, 'category' | 'itemName'>,
): string {
  return `${item.category}-${item.itemName}`
}

export function isVehicleCheckItemAnswered(item: VehicleCheckItemInput): boolean {
  return item.isAnswered === true
}

export function buildExpectedChecklistItems(
  items: VehicleCheckItemInput[],
  sections?: VehicleChecklistSection[],
): VehicleCheckItemInput[] {
  if (sections && sections.length > 0) {
    return sections.flatMap(({ section, itemNames }) =>
      itemNames.map((itemName) => {
        return (
          items.find((entry) => entry.category === section && entry.itemName === itemName) ?? {
            category: section,
            itemName,
            result: 'Pass' as VehicleCheckItemResult,
            comment: '',
            isAnswered: false,
          }
        )
      }),
    )
  }

  return items
}

export function getChecklistAnswerProgress(
  items: VehicleCheckItemInput[],
  sections?: VehicleChecklistSection[],
): { answeredCount: number; totalCount: number } {
  const expectedItems = buildExpectedChecklistItems(items, sections)
  const answeredCount = expectedItems.filter(isVehicleCheckItemAnswered).length

  return {
    answeredCount,
    totalCount: expectedItems.length,
  }
}

export function getUnansweredChecklistItemKeys(
  items: VehicleCheckItemInput[],
  sections?: VehicleChecklistSection[],
): Set<string> {
  return new Set(
    buildExpectedChecklistItems(items, sections)
      .filter((item) => !isVehicleCheckItemAnswered(item))
      .map(getVehicleCheckItemKey),
  )
}

export function isChecklistFullyAnswered(
  items: VehicleCheckItemInput[],
  sections?: VehicleChecklistSection[],
): boolean {
  const { answeredCount, totalCount } = getChecklistAnswerProgress(items, sections)
  return totalCount > 0 && answeredCount === totalCount
}

export function enrichVehicleCheckItemsWithTemplates(
  items: VehicleCheckItem[],
  templates: VehicleCheckTemplateItem[],
): VehicleCheckItem[] {
  return items.map((item) => {
    const template = templates.find(
      (entry) => entry.section === item.category && entry.label === item.itemName,
    )
    const templateItem = template
      ? {
          description: template.description,
          allowNotes: template.allowNotes,
          allowPhoto: template.allowPhoto,
          failOnDefect: template.failOnDefect,
        }
      : null

    return {
      ...item,
      templateItem,
      description: null,
      allowNotes: template?.allowNotes ?? item.allowNotes,
      allowPhoto: template?.allowPhoto ?? item.allowPhoto,
      failOnDefect: template?.failOnDefect ?? item.failOnDefect,
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
      isAnswered: false,
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
      photoUrl: match?.photoUrl ?? null,
      photoFile: match?.photoFile ?? null,
      photoPreviewUrl: match?.photoPreviewUrl ?? null,
      templateItem,
      isAnswered: Boolean(match),
      allowNotes: template.allowNotes,
      allowPhoto: template.allowPhoto,
      failOnDefect: template.failOnDefect,
    }
  })
}

export function computeOverallResult(
  items: Pick<VehicleCheckItemInput, 'result' | 'isAnswered'>[],
): VehicleCheckResult {
  const answeredItems = items.filter((item) => item.isAnswered === true)
  // Defect (Advisory) drives overall result. N/A is stored as Fail and does not fail the inspection.
  if (answeredItems.some((item) => item.result === 'Advisory')) return 'Advisory'
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
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60'
    case 'In Progress':
      return 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60'
    case 'Pending':
      return 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60'
  }

  return 'bg-slate-50 text-slate-700 ring-slate-100 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10'
}

export function getResultBadgeClass(result: VehicleCheckResult): string {
  switch (result) {
    case 'Pass':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60'
    case 'Advisory':
      return 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60'
    case 'Fail':
      return 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60'
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
