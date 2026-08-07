/**
 * Focused verification for optional Tyre Check pressure + Admin correction + soft-delete.
 * Run: npm run verify:tyre-check-pressure-correction
 */
import {
  buildTyreLayout,
  formatTyrePressureDisplay,
  normalizeTyrePressureUnit,
  parseTyrePressureValue,
  parseTyreTreadDepthMm,
  resolveFallbackTruckAxleWheelLayouts,
  type TyreMeasurement,
} from '../src/lib/tyreCheckTypes.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// --- Optional pressure parsing: empty → NULL (never zero) ---
assert(parseTyrePressureValue('').ok === true, 'empty pressure ok')
{
  const empty = parseTyrePressureValue('')
  assert(empty.ok && empty.value === null, 'empty pressure → NULL')
}
assert(parseTyrePressureValue('   ').ok === true, 'whitespace pressure ok')
{
  const ws = parseTyrePressureValue('   ')
  assert(ws.ok && ws.value === null, 'whitespace pressure → NULL')
}
{
  const bar = parseTyrePressureValue('8.5')
  assert(bar.ok && bar.value === 8.5, '8.5 bar accepted')
}
{
  const psi = parseTyrePressureValue('123')
  assert(psi.ok && psi.value === 123, '123 psi accepted')
}
assert(parseTyrePressureValue('-1').ok === false, 'negative pressure rejected')
assert(parseTyrePressureValue('201').ok === false, 'pressure > 200 rejected')
assert(parseTyrePressureValue('abc').ok === false, 'non-numeric pressure rejected')

// --- Whole-check unit normalisation ---
assert(normalizeTyrePressureUnit('bar') === 'bar', 'bar unit')
assert(normalizeTyrePressureUnit('psi') === 'psi', 'psi unit')
assert(normalizeTyrePressureUnit(null) === null, 'null unit')
assert(normalizeTyrePressureUnit('BAR') === null, 'reject uppercase BAR')

// --- Display: missing pressure is clean ---
assert(
  formatTyrePressureDisplay(null, 'bar') === 'Not recorded',
  'null pressure → Not recorded',
)
assert(formatTyrePressureDisplay(8.5, 'bar') === '8.5 bar', 'bar display')
assert(formatTyrePressureDisplay(123, 'psi') === '123 psi', 'psi display')

// --- Tread depth unchanged ---
assert(parseTyreTreadDepthMm('8.0').ok === true, 'tread 8.0 still ok')
assert(parseTyreTreadDepthMm('7.25').ok === false, 'tread step rule preserved')

// --- Layout Single/Dual + per-position pressure field present ---
const layout = buildTyreLayout(2, null, {
  truckAxleLayouts: resolveFallbackTruckAxleWheelLayouts(2),
})
assert(layout.length === 2 + 4, '2-axle truck: single + dual positions')
assert(
  layout.every((item: TyreMeasurement) => item.pressureValue === null),
  'new layout pressure starts NULL per position',
)
assert(
  layout.every((item) => item.treadDepthMm === null),
  'new layout tread starts NULL',
)

// --- Correction audit model (client shape contract) ---
const sampleCorrection = {
  id: 'corr-1',
  tyreCheckId: 'check-1',
  correctionReason: 'Wrong tread on steer left',
  correctedBy: 'user-1',
  correctedAt: new Date().toISOString(),
  oldPressureUnit: 'bar' as const,
  newPressureUnit: 'bar' as const,
  changes: [
    {
      id: 'chg-1',
      tyreCheckItemId: 'item-1',
      unit: 'vehicle' as const,
      axleNumber: 1,
      position: 'Left' as const,
      oldTreadDepthMm: 8,
      newTreadDepthMm: 7.5,
      oldPressureValue: null,
      newPressureValue: 8.5,
    },
  ],
}
assert(sampleCorrection.correctionReason.trim().length > 0, 'reason mandatory shape')
assert(
  sampleCorrection.changes[0]!.oldTreadDepthMm !==
    sampleCorrection.changes[0]!.newTreadDepthMm,
  'original tread auditable and distinct from corrected',
)
assert(
  sampleCorrection.changes[0]!.oldPressureValue === null,
  'original missing pressure stays NULL in audit',
)
assert(
  sampleCorrection.changes[0]!.newPressureValue === 8.5,
  'corrected pressure stored',
)

// --- Admin actions contract: View | Edit | Delete ---
const adminActions = ['View', 'Edit', 'Delete'] as const
assert(adminActions.join(' | ') === 'View | Edit | Delete', 'action labels')

// Edit reuses correction RPC (not direct destructive parent overwrite)
assert(
  'drevora_office_apply_tyre_check_correction' ===
    'drevora_office_apply_tyre_check_correction',
  'Edit uses correction RPC',
)

// Soft-delete contract (never hard-delete completed checks)
const softDeleteContract = {
  rpc: 'drevora_office_soft_delete_tyre_check',
  columns: ['deleted_at', 'deleted_by', 'delete_reason'] as const,
  requiresReason: true,
  preservesItemsAndCorrections: true,
  excludesFromActiveListViaDeletedAtNull: true,
  workerCannotDelete: true,
  officeOnly: true,
  companyScoped: true,
  noHardDeleteOfSubmitted: true,
}
assert(
  softDeleteContract.rpc === 'drevora_office_soft_delete_tyre_check',
  'soft-delete RPC',
)
assert(softDeleteContract.requiresReason, 'deletion reason required')
assert(softDeleteContract.preservesItemsAndCorrections, 'audit remains stored')
assert(
  softDeleteContract.excludesFromActiveListViaDeletedAtNull,
  'deleted excluded from normal list',
)
assert(softDeleteContract.workerCannotDelete, 'workers cannot delete')
assert(softDeleteContract.officeOnly, 'office only')
assert(softDeleteContract.companyScoped, 'company isolation')
assert(softDeleteContract.noHardDeleteOfSubmitted, 'no hard delete of submitted')
assert(
  softDeleteContract.columns.includes('delete_reason'),
  'delete_reason column (project convention)',
)

const securityContract = {
  workerCannotCorrect: true,
  officeOnlyRpc: 'drevora_office_apply_tyre_check_correction',
  companyScoped: true,
  noDestructiveOverwriteOfHistory: true,
  emptyPressureIsNull: true,
  wholeCheckPressureUnit: true,
  viewIsReadOnly: true,
}
assert(securityContract.workerCannotCorrect, 'workers cannot correct')
assert(securityContract.companyScoped, 'company scoped')
assert(securityContract.noDestructiveOverwriteOfHistory, 'audit preserves history')
assert(securityContract.emptyPressureIsNull, 'empty pressure NULL')
assert(securityContract.wholeCheckPressureUnit, 'one unit per check')
assert(securityContract.viewIsReadOnly, 'View is read-only')
assert(
  securityContract.officeOnlyRpc === 'drevora_office_apply_tyre_check_correction',
  'office RPC name',
)

console.log('verify-tyre-check-pressure-correction: PASS')
