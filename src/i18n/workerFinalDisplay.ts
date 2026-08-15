import type { TFunction } from 'i18next'
import type { ConsumableType } from '@/lib/consumableTypes'
import type {
  BugCategory,
  FeedbackType,
  SupportRequestStatus,
} from '@/lib/supportRequestTypes'
import { BUG_CATEGORIES, FEEDBACK_TYPES, RATING_CATEGORY } from '@/lib/supportRequestTypes'
import type { SupportGuideTopicId } from '@/lib/supportGuides'
import type { TyreCheckOverallResult, TyrePosition, TyreStatus, TyreUnit } from '@/lib/tyreCheckTypes'
import type { VehicleCheckItemResult } from '@/lib/vehicleCheckTypes'
import {
  DREVORA_RECOMMENDED_SECTION,
} from '@/lib/defaultDrevoraRecommendedCheckItems'
import {
  VEHICLE_CHECK_REPORT_INSIDE_CAB_SECTION,
  VEHICLE_CHECK_REPORT_OUTSIDE_VEHICLE_SECTION,
  VEHICLE_CHECK_REPORT_RECOMMENDED_TRAILER_TITLE,
} from '@/lib/vehicleCheckReportGrouping'
import { TRAILER_CHECKLIST_SECTION } from '@/lib/defaultTrailerBaseCheckItems'

const CANONICAL_ITEM_KEYS: Record<string, string> = {
  'Front view (mirrors, cameras, and glass)': 'vehicleChecks.itemFrontView',
  'Windscreen wipers and washers': 'vehicleChecks.itemWipers',
  'Dashboard warning lights and gauges': 'vehicleChecks.itemDashboard',
  Steering: 'vehicleChecks.itemSteering',
  Horn: 'vehicleChecks.itemHorn',
  'Brakes and air build-up': 'vehicleChecks.itemBrakes',
  'Height marker': 'vehicleChecks.itemHeightMarker',
  Seatbelts: 'vehicleChecks.itemSeatbelts',
  'Security and condition of cab, doors and steps': 'vehicleChecks.itemCabDoors',
  'Lights and indicators': 'vehicleChecks.itemLights',
  'Fuel and oil leaks': 'vehicleChecks.itemLeaks',
  'Security of body and wings': 'vehicleChecks.itemBodyWings',
  'Battery security and condition': 'vehicleChecks.itemBattery',
  'Diesel exhaust fluid (AdBlue)': 'vehicleChecks.itemAdblue',
  'Excessive engine exhaust smoke': 'vehicleChecks.itemExhaustSmoke',
  'High voltage emergency cut-off switch': 'vehicleChecks.itemHvCutOff',
  'Alternative fuel systems and isolation': 'vehicleChecks.itemAltFuel',
  'Spray suppression': 'vehicleChecks.itemSpray',
  'Tyres and wheel fixing': 'vehicleChecks.itemTyresWheels',
  'Brake lines and trailer parking brake': 'vehicleChecks.itemBrakeLinesTrailer',
  'Electrical connections': 'vehicleChecks.itemElectrical',
  'Coupling security': 'vehicleChecks.itemCoupling',
  'Security of load': 'vehicleChecks.itemLoad',
  'Number plate': 'vehicleChecks.itemNumberPlate',
  Reflectors: 'vehicleChecks.itemReflectors',
  'Markings and warning plates': 'vehicleChecks.itemMarkings',
  'Other equipment': 'vehicleChecks.itemOther',
  'Trailer brake lines and parking brake': 'vehicleChecks.itemTrailerBrakeLines',
  'Trailer electrical connections': 'vehicleChecks.itemTrailerElectrical',
  'Landing legs': 'vehicleChecks.itemLandingLegs',
  'Trailer body, doors, sideguards and rear under-run': 'vehicleChecks.itemTrailerBody',
  'Trailer tyres and wheel fixings': 'vehicleChecks.itemTrailerTyres',
  'Trailer lights, indicators and side markers': 'vehicleChecks.itemTrailerLights',
  'Trailer spray suppression': 'vehicleChecks.itemTrailerSpray',
  'Trailer number plate / identification': 'vehicleChecks.itemTrailerPlate',
  'Trailer reflectors': 'vehicleChecks.itemTrailerReflectors',
  'Trailer markings and warning plates': 'vehicleChecks.itemTrailerMarkings',
  'Other trailer equipment': 'vehicleChecks.itemOtherTrailer',
}

/** Translate canonical DVSA/trailer labels at render. Custom/company labels pass through unchanged. */
export function translateCanonicalChecklistLabel(
  itemName: string,
  t: TFunction,
): string {
  const key = CANONICAL_ITEM_KEYS[itemName]
  if (!key) return itemName
  return t(key, { defaultValue: itemName })
}

