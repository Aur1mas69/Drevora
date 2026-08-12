/**
 * Completed Vehicle Check report grouping/order.
 * Proves drawer and PDF share one helper, sections are not alphabetised,
 * and historical stored rows are never filtered.
 * Run: npx tsx scripts/verify-vehicle-check-report-grouping.ts
 */
import { DREVORA_RECOMMENDED_SECTION } from '../src/lib/defaultDrevoraRecommendedCheckItems.ts'
import { TRAILER_CHECKLIST_SECTION } from '../src/lib/defaultTrailerBaseCheckItems.ts'
import {
  getVehicleCheckReportIdentity,
  getVehicleCheckReportItemNamesInOrder,
  getVehicleCheckReportSectionKinds,
  groupVehicleCheckReportItems,
  toVehicleCheckReportChecklistView,
  type VehicleCheckReportItem,
} from '../src/lib/vehicleCheckReportGrouping.ts'
import type { VehicleCheckAssetScope } from '../src/lib/vehicleCheckTypes.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function item(
  category: string,
  itemName: string,
  assetScope: VehicleCheckAssetScope = 'vehicle',
  result: VehicleCheckReportItem['result'] = 'Pass',
): VehicleCheckReportItem {
  return {
    id: `${category}-${itemName}-${assetScope}`,
    category,
    itemName,
    result,
    comment: null,
    photoUrl: null,
    assetScope,
  }
}

const INSIDE = 'Inside cab / front view'
const OUTSIDE = 'Outside vehicle'

function volumetricNoTrailerItems(): VehicleCheckReportItem[] {
  return [
    item(DREVORA_RECOMMENDED_SECTION, 'Auger / mixer condition'),
    item(OUTSIDE, 'Tyres and wheel fixings'),
    item(INSIDE, 'Windscreen wipers and washers'),
    item(OUTSIDE, 'Brake lines and trailer parking brake'),
    item(INSIDE, 'Front view (mirrors, cameras, and glass)'),
    item(OUTSIDE, 'Electrical connections'),
    item(OUTSIDE, 'Coupling security'),
    item(DREVORA_RECOMMENDED_SECTION, 'Body / hopper condition'),
    item(OUTSIDE, 'Lights and indicators'),
    item(INSIDE, 'Horn'),
  ]
}

function trailerAttachedItems(): VehicleCheckReportItem[] {
  return [
    item(DREVORA_RECOMMENDED_SECTION, 'Auger / mixer condition', 'vehicle'),
    item(TRAILER_CHECKLIST_SECTION, 'Landing legs', 'trailer'),
    item(INSIDE, 'Brakes and air build-up', 'combination'),
    item(OUTSIDE, 'Tyres and wheel fixings', 'vehicle'),
    item(INSIDE, 'Front view (mirrors, cameras, and glass)', 'vehicle'),
    item(DREVORA_RECOMMENDED_SECTION, 'Curtains and curtain tension', 'trailer'),
    item(OUTSIDE, 'Coupling security', 'combination'),
    item(TRAILER_CHECKLIST_SECTION, 'Trailer brake lines and parking brake', 'trailer'),
    item(OUTSIDE, 'Security of load', 'combination'),
    item('Workshop extras', 'Fire extinguisher', 'vehicle'),
    item(DREVORA_RECOMMENDED_SECTION, 'Body / hopper condition', 'vehicle'),
  ]
}

const noTrailer = volumetricNoTrailerItems()
const noTrailerReport = groupVehicleCheckReportItems(noTrailer)
const noTrailerKinds = getVehicleCheckReportSectionKinds(noTrailer)
const noTrailerNames = getVehicleCheckReportItemNamesInOrder(noTrailer)
const noTrailerView = toVehicleCheckReportChecklistView(noTrailer)

