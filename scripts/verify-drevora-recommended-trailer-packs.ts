/**
 * Logical composition checks for DREVORA Recommended packs
 * (powered vehicle_type + trailer_type).
 * Run: npx tsx scripts/verify-drevora-recommended-trailer-packs.ts
 */
import { getDefaultDvsaVehicleCheckItems } from '../src/lib/defaultDvsaVehicleCheckItems.ts'
import { getDefaultTrailerBaseCheckItems } from '../src/lib/defaultTrailerBaseCheckItems.ts'
import {
  DREVORA_RECOMMENDED_PACKS,
  DREVORA_RECOMMENDED_SECTION,
  DREVORA_RECOMMENDED_VEHICLE_PACKS,
  getDrevoraRecommendedCheckItems,
  getDrevoraRecommendedVehicleCheckItems,
} from '../src/lib/defaultDrevoraRecommendedCheckItems.ts'
import { composeVehicleCheckTemplatesForTrailer } from '../src/lib/vehicleCheckTrailerChecklist.ts'
import { groupTemplatesBySection } from '../src/lib/vehicleCheckUtils.ts'
import type { VehicleCheckTemplateItem } from '../src/lib/vehicleCheckTemplateTypes.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function mapDefaults(items: ReturnType<typeof getDefaultDvsaVehicleCheckItems>): VehicleCheckTemplateItem[] {
  const createdAt = new Date().toISOString()
  return items.map((item, index) => ({
    id: `dvsa-${index + 1}`,
    templateId: 'dvsa',
    section: item.section,
    label: item.label,
    description: item.description,
    sortOrder: item.sortOrder,
    isRequired: item.isRequired,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
    isActive: item.isActive,
    isCustom: item.isCustom,
    createdAt,
  }))
}

const FORBIDDEN_SUBSTRINGS = [
  'tyres and wheel',
  'lights and indicators',
  'spray suppression',
  'coupling security',
  'brake lines',
  'electrical connections',
  'number plate',
  'reflectors',
  'markings and warning',
  'security of load',
]

const EXPECTED_TRAILER_COUNTS: Record<string, number> = {
  Curtainsider: 5,
  Reefer: 7,
  Bulk: 8,
  Tanker: 8,
  Tipper: 7,
  Flatbed: 5,
  'Low Loader': 7,
  Box: 0,
  Other: 0,
}

const EXPECTED_VEHICLE_COUNTS: Record<string, number> = {
  'Volumetric Concrete Mixer': 8,
  'Concrete Mixer Drum': 7,
  'Concrete Pump': 8,
  Tipper: 7,
  'Grab Lorry': 8,
  'Skip Lorry': 7,
  'Hook Loader': 7,
  'RoRo / Roll-on Roll-off': 7,
  Tanker: 8,
  'Fuel Tanker': 8,
  'Water Tanker': 7,
  'Waste Tanker': 8,
  'Refrigerated Vehicle': 7,
  'Low Loader': 6,
  'Plant / Machinery': 6,
  Forklift: 7,
  Telehandler: 7,
}

const NO_POWERED_PACK_TYPES = [
  'Car',
  'Van',
  'Pickup',
  '3.5t Van',
  '7.5t Lorry',
  '12t Rigid',
  '18t Rigid',
  '26t Rigid',
  '32t Rigid',
  'Artic Tractor Unit',
  'Trailer',
  'Box Lorry',
  'Curtain Side Lorry',
  'Flatbed Lorry',
  'Yard Vehicle',
  'Other',
]

const dvsa = getDefaultDvsaVehicleCheckItems()
const trailerBase = getDefaultTrailerBaseCheckItems()
assert(dvsa.length === 27, `DVSA source must stay 27, got ${dvsa.length}`)
assert(trailerBase.length === 11, `Trailer Base source must stay 11, got ${trailerBase.length}`)

const templates = mapDefaults(dvsa)
const extra: VehicleCheckTemplateItem = {
  id: 'extra-1',
  templateId: 'dvsa',
  section: 'Company extras',
  label: 'Company trailer strap check',
  description: 'Company custom extra',
  sortOrder: 101,
  isRequired: true,
  allowNotes: true,
  allowPhoto: false,
  failOnDefect: true,
  isActive: true,
  isCustom: true,
  createdAt: new Date().toISOString(),
}
const templatesWithExtra = [...templates, extra]