export function translateCanonicalChecklistSection(
  category: string,
  assetScope: string | null | undefined,
  t: TFunction,
): string {
  if (category === VEHICLE_CHECK_REPORT_INSIDE_CAB_SECTION) {
    return t('vehicleChecks.sectionInsideCab')
  }
  if (category === VEHICLE_CHECK_REPORT_OUTSIDE_VEHICLE_SECTION) {
    return t('vehicleChecks.sectionOutside')
  }
  if (category === TRAILER_CHECKLIST_SECTION) {
    return t('vehicleChecks.sectionTrailer')
  }
  if (
    category === VEHICLE_CHECK_REPORT_RECOMMENDED_TRAILER_TITLE ||
    (category === DREVORA_RECOMMENDED_SECTION && assetScope === 'trailer')
  ) {
    return t('vehicleChecks.recommendedTrailer')
  }
  if (category === DREVORA_RECOMMENDED_SECTION) {
    return t('vehicleChecks.sectionRecommended')
  }
  return category
}

export function vehicleCheckResultDisplayLabel(
  result: VehicleCheckItemResult,
  t: TFunction,
): string {
  if (result === 'Pass') return t('vehicleChecks.ok')
  if (result === 'Advisory') return t('vehicleChecks.defect')
  return t('vehicleChecks.na')
}

export function tyreStatusDisplayLabel(status: TyreStatus, t: TFunction): string {
  switch (status) {
    case 'good':
      return t('tyreChecks.good')
    case 'attention':
      return t('tyreChecks.attention')
    case 'critical':
      return t('tyreChecks.critical')
    case 'dirty':
      return t('tyreChecks.dirty')
    case 'not_checked':
      return t('tyreChecks.notChecked')
  }
}

export function tyreOverallResultDisplayLabel(
  result: TyreCheckOverallResult,
  t: TFunction,
): string {
  switch (result) {
    case 'pass':
      return t('tyreChecks.passed')
    case 'fail':
      return t('tyreChecks.defectsFound')
    case 'attention':
      return t('tyreChecks.attention')
    case 'incomplete':
      return t('tyreChecks.incomplete')
  }
}

export function tyrePositionDisplayLabel(position: TyrePosition, t: TFunction): string {
  switch (position) {
    case 'Left':
      return t('tyreChecks.left')
    case 'Right':
      return t('tyreChecks.right')
    case 'Outer Left':
      return t('tyreChecks.outerLeft')
    case 'Inner Left':
      return t('tyreChecks.innerLeft')
    case 'Inner Right':
      return t('tyreChecks.innerRight')
    case 'Outer Right':
      return t('tyreChecks.outerRight')
  }
}

export function tyreAxleDisplayLabel(
  unit: TyreUnit,
  axleNumber: number,
  t: TFunction,
): string {
  if (unit === 'trailer') return t('tyreChecks.trailerAxle', { n: axleNumber })
  if (axleNumber === 1) return t('tyreChecks.steerAxle', { n: axleNumber })
  return t('tyreChecks.driveAxle', { n: axleNumber })
}

const CONSUMABLE_TYPE_KEYS: Record<ConsumableType, string> = {
  Diesel: 'consumables.typeDiesel',
  Petrol: 'consumables.typePetrol',
  AdBlue: 'consumables.typeAdBlue',
  'Engine Oil': 'consumables.typeEngineOil',
  Coolant: 'consumables.typeCoolant',
  Screenwash: 'consumables.typeScreenwash',
  'Hydraulic Oil': 'consumables.typeHydraulicOil',
  Grease: 'consumables.typeGrease',
  Admixture: 'consumables.typeAdmixture',
  'Concrete Additive': 'consumables.typeConcreteAdditive',
  Other: 'consumables.typeOther',
}

export function consumableTypeDisplayLabel(type: ConsumableType, t: TFunction): string {
  return t(CONSUMABLE_TYPE_KEYS[type], { defaultValue: type })
}

export function supportStatusDisplayLabel(
  status: SupportRequestStatus,
  t: TFunction,
): string {
  switch (status) {
    case 'submitted':
      return t('support.statusSubmitted')
    case 'in_progress':
      return t('support.statusInProgress')
    case 'resolved':
      return t('support.statusResolved')
    case 'closed':
      return t('support.statusClosed')
  }
}

const BUG_CATEGORY_KEYS: Record<BugCategory, string> = {
  'Login / Account': 'support.catLogin',
  Timesheets: 'support.catTimesheets',
  'Holiday Requests': 'support.catHolidays',
  'Vehicle Checks': 'support.catVehicleChecks',
  'Tyre Checks': 'support.catTyreChecks',
  Vehicles: 'support.catVehicles',
  Documents: 'support.catDocuments',
  Contacts: 'support.catContacts',
  'Offline / Sync': 'support.catOffline',
  Performance: 'support.catPerformance',
  'Design / Display': 'support.catDesign',
  Notifications: 'support.catNotifications',
  Other: 'support.catOther',
}