assert(
  noTrailerReport.numberedItems.length === noTrailer.length,
  'No-trailer report must keep every stored row',
)
assert(
  JSON.stringify(noTrailerKinds) ===
    JSON.stringify(['inside_cab', 'outside_vehicle', 'recommended_vehicle']),
  `No-trailer section order was ${noTrailerKinds.join(' → ')}`,
)
assert(
  noTrailerNames[0] === 'Front view (mirrors, cameras, and glass)',
  'Inside cab must start with Front view, not alphabetical item order',
)
assert(
  noTrailerNames.indexOf('Auger / mixer condition') >
    noTrailerNames.indexOf('Lights and indicators'),
  'Vehicle Recommended must follow Outside vehicle, not appear first',
)
assert(
  noTrailerNames.includes('Brake lines and trailer parking brake') &&
    noTrailerNames.includes('Electrical connections') &&
    noTrailerNames.includes('Coupling security'),
  'Historical no-trailer DVSA trailer items must remain in the report',
)
assert(
  noTrailerReport.sections.find((section) => section.kind === 'outside_vehicle')
    ?.items.some((entry) => entry.itemName === 'Coupling security') === true,
  'Historical Coupling security stays in Outside vehicle when stored as vehicle scope',
)
assert(
  JSON.stringify(noTrailerView.formSections.map((section) => section.section)) ===
    JSON.stringify(noTrailerReport.sections.map((section) => section.formCategory)),
  'Drawer form sections must come from the same grouping helper as the report model',
)

const alphaByName = [...noTrailer].sort((left, right) =>
  left.itemName.localeCompare(right.itemName),
)
assert(
  noTrailerNames.join('|') !== alphaByName.map((entry) => entry.itemName).join('|'),
  'Report order must not be a global alphabetical item list',
)

const insideNames = noTrailerReport.sections.find((section) => section.kind === 'inside_cab')
  ?.items.map((entry) => entry.itemName) ?? []
const outsideNames = noTrailerReport.sections.find((section) => section.kind === 'outside_vehicle')
  ?.items.map((entry) => entry.itemName) ?? []
assert(
  !insideNames.some((name) => outsideNames.includes(name)),
  'Inside cab and Outside vehicle must not interleave into one list',
)
assert(
  insideNames.indexOf('Front view (mirrors, cameras, and glass)') <
    insideNames.indexOf('Horn'),
  'Inside cab must keep DVSA walkaround order',
)

const attached = trailerAttachedItems()
const attachedReport = groupVehicleCheckReportItems(attached)
const attachedKinds = getVehicleCheckReportSectionKinds(attached)

assert(
  attachedReport.numberedItems.length === attached.length,
  'Trailer-attached report must keep every stored row',
)
assert(
  JSON.stringify(attachedKinds) ===
    JSON.stringify([
      'inside_cab',
      'outside_vehicle',
      'recommended_vehicle',
      'combination',
      'trailer',
      'recommended_trailer',
      'company_custom',
    ]),
  `Trailer-attached section order was ${attachedKinds.join(' → ')}`,
)

const attachedNames = getVehicleCheckReportItemNamesInOrder(attached)
assert(
  attachedNames.indexOf('Front view (mirrors, cameras, and glass)') <
    attachedNames.indexOf('Tyres and wheel fixings'),
  'Inside cab must precede Outside vehicle',
)
assert(
  attachedNames.indexOf('Tyres and wheel fixings') <
    attachedNames.indexOf('Auger / mixer condition'),
  'Vehicle Recommended must follow vehicle base sections',
)
assert(
  attachedNames.indexOf('Auger / mixer condition') <
    attachedNames.indexOf('Brakes and air build-up'),
  'Combination must follow Vehicle Recommended',
)
assert(
  attachedNames.indexOf('Brakes and air build-up') <
    attachedNames.indexOf('Trailer brake lines and parking brake'),
  'Trailer Base must follow Combination / vehicle sections',
)
assert(
  attachedNames.indexOf('Landing legs') <
    attachedNames.indexOf('Curtains and curtain tension'),
  'Trailer Recommended must follow Trailer Base',
)
assert(
  attachedNames.indexOf('Curtains and curtain tension') <
    attachedNames.indexOf('Fire extinguisher'),
  'Company custom must follow Trailer Recommended',
)

const combination = attachedReport.sections.find((section) => section.kind === 'combination')
assert(Boolean(combination), 'Combination section must exist when combination-scoped items exist')
assert(
  combination?.items.map((entry) => entry.itemName).join('|') ===
    'Brakes and air build-up|Coupling security|Security of load',
  'Combination items must be grouped together in DVSA order',
)