function assertPackQuality(
  type: string,
  pack: ReturnType<typeof getDrevoraRecommendedCheckItems>,
  expected: number,
) {
  assert(pack.length === expected, `${type} pack expected ${expected}, got ${pack.length}`)
  assert(pack.length <= 10, `${type} exceeds max 10 Recommended items`)
  for (const item of pack) {
    assert(item.section === DREVORA_RECOMMENDED_SECTION, `${type} item section must be Recommended`)
    assert(Boolean(item.description?.trim()), `${type} / ${item.label} missing guidance`)
    assert(!/dvsa required|mandatory dvsa/i.test(item.description), `${item.label} claims DVSA mandatory status`)
    const key = item.label.trim().toLowerCase()
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      assert(key !== forbidden, `${type} duplicates forbidden item: ${item.label}`)
    }
  }
}

const HIDDEN_WHEN_NO_TRAILER = [
  'Brake lines and trailer parking brake',
  'Electrical connections',
  'Coupling security',
] as const

const noTrailerSimple = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
  trailerAttached: false,
  vehicleType: 'Artic Tractor Unit',
})
const noTrailerSimpleDvsa = noTrailerSimple.filter((item) => item.source === 'dvsa')
assert(dvsa.length === 27, 'Protected DVSA source must stay 27 after no-trailer filter')
assert(
  noTrailerSimpleDvsa.length === 24,
  `No-trailer runtime DVSA base must be 24, got ${noTrailerSimpleDvsa.length}`,
)
assert(
  noTrailerSimple.filter((item) => item.source === 'company_custom').length === 1,
  'No-trailer must keep company custom extra',
)
assert(
  noTrailerSimple.length === 25,
  'Artic no-trailer must be 24 DVSA + 1 company extra',
)
assert(
  noTrailerSimple.every((item) => item.section !== 'Trailer'),
  'No-trailer must not include Trailer Base',
)
assert(
  noTrailerSimple.filter((item) => item.source === 'drevora_recommended').length === 0,
  'Artic Tractor Unit must receive zero Recommended items',
)
for (const label of HIDDEN_WHEN_NO_TRAILER) {
  assert(
    !noTrailerSimple.some((item) => item.label === label),
    `No-trailer must not include ${label}`,
  )
  assert(
    dvsa.some((item) => item.label === label),
    `Protected DVSA source must still contain ${label}`,
  )
}

for (const vehicleType of [
  'Tipper',
  'Volumetric Concrete Mixer',
  'Tanker',
  'Artic Tractor Unit',
]) {
  const composed = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
    trailerAttached: false,
    vehicleType,
  })
  const runtimeDvsa = composed.filter((item) => item.source === 'dvsa')
  assert(
    runtimeDvsa.length === 24,
    `${vehicleType} + no trailer must have 24 DVSA items, got ${runtimeDvsa.length}`,
  )
  for (const label of HIDDEN_WHEN_NO_TRAILER) {
    assert(
      !composed.some((item) => item.label === label),
      `${vehicleType} + no trailer must not include ${label}`,
    )
  }
}

const thirdParty = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
  trailerAttached: true,
  trailerSource: 'third_party',
  trailerType: 'Curtainsider',
  vehicleType: 'Artic Tractor Unit',
})
assert(
  thirdParty.filter((item) => item.section === 'Trailer').length === 11,
  'Third-party must still get Trailer Base 11',
)
assert(
  thirdParty.filter((item) => item.source === 'drevora_recommended').length === 0,
  'Third-party must not get a trailer Recommended pack even if a type is guessed',
)
assert(
  thirdParty.filter((item) => item.label === 'Coupling security').length === 1,
  'Third-party trailer-attached must keep Coupling security exactly once',
)
assert(
  thirdParty.some((item) => item.label === 'Trailer brake lines and parking brake'),
  'Third-party Trailer Base must include trailer brake lines',
)
assert(
  thirdParty.some((item) => item.label === 'Trailer electrical connections'),
  'Third-party Trailer Base must include trailer electrical connections',
)