const FEEDBACK_TYPE_KEYS: Record<FeedbackType, string> = {
  Suggestion: 'support.fbSuggestion',
  'Ease of Use': 'support.fbEase',
  Design: 'support.fbDesign',
  Performance: 'support.fbPerformance',
  'Feature Request': 'support.fbFeature',
  Other: 'support.fbOther',
}

export function bugCategoryDisplayLabel(category: BugCategory, t: TFunction): string {
  return t(BUG_CATEGORY_KEYS[category], { defaultValue: category })
}

export function feedbackTypeDisplayLabel(type: FeedbackType, t: TFunction): string {
  return t(FEEDBACK_TYPE_KEYS[type], { defaultValue: type })
}

export function supportStoredCategoryDisplayLabel(category: string, t: TFunction): string {
  if ((BUG_CATEGORIES as readonly string[]).includes(category)) {
    return bugCategoryDisplayLabel(category as BugCategory, t)
  }
  if ((FEEDBACK_TYPES as readonly string[]).includes(category)) {
    return feedbackTypeDisplayLabel(category as FeedbackType, t)
  }
  if (category === RATING_CATEGORY) {
    return t('support.catRating', { defaultValue: 'App Rating' })
  }
  return category
}

type GuideCopy = { titleKey: string; descKey: string; stepKeys: string[] }

const GUIDE_COPY: Record<SupportGuideTopicId, GuideCopy> = {
  'getting-started': {
    titleKey: 'help.gsTitle',
    descKey: 'help.gsDesc',
    stepKeys: ['help.gs1', 'help.gs2', 'help.gs3', 'help.gs4', 'help.gs5'],
  },
  timesheets: {
    titleKey: 'help.tsTitle',
    descKey: 'help.tsDesc',
    stepKeys: [
      'help.ts1',
      'help.ts2',
      'help.ts3',
      'help.ts4',
      'help.ts5',
      'help.ts6',
      'help.ts7',
      'help.ts8',
      'help.ts9',
    ],
  },
  'holiday-requests': {
    titleKey: 'help.holTitle',
    descKey: 'help.holDesc',
    stepKeys: ['help.hol1', 'help.hol2', 'help.hol3', 'help.hol4', 'help.hol5'],
  },
  'vehicle-checks': {
    titleKey: 'help.vcTitle',
    descKey: 'help.vcDesc',
    stepKeys: [
      'help.vc1',
      'help.vc2',
      'help.vc3',
      'help.vc4',
      'help.vc5',
      'help.vc6',
      'help.vc7',
      'help.vc8',
    ],
  },
  'tyre-checks': {
    titleKey: 'help.tyreTitle',
    descKey: 'help.tyreDesc',
    stepKeys: [
      'help.tyre1',
      'help.tyre2',
      'help.tyre3',
      'help.tyre4',
      'help.tyre5',
      'help.tyre6',
    ],
  },
  vehicles: {
    titleKey: 'help.vehTitle',
    descKey: 'help.vehDesc',
    stepKeys: ['help.veh1', 'help.veh2', 'help.veh3', 'help.veh4'],
  },
  documents: {
    titleKey: 'help.docTitle',
    descKey: 'help.docDesc',
    stepKeys: ['help.doc1', 'help.doc2', 'help.doc3'],
  },
  'offline-vehicle-checks': {
    titleKey: 'help.offTitle',
    descKey: 'help.offDesc',
    stepKeys: [
      'help.off1',
      'help.off2',
      'help.off3',
      'help.off4',
      'help.off5',
      'help.off6',
      'help.off7',
    ],
  },
  'account-security': {
    titleKey: 'help.secTitle',
    descKey: 'help.secDesc',
    stepKeys: ['help.sec1', 'help.sec2', 'help.sec3', 'help.sec4'],
  },
  'using-safely': {
    titleKey: 'help.safeTitle',
    descKey: 'help.safeDesc',
    stepKeys: [
      'help.safe1',
      'help.safe2',
      'help.safe3',
      'help.safe4',
      'help.safe5',
      'help.safe6',
      'help.safe7',
    ],
  },
}

export function translateSupportGuide(
  id: SupportGuideTopicId,
  t: TFunction,
): { title: string; shortDescription: string; steps: string[] } {
  const copy = GUIDE_COPY[id]
  return {
    title: t(copy.titleKey),
    shortDescription: t(copy.descKey),
    steps: copy.stepKeys.map((key) => t(key)),
  }
}

export { CANONICAL_ITEM_KEYS }
