/**
 * Verifies Worker/Admin tread status helpers match DB drevora_tyre_tread_status.
 * Run: npx tsx scripts/verify-tyre-check-status.ts
 */
import {
  parseTyreTreadDepthMm,
  treadDepthBand,
  treadDepthToStatus,
  tyreAxleTypeFor,
  tyrePositionToDb,
  validateTyreAxleCounts,
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

console.log('verify-tyre-check-status: PASS')