for (const [type, expected] of Object.entries(EXPECTED_TRAILER_COUNTS)) {
  const pack = getDrevoraRecommendedCheckItems(type)
  assertPackQuality(`trailer ${type}`, pack, expected)

  const composed = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
    trailerAttached: true,
    trailerSource: 'company',
    trailerType: type,
    vehicleType: 'Artic Tractor Unit',
  })
  const recommended = composed.filter(
    (item) => item.source === 'drevora_recommended' && item.assetScope === 'trailer',
  )
  const base = composed.filter((item) => item.source === 'trailer_base')
  const extras = composed.filter((item) => item.source === 'company_custom')
  assert(base.length === 11, `${type} composition missing Trailer Base 11`)
  assert(recommended.length === expected, `${type} trailer Recommended count ${recommended.length}`)
  assert(extras.length === 1, `${type} must keep company custom extra`)
  assert(
    recommended.every((item) => item.assetScope === 'trailer'),
    `${type} trailer Recommended asset_scope must be trailer`,
  )
  assert(
    composed.filter((item) => item.label === 'Coupling security').length === 1,
    `${type} trailer-attached must keep Coupling security exactly once`,
  )
  assert(
    base.some((item) => item.label === 'Trailer brake lines and parking brake'),
    `${type} Trailer Base must include trailer brake lines`,
  )
  assert(
    base.some((item) => item.label === 'Trailer electrical connections'),
    `${type} Trailer Base must include trailer electrical connections`,
  )
  assert(
    !composed.some((item) => item.label === 'Brake lines and trailer parking brake'),
    `${type} must not duplicate DVSA brake lines when trailer is attached`,
  )
  assert(
    !composed.some((item) => item.label === 'Electrical connections'),
    `${type} must not duplicate DVSA electrical connections when trailer is attached`,
  )
}

for (const [type, expected] of Object.entries(EXPECTED_VEHICLE_COUNTS)) {
  const pack = getDrevoraRecommendedVehicleCheckItems(type)
  assertPackQuality(`vehicle ${type}`, pack, expected)
  assert(
    Object.prototype.hasOwnProperty.call(DREVORA_RECOMMENDED_VEHICLE_PACKS, type),
    `${type} missing from powered pack map`,
  )

  const noTrailer = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
    trailerAttached: false,
    vehicleType: type,
  })
  const powered = noTrailer.filter(
    (item) => item.source === 'drevora_recommended' && item.assetScope === 'vehicle',
  )
  assert(powered.length === expected, `${type} no-trailer powered Recommended count ${powered.length}`)
  assert(
    powered.every((item) => item.assetScope === 'vehicle'),
    `${type} powered Recommended asset_scope must be vehicle`,
  )
  assert(
    noTrailer.every((item) => item.section !== 'Trailer'),
    `${type} no-trailer must not include Trailer Base`,
  )
  const extras = noTrailer.filter((item) => item.source === 'company_custom')
  assert(extras.length === 1, `${type} no-trailer must keep company custom extra`)
  const runtimeDvsa = noTrailer.filter((item) => item.source === 'dvsa')
  assert(
    runtimeDvsa.length === 24,
    `${type} no-trailer DVSA runtime must be 24, got ${runtimeDvsa.length}`,
  )
  for (const label of HIDDEN_WHEN_NO_TRAILER) {
    assert(
      !noTrailer.some((item) => item.label === label),
      `${type} no-trailer must not include ${label}`,
    )
  }
  if (expected > 0) {
    const lastDvsa = noTrailer.findLastIndex((item) => item.source === 'dvsa')
    const firstPowered = noTrailer.findIndex((item) => item.source === 'drevora_recommended')
    const firstExtra = noTrailer.findIndex((item) => item.source === 'company_custom')
    assert(lastDvsa < firstPowered, `${type} powered Recommended must follow DVSA`)
    assert(firstPowered < firstExtra, `${type} company custom must follow powered Recommended`)
  }
}

