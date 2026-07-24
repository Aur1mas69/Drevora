import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import type {
  VehicleCheckDefectReviewStatus,
  VehicleCheckItem,
  VehicleCheckItemInput,
  VehicleCheckItemResult,
  VehicleCheckListItem,
  VehicleCheckResult,
  VehicleCheckSummaryStats,
  VehicleChecklistSection,
} from '@/lib/vehicleCheckTypes'

/** Defect answers are stored as Advisory. N/A is stored as Fail and must never count as a defect. */
export function isVehicleCheckDefectResult(result: string | null | undefined): boolean {
  return result === 'Advisory'
}

/** Pending / In Progress and unsigned — Office (and Worker where allowed) may edit. */
export function isVehicleCheckEditable(
  check: Pick<VehicleCheckListItem, 'status' | 'signedAt'>,
): boolean {
  return (
    (check.status === 'Pending' || check.status === 'In Progress') && !check.signedAt
  )
}

/** Completed or signed — inspection record is immutable; use a correction to amend. */
export function isVehicleCheckFinal(
  check: Pick<VehicleCheckListItem, 'status' | 'signedAt'>,
): boolean {
  return check.status === 'Completed' || Boolean(check.signedAt)
}

/** Compact display reference for an inspection id (first 8 chars). */
export function formatVehicleCheckReference(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

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

/**
 * Canonical inspection result from saved checklist answers.
 * - zero Defect (Advisory) answers → Pass ("Passed")
 * - one or more Defect answers → Advisory ("Defects found")
 * N/A (Fail) never changes the inspection result.
 */
export function computeOverallResult(
  items: Pick<VehicleCheckItemInput, 'result' | 'isAnswered'>[],
): VehicleCheckResult {
  const hasAnswerFlags = items.some((item) => item.isAnswered !== undefined)
  const considered = hasAnswerFlags
    ? items.filter((item) => item.isAnswered === true)
    : items
  if (considered.some((item) => isVehicleCheckDefectResult(item.result))) {
    return 'Advisory'
  }
  return 'Pass'
}

export function countDefectAnswers(
  items: Pick<{ result: string }, 'result'>[],
): number {
  return items.filter((item) => isVehicleCheckDefectResult(item.result)).length
}

export function resolveInspectionResult(
  overallResult: string | null | undefined,
  defectCount: number,
): VehicleCheckResult {
  if (defectCount > 0) return 'Advisory'
  if (overallResult === 'Advisory') return 'Advisory'
  return 'Pass'
}

export function defaultDefectReviewStatus(
  defectCount: number,
): VehicleCheckDefectReviewStatus | null {
  return defectCount > 0 ? 'awaiting_review' : null
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
    overallResult === 'Advisory' ||
    items.some((item) => isVehicleCheckDefectResult(item.result))
  )
}

export type VehicleCheckActivitySeverity = 'success' | 'warning' | 'danger'

