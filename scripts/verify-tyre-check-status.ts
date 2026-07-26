/**
 * Verifies Worker/Admin tread status helpers match DB drevora_tyre_tread_status,
 * plus per-axle wheel layout seeding (single/dual).
 * Run: npx tsx scripts/verify-tyre-check-status.ts
 */
import {
  buildTyreLayout,
  findExtraneousTyreMeasurements,
  parseTyreTreadDepthMm,
  positionsForWheelLayout,
  resolveFallbackTrailerAxleWheelLayouts,
  resolveFallbackTruckAxleWheelLayouts,
  treadDepthBand,
  treadDepthToStatus,
  tyreAxleTypeFor,
  tyrePositionToDb,
  validateTyreAxleCounts,
  type TyreMeasurement,
} from '../src/lib/tyreCheckTypes.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

assert(treadDepthBand(null) === 'not_checked', 'null → not_checked')
assert(treadDepthBand(6) === 'good', '6.0 → good')
assert(treadDepthBand(5.9) === 'attention', '5.9 → attention')
assert(treadDepthBand(4) === 'attention', '4.0 → attention')
assert(treadDepthBand(3.9) === 'critical', '3.9 → critical')
assert(treadDepthToStatus(7.5, true) === 'dirty', 'dirty overrides display status')
assert(treadDepthToStatus(7.5, false) === 'good', '7.5 clean → good')

assert(parseTyreTreadDepthMm('7.5').ok === true, '7.5 accepted')
assert(parseTyreTreadDepthMm('1.6').ok === true, '1.6 accepted')
assert(parseTyreTreadDepthMm('7.25').ok === false, '7.25 rejected')
assert(parseTyreTreadDepthMm('-1').ok === false, 'negative rejected')

assert(tyrePositionToDb('Outer Left') === 'outer_left', 'position map')
assert(tyreAxleTypeFor('vehicle', 1) === 'steer', 'steer axle')
assert(tyreAxleTypeFor('vehicle', 2) === 'drive', 'drive axle')
assert(tyreAxleTypeFor('trailer', 1) === 'trailer', 'trailer axle')
assert(validateTyreAxleCounts(3, 3) === null, '3+3 ok')
assert(validateTyreAxleCounts(4, 3) !== null, '4+3 blocked')

assert(
  JSON.stringify(resolveFallbackTruckAxleWheelLayouts(2)) ===
    JSON.stringify(['single', 'dual']),
  '2-axle truck fallback: single + dual',
)
assert(
  JSON.stringify(resolveFallbackTruckAxleWheelLayouts(3)) ===
    JSON.stringify(['single', 'dual', 'dual']),
  '3-axle truck fallback: single + dual + dual',
)
assert(
  JSON.stringify(resolveFallbackTrailerAxleWheelLayouts(2)) ===
    JSON.stringify(['dual', 'dual']),
  'trailer fallback stays dual and separate from truck',
)
assert(
  JSON.stringify(positionsForWheelLayout('single')) ===
    JSON.stringify(['Left', 'Right']),
  'single axle positions',
)
assert(
  JSON.stringify(positionsForWheelLayout('dual')) ===
    JSON.stringify(['Outer Left', 'Inner Left', 'Inner Right', 'Outer Right']),
  'dual axle positions',
)

const twoAxle = buildTyreLayout(2, null)
assert(twoAxle.length === 6, `2-axle truck must create 6 tyres, got ${twoAxle.length}`)
assert(
  twoAxle.map((t) => `${t.axleNumber}:${t.position}`).join('|') ===
    [
      '1:Left',
      '1:Right',
      '2:Outer Left',
      '2:Inner Left',
      '2:Inner Right',
      '2:Outer Right',
    ].join('|'),
  '2-axle truck position order',
)

const threeAxle = buildTyreLayout(3, null)
assert(threeAxle.length === 10, `3-axle truck must create 10 tyres, got ${threeAxle.length}`)
assert(
  threeAxle.filter((t) => t.axleNumber === 1).length === 2,
  '3-axle: axle 1 has exactly 2 tyres',
)
assert(
  threeAxle.filter((t) => t.axleNumber === 2).length === 4,
  '3-axle: axle 2 has exactly 4 tyres',
)
assert(
  threeAxle.filter((t) => t.axleNumber === 3).length === 4,
  '3-axle: axle 3 has exactly 4 tyres',
)

const phantom: TyreMeasurement = {
  id: 'vehicle-1-Outer Left',
  unit: 'vehicle',
  axleNumber: 1,
  axleLabel: 'Steer Axle 1',
  position: 'Outer Left',
  treadDepthMm: null,
  status: 'not_checked',
  dbItemId: 'phantom-1',
}
const extras = findExtraneousTyreMeasurements([...twoAxle, phantom], 2, null)
assert(extras.length === 1 && extras[0]?.position === 'Outer Left', 'detect phantom on axle 1')
assert(
  findExtraneousTyreMeasurements(twoAxle, 2, null).length === 0,
  'valid 2-axle layout has no extras',
)

console.log('verify-tyre-check-status: PASS')