for (const type of NO_POWERED_PACK_TYPES) {
  const pack = getDrevoraRecommendedVehicleCheckItems(type)
  assert(pack.length === 0, `${type} must receive zero powered Recommended items, got ${pack.length}`)
}

const dual = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
  trailerAttached: true,
  trailerSource: 'company',
  trailerType: 'Curtainsider',
  vehicleType: 'Volumetric Concrete Mixer',
})
const dualPowered = dual.filter(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'vehicle',
)
const dualTrailer = dual.filter(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'trailer',
)
const dualBase = dual.filter((item) => item.source === 'trailer_base')
assert(dualPowered.length === 8, 'Volumetric + Curtainsider must keep powered Recommended')
assert(dualTrailer.length === 5, 'Volumetric + Curtainsider must keep trailer Recommended')
assert(dualBase.length === 11, 'Volumetric + Curtainsider must keep Trailer Base 11')

const lastPowered = dual.findLastIndex(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'vehicle',
)
const firstBase = dual.findIndex((item) => item.source === 'trailer_base')
const lastBase = dual.findLastIndex((item) => item.source === 'trailer_base')
const firstTrailerRec = dual.findIndex(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'trailer',
)
const firstExtra = dual.findIndex((item) => item.source === 'company_custom')
assert(lastPowered < firstBase, 'Powered Recommended must come before Trailer Base')
assert(lastBase < firstTrailerRec, 'Trailer Recommended must follow Trailer Base')
assert(firstTrailerRec < firstExtra, 'Company custom must follow trailer Recommended')

const sections = groupTemplatesBySection(dual)
const recommendedSections = sections.filter((entry) => entry.section === DREVORA_RECOMMENDED_SECTION)
assert(recommendedSections.length === 2, 'Both Recommended layers must render as separate heading groups')
assert(recommendedSections[0]?.assetScope === 'vehicle', 'First Recommended group must be powered/vehicle')
assert(recommendedSections[1]?.assetScope === 'trailer', 'Second Recommended group must be trailer')

const tipperDual = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
  trailerAttached: true,
  trailerSource: 'company',
  trailerType: 'Tipper',
  vehicleType: 'Tipper',
})
const tipperPowered = tipperDual.filter(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'vehicle',
)
const tipperTrailer = tipperDual.filter(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'trailer',
)
assert(tipperPowered.length === 7, 'Powered Tipper pack must not be replaced by trailer Tipper pack')
assert(tipperTrailer.length === 7, 'Trailer Tipper pack must not be replaced by powered Tipper pack')

const tankerDual = composeVehicleCheckTemplatesForTrailer(templatesWithExtra, {
  trailerAttached: true,
  trailerSource: 'company',
  trailerType: 'Tanker',
  vehicleType: 'Tanker',
})
const tankerPowered = tankerDual.filter(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'vehicle',
)
const tankerTrailer = tankerDual.filter(
  (item) => item.source === 'drevora_recommended' && item.assetScope === 'trailer',
)
assert(tankerPowered.length === 8, 'Powered Tanker pack must not be replaced by trailer Tanker pack')
assert(tankerTrailer.length === 8, 'Trailer Tanker pack must not be replaced by powered Tanker pack')

const unknownTrailer = getDrevoraRecommendedCheckItems('Not A Type')
assert(unknownTrailer.length === 0, 'Unrecognised trailer_type must not invent a pack')
const unknownVehicle = getDrevoraRecommendedVehicleCheckItems('Not A Type')
assert(unknownVehicle.length === 0, 'Unrecognised vehicle_type must not invent a pack')

assert(
  Object.keys(DREVORA_RECOMMENDED_PACKS).length === 9,
  'Trailer pack map size changed',
)

console.log('verify-drevora-recommended-trailer-packs: PASS')
console.log('Trailer packs:')
console.log(
  Object.entries(EXPECTED_TRAILER_COUNTS)
    .map(([type, count]) => `  ${type}: ${count}`)
    .join('\n'),
)
console.log('Powered packs:')
console.log(
  Object.entries(EXPECTED_VEHICLE_COUNTS)
    .map(([type, count]) => `  ${type}: ${count}`)
    .join('\n'),
)