export function getVehicleCheckActivitySeverity(
  overallResult: string,
  itemResults: { result: string }[] | { result: string } | null | undefined,
): VehicleCheckActivitySeverity {
  if (vehicleCheckHasIssue(overallResult, itemResults)) return 'warning'
  return 'success'
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Shared Vehicle Checks semantic badge colours.
 * Same meaning → same colour across table, drawer, KPIs, and checklist displays.
 */
export const vehicleCheckSemanticBadge = {
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  urgent:
    'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
  active:
    'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60',
  neutral:
    'bg-slate-50 text-slate-600 ring-slate-100 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  correction:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
} as const

export const vehicleCheckCorrectionLinkClassName =
  'text-violet-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 dark:text-violet-300 dark:focus-visible:ring-violet-700'

export const vehicleCheckDefectCountTextClassName =
  'font-semibold text-amber-700 dark:text-amber-300'

export const vehicleCheckNeutralTextClassName =
  'text-slate-500 dark:text-slate-400'

export function getStatusBadgeClass(status: VehicleCheckListItem['status']): string {
  switch (status) {
    case 'Completed':
      return vehicleCheckSemanticBadge.success
    case 'In Progress':
      return vehicleCheckSemanticBadge.active
    case 'Pending':
      return vehicleCheckSemanticBadge.neutral
  }

  return vehicleCheckSemanticBadge.neutral
}

export function getResultBadgeClass(result: VehicleCheckResult): string {
  switch (result) {
    case 'Pass':
      return vehicleCheckSemanticBadge.success
    case 'Advisory':
      // Historical "Defects found" stays amber even after review is Resolved.
      return vehicleCheckSemanticBadge.warning
    case 'Fail':
      // Legacy overall_result labelled as "Defects found" — warning, not urgent.
      return vehicleCheckSemanticBadge.warning
  }
}

export function formatVehicleCheckResultLabel(result: VehicleCheckResult): string {
  switch (result) {
    case 'Pass':
      return 'Passed'
    case 'Advisory':
      return 'Defects found'
    case 'Fail':
      // Legacy overall_result only — new inspections never store Fail as overall.
      return 'Defects found'
  }
}

export function formatVehicleCheckItemResultLabel(result: VehicleCheckItemResult): string {
  switch (result) {
    case 'Pass':
      return 'OK'
    case 'Advisory':
      return 'Defect'
    case 'Fail':
      return 'N/A'
  }
}

export function getItemResultBadgeClass(result: VehicleCheckItemResult): string {
  switch (result) {
    case 'Pass':
      return vehicleCheckSemanticBadge.success
    case 'Advisory':
      return vehicleCheckSemanticBadge.warning
    case 'Fail':
      // Item N/A — informational, not a defect or failure.
      return vehicleCheckSemanticBadge.neutral
  }
}

export function formatDefectReviewStatusLabel(
  status: VehicleCheckDefectReviewStatus | null | undefined,
  defectCount: number,
): string {
  if (defectCount <= 0 || !status) return 'No review needed'

  switch (status) {
    case 'awaiting_review':
      return 'Awaiting review'
    case 'safe_to_operate':
      return 'Safe to operate'
    case 'repair_required':
      return 'Repair required'
    case 'vehicle_off_road':
      return 'Vehicle off road'
    case 'resolved':
      return 'Resolved'
  }
}

export function getDefectReviewBadgeClass(
  status: VehicleCheckDefectReviewStatus | null | undefined,
  defectCount: number,
): string {
  if (defectCount <= 0 || !status) {
    return vehicleCheckSemanticBadge.neutral
  }

  switch (status) {
    case 'awaiting_review':
      return vehicleCheckSemanticBadge.urgent
    case 'safe_to_operate':
      return vehicleCheckSemanticBadge.success
    case 'repair_required':
      return vehicleCheckSemanticBadge.warning
    case 'vehicle_off_road':
      return vehicleCheckSemanticBadge.urgent
    case 'resolved':
      return vehicleCheckSemanticBadge.success
  }
}

export function getVehicleCheckCorrectionBadgeClassName(): string {
  return `inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.02em] ring-1 ${vehicleCheckSemanticBadge.correction}`
}

export function getVehicleCheckCorrectionAddedBadgeClassName(): string {
  return `inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.02em] ring-1 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 dark:hover:bg-amber-950/70 dark:focus-visible:ring-amber-700 ${vehicleCheckSemanticBadge.warning}`
}

export function getVehicleCheckCorrectionReferenceLinkClassName(): string {
  return `mt-0.5 block w-fit max-w-full text-left text-[11px] font-medium leading-4 ${vehicleCheckCorrectionLinkClassName}`
}

export function computeVehicleCheckSummaryStats(
  checks: Pick<
    VehicleCheckListItem,
    'inspectionDate' | 'overallResult' | 'defectCount' | 'defectReviewStatus'
  >[],
  defectItemCount: number,
): VehicleCheckSummaryStats {
  const today = todayIsoDate()
  const todayChecks = checks.filter((check) => check.inspectionDate === today)
  const checksToday = todayChecks.length
  const passedToday = todayChecks.filter(
    (check) => resolveInspectionResult(check.overallResult, check.defectCount) === 'Pass',
  ).length
  const defectsFoundToday = todayChecks.filter((check) => check.defectCount > 0).length
  const awaitingReview = checks.filter(
    (check) => check.defectCount > 0 && check.defectReviewStatus === 'awaiting_review',
  ).length

  return {
    totalChecks: checks.length,
    checksToday,
    passedToday,
    defectsFoundToday,
    awaitingReview,
    defectItemsReported: defectItemCount,
  }
}

// TODO: Vehicle checks retention: keep records for 24 months.