const recommendedVehicle = attachedReport.sections.find(
  (section) => section.kind === 'recommended_vehicle',
)
const recommendedTrailer = attachedReport.sections.find(
  (section) => section.kind === 'recommended_trailer',
)
assert(
  recommendedVehicle?.title === DREVORA_RECOMMENDED_SECTION,
  'Vehicle Recommended title must stay DREVORA Recommended',
)
assert(
  recommendedTrailer?.title === 'DREVORA Recommended — Trailer',
  'Trailer Recommended must use a distinct title',
)
assert(
  recommendedVehicle?.items.every((entry) => entry.assetScope === 'vehicle') === true,
  'Vehicle Recommended must not mix trailer-scoped items',
)
assert(
  recommendedTrailer?.items.every((entry) => entry.assetScope === 'trailer') === true,
  'Trailer Recommended must not mix vehicle-scoped items',
)

const mixedResults = [
  item(INSIDE, 'Horn', 'vehicle', 'Pass'),
  item(OUTSIDE, 'Tyres and wheel fixings', 'vehicle', 'Advisory'),
  item(OUTSIDE, 'Lights and indicators', 'vehicle', 'Fail'),
]
const summary = groupVehicleCheckReportItems(mixedResults).summary
assert(summary.ok === 1 && summary.defect === 1 && summary.na === 1, 'Summary must use stored results')
assert(summary.total === 3, 'Summary total must equal stored item count')

const noneIdentity = getVehicleCheckReportIdentity({
  vehicleRegistration: 'JT18 KUP',
  fleetNumber: '12',
  vehicleMake: 'Volvo',
  vehicleModel: 'FM',
  vehicleType: 'Volumetric',
  workerName: 'Alex Driver',
  trailerSource: 'none',
  vehicleRegistrationSnapshot: 'JT18 KUP',
  vehicleFleetNumberSnapshot: '12',
  trailerNumberSnapshot: 'SHOULD-NOT-SHOW',
  trailerRegistrationSnapshot: null,
  trailerTypeSnapshot: 'Curtainsider',
  trailerLabelSnapshot: null,
})
assert(noneIdentity.trailer === null, 'Trailer block must be hidden when trailer_source is none')
assert(noneIdentity.vehicle.vehicleType === 'Volumetric', 'Vehicle type must come through on the report header')

const companyTrailerIdentity = getVehicleCheckReportIdentity({
  vehicleRegistration: 'LIVE REG',
  fleetNumber: 'LIVE FLEET',
  vehicleMake: 'DAF',
  vehicleModel: 'XF',
  vehicleType: 'Tractor Unit',
  workerName: 'Alex Driver',
  trailerSource: 'company',
  vehicleRegistrationSnapshot: 'SNAP REG',
  vehicleFleetNumberSnapshot: 'SNAP FLEET',
  trailerNumberSnapshot: 'T-44',
  trailerRegistrationSnapshot: 'AB12 CDE',
  trailerTypeSnapshot: 'Curtainsider',
  trailerLabelSnapshot: null,
})
assert(companyTrailerIdentity.vehicle.registration === 'SNAP REG', 'Prefer vehicle registration snapshot')
assert(companyTrailerIdentity.trailer?.number === 'T-44', 'Company trailer number snapshot must show')
assert(companyTrailerIdentity.trailer?.isThirdParty === false, 'Company trailer is not third-party')

const thirdPartyIdentity = getVehicleCheckReportIdentity({
  vehicleRegistration: 'JT18 KUP',
  fleetNumber: null,
  vehicleMake: null,
  vehicleModel: null,
  vehicleType: null,
  workerName: 'Alex Driver',
  trailerSource: 'third_party',
  vehicleRegistrationSnapshot: null,
  vehicleFleetNumberSnapshot: null,
  trailerNumberSnapshot: 'HIRE-9',
  trailerRegistrationSnapshot: 'XY99 ZZZ',
  trailerTypeSnapshot: null,
  trailerLabelSnapshot: 'Hired trailer',
})
assert(thirdPartyIdentity.trailer?.isThirdParty === true, 'Third-party trailer must be labelled')
assert(thirdPartyIdentity.trailer?.number === 'HIRE-9', 'Third-party identifier must show')

console.log('verify-vehicle-check-report-grouping: PASS')
console.log(`  no-trailer: ${noTrailerKinds.join(' → ')}`)
console.log(`  trailer-attached: ${attachedKinds.join(' → ')}`)
