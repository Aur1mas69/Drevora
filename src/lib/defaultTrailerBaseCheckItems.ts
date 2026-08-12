import type { DefaultVehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'

export const TRAILER_CHECKLIST_SECTION = 'Trailer'

const trailerItemFlags = {
  isRequired: true,
  allowNotes: true,
  allowPhoto: false,
  failOnDefect: true,
  isActive: true,
  isCustom: false,
} as const

/**
 * Trailer Base 11 — attached to a powered-vehicle Vehicle Check only.
 * Not a standalone Trailer Check. Not DREVORA Recommended packs.
 * Guidance is practical DREVORA walkaround text for the same DVSA areas.
 */
export const DEFAULT_TRAILER_BASE_CHECK_ITEMS: DefaultVehicleCheckTemplateItem[] = [
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer brake lines and parking brake',
    description:
      'Check the trailer brake connections and parking brake before you move off.\n\nCheck that:\n- air / brake couplings are connected, seated correctly and free from debris\n- there are no leaks from the trailer brake lines or couplings\n- brake lines are not damaged, chafed, kinked or likely to catch\n- the trailer parking brake applies and releases as expected\n\nDo this after the cab brake and air build-up check. Leave the engine running so pressure can build and leaks are easier to hear.',
    sortOrder: 1,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer electrical connections',
    description:
      'Check the trailer electrical supply (suzie / ISO connections) separately from the truck.\n\nCheck that:\n- the trailer electrical coupling is connected securely\n- visible trailer wiring is insulated and not likely to get caught or damaged\n- plugs and sockets are not cracked, corroded or loose',
    sortOrder: 2,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Landing legs',
    description:
      'Check the landing legs before you drive.\n\nCheck that:\n- landing legs are fully raised for travel\n- winding handles are stowed and secure\n- legs, braces and mountings are not damaged, cracked or likely to drop',
    sortOrder: 3,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer body, doors, sideguards and rear under-run',
    description:
      'Walk the trailer body, doors and guards.\n\nCheck that:\n- body panels, curtains, roof and floor edges are secure and not likely to fall off\n- trailer doors, curtains and locking devices close and stay secure\n- sideguards are fitted if required, and are not insecure or damaged\n- rear under-run protection is fitted if required, and is not insecure or damaged',
    sortOrder: 4,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer tyres and wheel fixings',
    description:
      'Check every trailer tyre and wheel you can see. This is separate from the truck tyre check.\n\nCheck that:\n- wheels are secure and wheel nuts are tight enough; check whether wheel nut indicators, if fitted, have moved\n- tyres have a tread depth of at least 1mm\n- tyres are inflated correctly\n- there are no deep cuts in the sidewall and no cord visible\n- there are no objects or debris trapped between twin wheels',
    sortOrder: 5,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer lights, indicators and side markers',
    description:
      'Check trailer lighting separately from the truck lights.\n\nCheck that:\n- all trailer lights, indicators, brake lights and reverse lights work\n- side marker lights are fitted where required and work\n- lenses are fitted, clean and the right colour\n- stop lamps come on when you apply the service brake and go out when you release it',
    sortOrder: 6,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer spray suppression',
    description:
      'If spray suppression is required on the trailer, check the flaps and valances.\n\nCheck that they are:\n- fitted\n- secure\n- not damaged\n- not clogged with mud or debris',
    sortOrder: 7,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer number plate / identification',
    description:
      'Check the trailer identification you will show on the road.\n\nCheck that the number plate or trailer identifier is not:\n- broken or incomplete\n- incorrect or spaced incorrectly\n- dirty\n- faded\n- covered over by anything',
    sortOrder: 8,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer reflectors',
    description:
      'Check trailer reflectors, including side reflectors.\n\nCheck that they are not:\n- missing\n- broken\n- insecure\n- fitted incorrectly\n- the wrong colour\n- obscured by dirt or other objects',
    sortOrder: 9,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Trailer markings and warning plates',
    description:
      'Check conspicuity markings and any warning plates on the trailer.\n\nCheck that they are:\n- the right colour\n- visible\n- securely fastened\n- not obscured by dirt or other objects\n\nIf the trailer is carrying dangerous goods, also check that hazard information panels:\n- show the correct information for the load\n- are visible\n- are securely fastened\n- are not obscured by dirt or other objects',
    sortOrder: 10,
    ...trailerItemFlags,
  },
  {
    section: TRAILER_CHECKLIST_SECTION,
    label: 'Other trailer equipment',
    description:
      'Check any other equipment fitted to this trailer, for example:\n- spare wheel carrier\n- toolboxes\n- landing-leg winding handle stowage\n- straps, chains or other loose equipment that could fall off\n\nDo not use this item for specialist body packs such as bulk, reefer or tanker. Those are separate later checks.',
    sortOrder: 11,
    ...trailerItemFlags,
  },
]

export function getDefaultTrailerBaseCheckItems(): DefaultVehicleCheckTemplateItem[] {
  return DEFAULT_TRAILER_BASE_CHECK_ITEMS.map((item) => ({ ...item }))
}
