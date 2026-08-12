import type { DefaultVehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'

export const DREVORA_RECOMMENDED_SECTION = 'DREVORA Recommended'

export const DREVORA_RECOMMENDED_SECTION_HINT =
  'Additional checks recommended for this trailer type.'

export const DREVORA_RECOMMENDED_VEHICLE_HINT =
  'Additional checks recommended for this vehicle type.'

const recommendedItemFlags = {
  isRequired: true,
  allowNotes: true,
  allowPhoto: false,
  failOnDefect: true,
  isActive: true,
  isCustom: false,
} as const

export type DrevoraRecommendedTrailerType =
  | 'Curtainsider'
  | 'Box'
  | 'Reefer'
  | 'Bulk'
  | 'Tanker'
  | 'Tipper'
  | 'Flatbed'
  | 'Low Loader'
  | 'Other'

type RecommendedItem = DefaultVehicleCheckTemplateItem

function item(
  sortOrder: number,
  label: string,
  description: string,
): RecommendedItem {
  return {
    section: DREVORA_RECOMMENDED_SECTION,
    label,
    description,
    sortOrder,
    ...recommendedItemFlags,
  }
}

/**
 * DREVORA Recommended packs by `vehicles.trailer_type`.
 * Not DVSA mandatory. Not Trailer Base. Bundled for offline composition.
 * Box and Other have no pack. Maximum 10 items per type.
 */
export const DREVORA_RECOMMENDED_PACKS: Record<
  DrevoraRecommendedTrailerType,
  RecommendedItem[]
> = {
  Curtainsider: [
    item(
      1,
      'Curtains and curtain tension',
      'Visually check both curtains before you move off.\n\nCheck that:\n- curtains are intact, not torn through, and not hanging loose\n- curtain tension looks even and the curtain sits correctly on the body\n- there is no obvious damage that could let the load shift or come out\n\nThis is a recommended visual check, not a DVSA-required extra test.',
    ),
    item(
      2,
      'Curtain straps, buckles and fasteners',
      'Check the curtain restraint hardware you can see.\n\nCheck that:\n- straps are present, not cut through, and not frayed to the point of failure\n- buckles, hooks and fasteners close and look secure\n- nothing is left undone that would let a curtain billow in transit',
    ),
    item(
      3,
      'Curtain rails and runners',
      'Look along the curtain rails and runners.\n\nCheck that:\n- rails are attached and not bent, cracked or hanging off\n- runners/sliders can sit in the rail and are not obviously seized or missing\n- there is no damage likely to stop the curtain staying in place',
    ),
    item(
      4,
      'Rear doors / curtain end security',
      'Check the rear of the curtainsider.\n\nCheck that:\n- rear doors or the curtain end are closed and secured for travel\n- locking bars, cams or catches look engaged\n- seals and door edges are not obviously torn off or jammed open',
    ),
    item(
      5,
      'Roof / curtain body visible condition',
      'Look at the roof and curtain body from ground level.\n\nCheck that:\n- the roof is not obviously collapsed, torn or lifting\n- there are no loose roof sticks, boards or panels likely to fall off\n- the curtain body is not snagged on the chassis or rubbing a tyre',
    ),
  ],
  Box: [],
  Reefer: [
    item(
      1,
      'Refrigeration unit visible condition',
      'Look at the refrigeration unit from the ground.\n\nCheck that:\n- the unit housing is intact and not hanging off\n- guards, covers and visible parts are present\n- there is no obvious impact damage that would stop you using the trailer safely\n\nThis is a visual walkaround check, not a temperature-compliance certificate.',
    ),
    item(
      2,
      'Refrigeration unit secure mounting',
      'Check that the refrigeration unit is mounted securely on the trailer.\n\nCheck that:\n- mountings and brackets look tight and complete\n- the unit is not shifted, twisted or resting at an angle\n- there are no missing bolts or cracked mounts you can see',
    ),
    item(
      3,
      'Temperature display / controls',
      'Look at the temperature display and controls if they are visible from the ground.\n\nCheck that:\n- the display/control panel is present and not smashed or hanging off\n- you can see whether the unit appears powered or in a set mode, if a display is showing\n- switches and covers are not broken off\n\nDo not treat this as proof that the load is at the correct temperature.',
    ),
    item(
      4,
      'Doors and seals',
      'Check reefer doors and the seals you can see.\n\nCheck that:\n- doors close and the locking gear looks engaged\n- seals are present, not torn off, and not folded back\n- door hinges and keepers are not obviously loose',
    ),
    item(
      5,
      'Drainage / visible leakage',
      'Look under and around the reefer body for leaks.\n\nCheck that:\n- drain tubes/outlets are not ripped off or blocked with obvious debris where you can see them\n- there is no unexpected pool of fluid under the unit or body\n- melt-water is not running onto electrical connections or the road in an unsafe way',
    ),
    item(
      6,
      'Refrigeration fuel / power connections where fitted',
      'If the unit has a fuel tank, fuel cap or electrical power lead, check what you can see.\n\nCheck that:\n- the fuel cap is fitted and the tank is not obviously leaking\n- power leads/plugs are not crushed, bare or trailing on the ground\n- connections look seated and are not hanging loose',
    ),
    item(
      7,
      'Interior temperature/load-area condition where visible',
      'If a door is open or you can see inside safely, look at the load area.\n\nCheck that:\n- the floor and walls are not obviously damaged in a way that would let the load move\n- there is no heavy ice build-up blocking doors or drains\n- nothing is jammed in the door opening\n\nDo not climb into an unsafe load space to complete this check.',
    ),
  ],
  Bulk: [
    item(
      1,
      'Tank / vessel visible condition',
      'Walk around the tank or vessel.\n\nCheck that:\n- the shell is not obviously dented, cracked or holed where you can see it\n- supports and cradle mounts look secure\n- there is no unexpected product staining that suggests a leak\n\nThis is a visual check, not a pressure test or engineering inspection.',
    ),
    item(
      2,
      'Manlids and hatches secure',
      'Check manlids and hatches from the ground, or from a safe walkway if already in place.\n\nCheck that:\n- lids/hatches look closed for travel\n- clamps, bolts or catches are in place\n- nothing is left open that could spill product or come off',
    ),
    item(
      3,
      'Discharge valves secure',
      'Look at discharge valves and their handles.\n\nCheck that:\n- valves appear closed and secured for travel\n- handles are not broken off or jammed open\n- there is no obvious drip from a valve body',
    ),
    item(
      4,
      'Product hoses condition and security',
      'Check product hoses that are carried on the trailer.\n\nCheck that:\n- hoses are stowed and not dragging on the ground\n- hose walls are not cut through, burst or badly crushed\n- couplings are not hanging loose',
    ),
    item(
      5,
      'Hose caps / blanks fitted',
      'Check caps and blanks on hose ends and unused outlets.\n\nCheck that:\n- caps/blanks are fitted where you would expect them\n- they look tight enough not to fall off\n- threads and faces are not packed with dirt that would stop a cap seating',
    ),
    item(
      6,
      'Pneumatic / air equipment visible condition',
      'Look at visible pneumatic or air equipment used for discharge.\n\nCheck that:\n- pipework and fittings are attached and not hanging off\n- there are no obvious air leaks you can hear or see at rest\n- guards and covers are in place',
    ),
    item(
      7,
      'Loading / discharge pipework secure',
      'Check loading and discharge pipework along the trailer.\n\nCheck that:\n- pipework is clipped or supported and not swinging free\n- there are no obvious cracks, crushed sections or missing supports\n- nothing is likely to catch on the road or another vehicle',
    ),
    item(
      8,
      'Access ladder / walkway / handrails',
      'Check access equipment you would use to reach the top of the vessel.\n\nCheck that:\n- ladders, walkways and handrails are attached\n- treads and rails are not bent, broken or missing\n- nothing is so damaged that it would be unsafe to use later',
    ),
  ],
  Tanker: [
    item(
      1,
      'Tank body visible condition',
      'Walk around the tank body.\n\nCheck that:\n- the tank is not obviously dented, cracked or holed where you can see it\n- barrel supports look secure\n- there is no unexpected wetness or staining that suggests a leak\n\nThis is a visual walkaround check, not an ADR paperwork or pressure-test check.',
    ),
    item(
      2,
      'Manlids / lids secure',
      'Check manlids and lids from a safe position.\n\nCheck that:\n- lids look closed for travel\n- clamps or catches are in place\n- nothing is left open that could spill or come off',
    ),
    item(
      3,
      'Valves and outlets secure',
      'Look at valves and outlets.\n\nCheck that:\n- valves appear closed and secured for travel\n- handles and actuators are not broken or jammed open\n- there is no obvious drip from an outlet',
    ),
    item(
      4,
      'Hoses secure and undamaged',
      'Check hoses carried on the tanker.\n\nCheck that:\n- hoses are stowed and not dragging\n- hose walls are not cut, burst or badly crushed\n- couplings are not hanging loose',
    ),
    item(
      5,
      'Caps / blanks fitted',
      'Check caps and blanks on unused outlets and hose ends.\n\nCheck that:\n- caps/blanks are fitted where you would expect them\n- they look secure enough not to fall off in transit',
    ),
    item(
      6,
      'Pipework secure',
      'Check visible pipework along the tanker.\n\nCheck that:\n- pipework is supported and not swinging free\n- there are no obvious cracks, crushed sections or missing clips\n- nothing is likely to catch on the road',
    ),
    item(
      7,
      'Access ladder / walkway / handrails',
      'Check ladders, walkways and handrails.\n\nCheck that:\n- they are attached\n- treads and rails are not bent, broken or missing\n- they are not so damaged that later access would be unsafe',
    ),
    item(
      8,
      'Visible leakage',
      'Look under and around the tanker for product leaks.\n\nCheck that:\n- there are no drips, wet patches or fresh staining under valves, pipework or the barrel\n- the load is not leaking onto the road or chassis\n\nIf you can see a leak, do not move the vehicle until it is assessed.',
    ),
  ],
  Tipper: [
    item(
      1,
      'Tipping body security',
      'Look at how the tipping body sits on the trailer.\n\nCheck that:\n- the body is down and looks seated for travel\n- hinges and body mounts are not obviously cracked or missing\n- nothing is holding the body part-raised',
    ),
    item(
      2,
      'Tailgate / rear door locking',
      'Check the tailgate or rear door.\n\nCheck that:\n- it is closed for travel unless the load requires it to be set otherwise and that is clearly intended\n- locking pins, catches or chains look engaged\n- the tailgate is not hanging or swinging',
    ),
    item(
      3,
      'Hydraulic ram visible condition',
      'Look at the tipping ram from the ground.\n\nCheck that:\n- the ram is attached at both ends\n- there is no obvious bend, scoring you can see, or loose mounting\n- the ram is retracted for travel',
    ),
    item(
      4,
      'Hydraulic hoses / visible leaks',
      'Check hydraulic hoses and unions you can see.\n\nCheck that:\n- hoses are not cut, burst or rubbing through\n- there are no fresh hydraulic leaks on the chassis, body or ground\n- hoses are clipped and not hanging in the wheels',
    ),
    item(
      5,
      'Body resting correctly on chassis',
      'Check that the body is resting correctly on the chassis for travel.\n\nCheck that:\n- packers/stops are in place where fitted\n- the body is not twisted or sitting on one side\n- nothing is trapped between body and chassis',
    ),
    item(
      6,
      'Tipping controls secure',
      'Check tipping controls.\n\nCheck that:\n- controls are in the travel/off position\n- levers, switches or pendants are not broken or left where they could be knocked\n- any isolator looks set for travel if you can see it',
    ),
    item(
      7,
      'Sheeting system visible condition where fitted',
      'If a sheet or sheeting system is fitted, check what you can see.\n\nCheck that:\n- the sheet is on and secured, or stowed, as required for this load\n- arms, motors and straps are not hanging loose\n- the sheet is not torn off or likely to catch the wind',
    ),
  ],
  Flatbed: [
    item(
      1,
      'Headboard / front bulkhead condition',
      'Check the headboard or front bulkhead.\n\nCheck that:\n- it is attached and not bent over or cracked at the mounts\n- it is high/strong enough in appearance for the load you can see\n- there are no missing boards or large holes',
    ),
    item(
      2,
      'Load restraint anchor points',
      'Look at the lashing rings, tracks or anchor points on the deck and sides.\n\nCheck that:\n- anchor points are present and not ripped out of the deck\n- rings/tracks are not obviously cracked or seized open\n- you are not using this item to re-check how the load itself is secured — that remains the combination load-security check',
    ),
    item(
      3,
      'Deck condition',
      'Look at the trailer deck.\n\nCheck that:\n- boards or plate are not missing, collapsed or with large holes\n- the deck is not so rotten or bent that the load could fall through\n- there are no large objects loose on the empty parts of the deck',
    ),
    item(
      4,
      'Side posts / sockets where fitted',
      'If side posts or pockets/sockets are fitted, check them.\n\nCheck that:\n- posts are in and secured, or removed and stowed\n- sockets are not torn out of the chassis\n- nothing is left loose in a pocket',
    ),
    item(
      5,
      'Ramps or detachable equipment secure where fitted',
      'If ramps, skids or other detachable kit are carried, check they are secured.\n\nCheck that:\n- ramps are locked or strapped for travel\n- pins and catches are in place\n- nothing is likely to slide off the rear',
    ),
  ],
  'Low Loader': [
    item(
      1,
      'Loading ramps condition',
      'Check the loading ramps.\n\nCheck that:\n- ramps are not cracked, bent or missing sections\n- hinge points look attached\n- ramps are up and stowed for travel unless you are loading now',
    ),
    item(
      2,
      'Ramp locking pins / restraints',
      'Check ramp locking pins and restraints.\n\nCheck that:\n- pins/catches are in for travel\n- R-clips or keepers are present where fitted\n- ramps cannot drop onto the road',
    ),
    item(
      3,
      'Deck condition',
      'Look at the low-loader deck.\n\nCheck that:\n- the deck is not collapsed, with large holes, or obviously twisted\n- plates/boards are attached\n- there is no large debris that would stop a safe load later',
    ),
    item(
      4,
      'Load restraint anchor points',
      'Check lashing points on the deck and chassis.\n\nCheck that:\n- rings, pockets or tracks are present and not ripped out\n- they are not obviously cracked\n- this does not replace the combination Security of load check',
    ),
    item(
      5,
      'Outriggers / widening extensions secure where fitted',
      'If outriggers or widening extensions are fitted, check they are set and locked for this journey.\n\nCheck that:\n- extensions are in or out as intended and locked\n- pins are in place\n- nothing is sliding or hanging',
    ),
    item(
      6,
      'Detachable neck / locking mechanism where fitted',
      'If the trailer has a detachable neck, check the locking mechanism you can see.\n\nCheck that:\n- the neck looks coupled and locked for travel\n- locking pins/handles are in the travel position\n- there is no obvious gap or misalignment at the joint',
    ),
    item(
      7,
      'Loose equipment secured',
      'Check loose equipment carried on the low loader.\n\nCheck that:\n- chains, mats, ramps, toolboxes and packing are stowed and secured\n- nothing can fall onto the road\n- walkways and control boxes are shut',
    ),
  ],
  Other: [],
}

export type DrevoraRecommendedVehicleType =
  | 'Volumetric Concrete Mixer'
  | 'Concrete Mixer Drum'
  | 'Concrete Pump'
  | 'Tipper'
  | 'Grab Lorry'
  | 'Skip Lorry'
  | 'Hook Loader'
  | 'RoRo / Roll-on Roll-off'
  | 'Tanker'
  | 'Fuel Tanker'
  | 'Water Tanker'
  | 'Waste Tanker'
  | 'Refrigerated Vehicle'
  | 'Low Loader'
  | 'Plant / Machinery'
  | 'Forklift'
  | 'Telehandler'

/**
 * DREVORA Recommended packs by powered `vehicles.vehicle_type`.
 * Not DVSA mandatory. Bundled for offline composition. Maximum 10 items per type.
 * Box Lorry, Curtain Side Lorry, Flatbed Lorry and standard
 * rigid/van/car types have no pack. Generic Tanker has its own pack.
 */
export const DREVORA_RECOMMENDED_VEHICLE_PACKS: Record<
  DrevoraRecommendedVehicleType,
  RecommendedItem[]
> = {
  'Volumetric Concrete Mixer': [
    item(
      1,
      'Aggregate hopper condition',
      'Look at the aggregate hoppers from the ground.\n\nCheck that:\n- hopper bodies and supports are attached and not obviously holed or collapsed\n- covers/grids are in place where fitted\n- nothing is hanging off that could fall on the road\n\nThis is a recommended visual check, not a DVSA-required extra test.',
    ),
    item(
      2,
      'Conveyor belt condition and tracking',
      'Look at the conveyor belt you can see.\n\nCheck that:\n- the belt is on the rollers and not torn through\n- tracking looks roughly central, not walking off the side\n- there is no large rip or missing section',
    ),
    item(
      3,
      'Conveyor guards and safety devices',
      'Check guards and visible safety devices on the conveyor.\n\nCheck that:\n- guards are fitted and not hanging loose\n- emergency stops/covers you can see are present\n- nothing has been left removed for travel',
    ),
    item(
      4,
      'Cement / powder hopper and covers secure',
      'Check the cement or powder hopper.\n\nCheck that:\n- the hopper is mounted securely\n- lids/covers are closed for travel\n- there is no obvious split or leak of powder onto the chassis or road',
    ),
    item(
      5,
      'Water / admixture equipment visible condition',
      'Look at water and admixture tanks, pipes and pumps you can see.\n\nCheck that:\n- tanks are strapped/mounted\n- caps are fitted\n- there are no obvious leaks or crushed hoses',
    ),
    item(
      6,
      'Mixing auger / discharge equipment condition',
      'Check the mixing auger and discharge equipment from a safe position.\n\nCheck that:\n- the auger housing is attached\n- discharge gear is not hanging off\n- nothing is jammed in the discharge path',
    ),
    item(
      7,
      'Hydraulic hoses and visible leaks around mixer equipment',
      'Look at hydraulic hoses on the mixer equipment only — not the engine bay fuel/oil check.\n\nCheck that:\n- hoses are clipped and not rubbing through\n- there are no fresh hydraulic leaks on the mixer gear or ground\n- couplings are not hanging loose',
    ),
    item(
      8,
      'Chutes / discharge equipment secure',
      'Check chutes and discharge kit for travel.\n\nCheck that:\n- chutes are folded/stowed and locked\n- pins and catches are in\n- nothing can swing out into traffic',
    ),
  ],
  'Concrete Mixer Drum': [
    item(
      1,
      'Mixer drum visible condition',
      'Walk around the mixer drum.\n\nCheck that:\n- the drum is mounted and not obviously holed, split or sitting at an angle\n- rollers/supports you can see are in place\n- there is no large build-up likely to fall off\n\nThis is a recommended visual check, not a DVSA-required extra test.',
    ),
    item(
      2,
      'Drum rotation / drive equipment visible condition',
      'Look at the drum drive equipment you can see.\n\nCheck that:\n- the drive motor/gear is attached\n- guards are in place\n- nothing is hanging off the drive',
    ),
    item(
      3,
      'Chutes secure and undamaged',
      'Check the discharge chutes.\n\nCheck that:\n- chute sections are present and not cracked through\n- they are stowed for travel\n- nothing is dragging on the ground',
    ),
    item(
      4,
      'Chute locking / retention',
      'Check chute locks and retainers.\n\nCheck that:\n- locking pins, catches or chains are in for travel\n- the chute cannot swing out\n- keepers are present where fitted',
    ),
    item(
      5,
      'Access ladder / platform / handrails',
      'Check access to the drum area.\n\nCheck that:\n- ladders, platforms and handrails are attached\n- treads and rails are not bent, broken or missing\n- they are not so damaged that later access would be unsafe',
    ),
    item(
      6,
      'Water tank / wash-down equipment secure',
      'Check the water tank and wash-down equipment.\n\nCheck that:\n- the tank is mounted and the cap is fitted\n- hoses/guns are stowed\n- there is no obvious leak onto the road',
    ),
    item(
      7,
      'Mixer hydraulic equipment visible condition',
      'Look at mixer hydraulics from the ground.\n\nCheck that:\n- hoses and rams on the mixer are attached\n- there are no fresh hydraulic leaks around the mixer gear\n- this does not replace the cab/engine fuel and oil leak check',
    ),
  ],
  'Concrete Pump': [
    item(
      1,
      'Pump boom visible condition',
      'Look at the pump boom in the travel position.\n\nCheck that:\n- boom sections are folded as they should be for travel\n- there is no obvious crack, bend or hanging section\n- this is a visual check, not a structural/load test',
    ),
    item(
      2,
      'Boom transport locks / restraints',
      'Check boom transport locks.\n\nCheck that:\n- locks/pins are in for travel\n- the boom cannot unfold on the road\n- keepers are present where fitted',
    ),
    item(
      3,
      'Outriggers / stabilisers secure for travel',
      'Check outriggers and stabilisers.\n\nCheck that:\n- they are fully in and locked for travel\n- feet/pads are stowed\n- nothing is left extended',
    ),
    item(
      4,
      'Delivery pipework / clamps secure',
      'Check delivery pipes and clamps on the vehicle.\n\nCheck that:\n- pipes are clipped or racked\n- clamps/gaskets you can see are in place\n- nothing is hanging in the wheels',
    ),
    item(
      5,
      'Hopper / grate / guards secure',
      'Check the hopper, grate and guards.\n\nCheck that:\n- the hopper is closed/covered for travel if that is how this vehicle is set\n- grate and guards are fitted\n- nothing is left open that could spill',
    ),
    item(
      6,
      'Hydraulic hoses and visible leaks',
      'Look at pump hydraulics from the ground.\n\nCheck that:\n- hoses are not burst, cut or rubbing through\n- there are no fresh hydraulic leaks\n- this does not replace the engine fuel/oil leak check',
    ),
    item(
      7,
      'Remote/control equipment secured for travel',
      'Check the remote and controls.\n\nCheck that:\n- the remote is in its holder or cab, not loose on the deck\n- pendants/leads are not trailing\n- panels are shut',
    ),
    item(
      8,
      'Loose pump accessories secured',
      'Check pipes, reducers, clips and tools carried on the pump.\n\nCheck that:\n- they are racked or strapped\n- nothing can fall onto the road\n- hopper tools are stowed',
    ),
  ],
  Tipper: [
    item(
      1,
      'Tipping body security',
      'Look at how the tipping body sits on the chassis.\n\nCheck that:\n- the body is down and looks seated for travel\n- hinges and body mounts are not obviously cracked or missing\n- nothing is holding the body part-raised\n\nThis is a recommended visual check, not a DVSA-required extra test.',
    ),
    item(
      2,
      'Tailgate / rear door locking',
      'Check the tailgate or rear door.\n\nCheck that:\n- it is closed for travel unless the load requires it to be set otherwise and that is clearly intended\n- locking pins, catches or chains look engaged\n- the tailgate is not hanging or swinging',
    ),
    item(
      3,
      'Hydraulic ram visible condition',
      'Look at the tipping ram from the ground.\n\nCheck that:\n- the ram is attached at both ends\n- there is no obvious bend or loose mounting\n- the ram is retracted for travel',
    ),
    item(
      4,
      'Hydraulic hoses / visible leaks',
      'Check tipping hydraulic hoses and unions you can see.\n\nCheck that:\n- hoses are not cut, burst or rubbing through\n- there are no fresh hydraulic leaks on the chassis, body or ground\n- this does not replace the engine fuel and oil leak check',
    ),
    item(
      5,
      'Body resting correctly on chassis',
      'Check that the body is resting correctly on the chassis for travel.\n\nCheck that:\n- packers/stops are in place where fitted\n- the body is not twisted or sitting on one side\n- nothing is trapped between body and chassis',
    ),
    item(
      6,
      'Tipping controls secure',
      'Check tipping controls.\n\nCheck that:\n- controls are in the travel/off position\n- levers, switches or pendants are not broken or left where they could be knocked\n- any isolator looks set for travel if you can see it',
    ),
    item(
      7,
      'Sheeting system visible condition where fitted',
      'If a sheet or sheeting system is fitted, check what you can see.\n\nCheck that:\n- the sheet is on and secured, or stowed, as required for this load\n- arms, motors and straps are not hanging loose\n- the sheet is not torn off or likely to catch the wind',
    ),
  ],
  'Grab Lorry': [
    item(
      1,
      'Grab / bucket secure for travel',
      'Check the grab or bucket.\n\nCheck that:\n- it is in the travel rest or folded in\n- it is not swinging free\n- teeth/edges are not likely to catch another vehicle\n\nThis is a recommended visual check, not a lifting-examination certificate.',
    ),
    item(
      2,
      'Crane boom transport position',
      'Look at the crane boom.\n\nCheck that:\n- it is folded/stowed for travel\n- it is not left part-extended over the road\n- there is no obvious damage you can see from the ground',
    ),
    item(
      3,
      'Crane/grab locking or restraint',
      'Check travel locks and restraints.\n\nCheck that:\n- boom/grab locks or rest pins are in\n- the crane cannot swing out in transit\n- keepers are present where fitted',
    ),
    item(
      4,
      'Stabiliser legs / outriggers secured',
      'Check stabiliser legs and outriggers.\n\nCheck that:\n- they are fully in and locked for travel\n- feet/pads are stowed\n- nothing is left extended',
    ),
    item(
      5,
      'Hydraulic hoses / visible leaks',
      'Look at crane/grab hydraulics from the ground.\n\nCheck that:\n- hoses are not burst, cut or rubbing through\n- there are no fresh hydraulic leaks\n- this does not replace the engine fuel/oil leak check',
    ),
    item(
      6,
      'Grab pins / visible attachments',
      'Check grab pins and visible attachments.\n\nCheck that:\n- pins are in and retainers are fitted\n- the grab is not hanging on a damaged pin\n- quick-hitches look locked if you can see them',
    ),
    item(
      7,
      'Remote/control equipment secured',
      'Check the remote and controls.\n\nCheck that:\n- the remote is stowed, not loose on the body\n- leads are not trailing\n- panels are shut',
    ),
    item(
      8,
      'Loose crane accessories secured',
      'Check chains, slings, buckets and tools carried on the vehicle.\n\nCheck that:\n- they are racked or strapped\n- nothing can fall onto the road',
    ),
  ],
  'Skip Lorry': [
    item(
      1,
      'Lifting arms / lifting gear visible condition',
      'Look at the skip lifting arms and gear.\n\nCheck that:\n- arms are attached and not obviously bent or cracked at the mounts\n- they are in the travel position\n- this is a visual check, not a lifting-examination certificate',
    ),
    item(
      2,
      'Chains / hooks / attachment points',
      'Check chains, hooks and attachment points you can see.\n\nCheck that:\n- chains/hooks are present and not broken\n- they are stowed when not on a skip\n- attachment points are not ripped out',
    ),
    item(
      3,
      'Skip restraints / locking devices',
      'If a skip is on the vehicle, check it is restrained. If not, check the locks are ready and not damaged.\n\nCheck that:\n- skip locks/restraints look engaged when a skip is carried\n- locks are not broken or missing\n- the skip cannot slide off',
    ),
    item(
      4,
      'Hydraulic equipment visible condition',
      'Look at skip hydraulics from the ground.\n\nCheck that:\n- rams and hoses are attached\n- there are no fresh hydraulic leaks\n- this does not replace the engine fuel/oil leak check',
    ),
    item(
      5,
      'Stabiliser equipment where fitted',
      'If stabilisers are fitted, check they are in for travel.\n\nCheck that:\n- legs are retracted and locked\n- feet are stowed',
    ),
    item(
      6,
      'Rear lifting area clear / secure',
      'Look at the rear lifting area.\n\nCheck that:\n- nothing is jammed in the lift path\n- rear gear is not hanging off\n- do not use this item to re-check lights or the number plate',
    ),
    item(
      7,
      'Loose lifting equipment secured',
      'Check chains, bars and tools.\n\nCheck that:\n- they are stowed and secured\n- nothing can fall onto the road',
    ),
  ],
  'Hook Loader': [
    item(
      1,
      'Hook and hook-arm visible condition',
      'Look at the hook and hook-arm.\n\nCheck that:\n- the hook is attached and not obviously cracked or bent\n- the arm is in the travel position\n- this is a visual check, not an engineering inspection',
    ),
    item(
      2,
      'Body/container locking mechanism',
      'Check how the body or container is locked to the vehicle.\n\nCheck that:\n- locks look engaged if a body is on\n- lock parts are not broken or missing\n- the body cannot slide',
    ),
    item(
      3,
      'Rollers / guides visible condition',
      'Check rollers and guides.\n\nCheck that:\n- they are attached\n- they are not seized with an obvious break or missing roller\n- nothing is jammed in the track',
    ),
    item(
      4,
      'Hydraulic ram and hoses',
      'Look at hook-loader hydraulics from the ground.\n\nCheck that:\n- the ram is attached\n- hoses are not burst or rubbing through\n- there are no fresh hydraulic leaks',
    ),
    item(
      5,
      'Rear locking / restraint equipment',
      'Check rear locks and restraints.\n\nCheck that:\n- they look engaged when a body is carried\n- they are not hanging loose when empty',
    ),
    item(
      6,
      'Sheeting equipment where fitted',
      'If a sheet or sheeting system is fitted, check what you can see.\n\nCheck that:\n- the sheet is secured or stowed\n- arms and straps are not hanging loose',
    ),
    item(
      7,
      'Loose equipment secured',
      'Check bars, pins and tools.\n\nCheck that:\n- they are stowed and secured\n- nothing can fall onto the road',
    ),
  ],
  'RoRo / Roll-on Roll-off': [
    item(
      1,
      'Container/body locking system',
      'Check the container or body locking system.\n\nCheck that:\n- locks look engaged if a body is on\n- lock parts are not broken or missing\n- the body cannot roll off',
    ),
    item(
      2,
      'Lifting/tilting equipment visible condition',
      'Look at the lifting or tilting equipment.\n\nCheck that:\n- it is in the travel position\n- mounts are not obviously cracked\n- this is a visual check, not a load test',
    ),
    item(
      3,
      'Rollers / guides',
      'Check rollers and guides.\n\nCheck that:\n- they are attached\n- they are not missing or obviously broken\n- nothing is jammed in the track',
    ),
    item(
      4,
      'Hydraulic equipment / visible leaks',
      'Look at RoRo hydraulics from the ground.\n\nCheck that:\n- rams and hoses are attached\n- there are no fresh hydraulic leaks\n- this does not replace the engine fuel/oil leak check',
    ),
    item(
      5,
      'Rear restraints / locks',
      'Check rear restraints and locks.\n\nCheck that:\n- they look engaged when a body is carried\n- they are not hanging loose when empty',
    ),
    item(
      6,
      'Sheeting system where fitted',
      'If a sheet or sheeting system is fitted, check what you can see.\n\nCheck that:\n- the sheet is secured or stowed\n- arms and straps are not hanging loose',
    ),
    item(
      7,
      'Loose equipment secured',
      'Check bars, pins and tools.\n\nCheck that:\n- they are stowed and secured\n- nothing can fall onto the road',
    ),
  ],
  Tanker: [
    item(
      1,
      'Tank body visible condition',
      'Walk around the tank body on this powered tanker.\n\nCheck that:\n- the tank is not obviously dented, cracked or holed where you can see it\n- barrel supports and mounts look secure\n- there is no unexpected wetness or staining that suggests a leak\n\nThis is a visual walkaround check, not a pressure test or specialist engineering inspection.',
    ),
    item(
      2,
      'Manlids / lids secure',
      'Check manlids and lids from a safe position on the ground, or from a walkway already in place.\n\nCheck that:\n- lids look closed for travel\n- clamps, bolts or catches are in place\n- nothing is left open that could spill or come off',
    ),
    item(
      3,
      'Valves and outlets secure',
      'Look at valves and outlets on the tanker equipment.\n\nCheck that:\n- valves appear closed and secured for travel\n- handles and actuators are not broken or jammed open\n- there is no obvious drip from an outlet',
    ),
    item(
      4,
      'Hoses secure and undamaged',
      'Check hoses carried on this tanker.\n\nCheck that:\n- hoses are stowed and not dragging on the ground\n- hose walls are not cut, burst or badly crushed\n- couplings are not hanging loose',
    ),
    item(
      5,
      'Caps / blanks fitted',
      'Check caps and blanks on unused outlets and hose ends.\n\nCheck that:\n- caps/blanks are fitted where you would expect them\n- they look secure enough not to fall off in transit\n- unused connections are not left open',
    ),
    item(
      6,
      'Pipework secure',
      'Check visible pipework along the tanker.\n\nCheck that:\n- pipework is supported and not swinging free\n- there are no obvious cracks, crushed sections or missing clips\n- nothing is likely to catch on the road or another vehicle',
    ),
    item(
      7,
      'Access ladder / walkway / handrails',
      'Check ladders, walkways and handrails used to reach the tank.\n\nCheck that:\n- they are attached\n- treads and rails are not bent, broken or missing\n- they are not so damaged that later access would be unsafe',
    ),
    item(
      8,
      'Visible leakage',
      'Look under and around the tanker for product leaks.\n\nCheck that:\n- there are no drips, wet patches or fresh staining under valves, pipework or the barrel\n- the load is not leaking onto the road or chassis\n- this does not replace the engine fuel and oil leak check\n\nIf you can see a leak, do not move the vehicle until it is assessed.',
    ),
  ],
  'Fuel Tanker': [
    item(
      1,
      'Tank body visible condition',
      'Walk around the tank body.\n\nCheck that:\n- the tank is not obviously dented, cracked or holed where you can see it\n- supports look secure\n- there is no unexpected wetness or staining that suggests a leak\n\nThis is a visual walkaround check, not an ADR paperwork or pressure-test check.',
    ),
    item(
      2,
      'Manlids / lids secure',
      'Check manlids and lids from a safe position.\n\nCheck that:\n- lids look closed for travel\n- clamps or catches are in place\n- nothing is left open that could spill or come off',
    ),
    item(
      3,
      'Valves / outlets secure',
      'Look at valves and outlets.\n\nCheck that:\n- valves appear closed and secured for travel\n- handles are not broken or jammed open\n- there is no obvious drip from an outlet',
    ),
    item(
      4,
      'Hoses secure and undamaged',
      'Check hoses carried on the tanker.\n\nCheck that:\n- hoses are stowed and not dragging\n- hose walls are not cut, burst or badly crushed\n- couplings are not hanging loose',
    ),
    item(
      5,
      'Caps / blanks fitted',
      'Check caps and blanks on unused outlets and hose ends.\n\nCheck that:\n- caps/blanks are fitted where you would expect them\n- they look secure enough not to fall off in transit',
    ),
    item(
      6,
      'Pipework secure',
      'Check visible pipework along the tanker.\n\nCheck that:\n- pipework is supported and not swinging free\n- there are no obvious cracks, crushed sections or missing clips',
    ),
    item(
      7,
      'Hose storage secure',
      'Check hose trays, reels or lockers.\n\nCheck that:\n- hoses are in the storage and the door/strap is shut\n- nothing can fall onto the road',
    ),
    item(
      8,
      'Visible product leakage',
      'Look under and around the tanker for product leaks.\n\nCheck that:\n- there are no drips, wet patches or fresh staining under valves, pipework or the barrel\n- this does not replace the engine fuel and oil leak check\n\nIf you can see a product leak, do not move the vehicle until it is assessed.',
    ),
  ],
  'Water Tanker': [
    item(
      1,
      'Tank body visible condition',
      'Walk around the tank body.\n\nCheck that:\n- the tank is not obviously dented, cracked or holed where you can see it\n- supports look secure\n- there is no unexpected wetness that suggests a leak',
    ),
    item(
      2,
      'Manlids / covers secure',
      'Check manlids and covers.\n\nCheck that:\n- they look closed for travel\n- clamps or catches are in place',
    ),
    item(
      3,
      'Valves / outlets secure',
      'Look at valves and outlets.\n\nCheck that:\n- valves appear closed and secured for travel\n- handles are not broken or jammed open',
    ),
    item(
      4,
      'Hoses secure',
      'Check hoses carried on the tanker.\n\nCheck that:\n- hoses are stowed and not dragging\n- couplings are not hanging loose',
    ),
    item(
      5,
      'Caps / blanks fitted',
      'Check caps and blanks on unused outlets and hose ends.\n\nCheck that:\n- they are fitted where you would expect them\n- they look secure enough not to fall off',
    ),
    item(
      6,
      'Pipework secure',
      'Check visible pipework.\n\nCheck that:\n- it is supported and not swinging free\n- there are no obvious crushed sections or missing clips',
    ),
    item(
      7,
      'Visible leakage',
      'Look under and around the tanker.\n\nCheck that:\n- there are no drips or wet patches under valves, pipework or the tank\n- this does not replace the engine fuel and oil leak check',
    ),
  ],
  'Waste Tanker': [
    item(
      1,
      'Tank body visible condition',
      'Walk around the tank body.\n\nCheck that:\n- the tank is not obviously dented, cracked or holed where you can see it\n- supports look secure\n- there is no unexpected staining that suggests a leak',
    ),
    item(
      2,
      'Manlids / covers secure',
      'Check manlids and covers.\n\nCheck that:\n- they look closed for travel\n- clamps or catches are in place',
    ),
    item(
      3,
      'Suction/discharge valves secure',
      'Look at suction and discharge valves.\n\nCheck that:\n- valves appear closed and secured for travel\n- handles are not broken or jammed open\n- there is no obvious drip',
    ),
    item(
      4,
      'Hoses secure and undamaged',
      'Check suction and discharge hoses.\n\nCheck that:\n- hoses are stowed and not dragging\n- hose walls are not cut, burst or badly crushed\n- couplings are not hanging loose',
    ),
    item(
      5,
      'Caps / blanks fitted',
      'Check caps and blanks on unused outlets and hose ends.\n\nCheck that:\n- they are fitted where you would expect them\n- they look secure enough not to fall off',
    ),
    item(
      6,
      'Suction / discharge pipework secure',
      'Check suction and discharge pipework.\n\nCheck that:\n- pipework is supported and not swinging free\n- there are no obvious crushed sections or missing clips',
    ),
    item(
      7,
      'Hose storage secure',
      'Check hose trays, reels or lockers.\n\nCheck that:\n- hoses are in the storage and the door/strap is shut\n- nothing can fall onto the road',
    ),
    item(
      8,
      'Visible leakage / contamination around equipment',
      'Look under and around the tanker equipment.\n\nCheck that:\n- there are no drips or fresh product around valves, hoses or the tank\n- waste is not leaking onto the road\n- this does not replace the engine fuel and oil leak check',
    ),
  ],
  'Refrigerated Vehicle': [
    item(
      1,
      'Refrigeration unit visible condition',
      'Look at the refrigeration unit from the ground.\n\nCheck that:\n- the unit housing is intact and not hanging off\n- guards and covers are present\n- there is no obvious impact damage\n\nThis is a visual walkaround check, not a food-temperature certificate.',
    ),
    item(
      2,
      'Refrigeration unit secure mounting',
      'Check that the refrigeration unit is mounted securely.\n\nCheck that:\n- mountings and brackets look tight and complete\n- the unit is not shifted or twisted\n- there are no missing bolts or cracked mounts you can see',
    ),
    item(
      3,
      'Temperature display / controls',
      'Look at the temperature display and controls if they are visible from the ground.\n\nCheck that:\n- the display/control panel is present and not smashed or hanging off\n- switches and covers are not broken off\n- do not treat this as proof that the load is at the correct temperature',
    ),
    item(
      4,
      'Load-area doors and seals',
      'Check load-area doors and the seals you can see.\n\nCheck that:\n- doors close and the locking gear looks engaged\n- seals are present, not torn off, and not folded back\n- this is separate from the generic cab/body security check',
    ),
    item(
      5,
      'Drainage / visible leakage',
      'Look under and around the body for leaks.\n\nCheck that:\n- drain tubes/outlets are not ripped off where you can see them\n- there is no unexpected pool of fluid under the unit or body',
    ),
    item(
      6,
      'Refrigeration fuel / power connections where fitted',
      'If the unit has a fuel tank, fuel cap or electrical power lead, check what you can see.\n\nCheck that:\n- the fuel cap is fitted and the tank is not obviously leaking\n- power leads/plugs are not crushed, bare or trailing\n- this does not replace the vehicle engine fuel and oil leak check',
    ),
    item(
      7,
      'Load-area temperature condition where visible',
      'If a door is open or you can see inside safely, look at the load area.\n\nCheck that:\n- the floor and walls are not obviously damaged in a way that would let the load move\n- there is no heavy ice build-up blocking doors or drains\n- do not climb into an unsafe load space\n\nThis is not temperature-compliance certification.',
    ),
  ],
  'Low Loader': [
    item(
      1,
      'Loading ramps condition',
      'Check the loading ramps on this powered low loader.\n\nCheck that:\n- ramps are not cracked, bent or missing sections\n- hinge points look attached\n- ramps are up and stowed for travel unless you are loading now\n\nThis pack is for vehicle_type Low Loader, not a trailer_type Low Loader.',
    ),
    item(
      2,
      'Ramp locks / restraints',
      'Check ramp locks and restraints.\n\nCheck that:\n- pins/catches are in for travel\n- keepers are present where fitted\n- ramps cannot drop onto the road',
    ),
    item(
      3,
      'Deck condition',
      'Look at the deck.\n\nCheck that:\n- the deck is not collapsed, with large holes, or obviously twisted\n- plates/boards are attached',
    ),
    item(
      4,
      'Load restraint anchor points',
      'Check lashing points on the deck and chassis.\n\nCheck that:\n- rings, pockets or tracks are present and not ripped out\n- they are not obviously cracked\n- this does not replace the DVSA Security of load check',
    ),
    item(
      5,
      'Outriggers / extensions secure where fitted',
      'If outriggers or widening extensions are fitted, check they are locked for this journey.\n\nCheck that:\n- extensions are in or out as intended and locked\n- pins are in place',
    ),
    item(
      6,
      'Loose loading equipment secured',
      'Check chains, mats, ramps and packing.\n\nCheck that:\n- they are stowed and secured\n- nothing can fall onto the road',
    ),
  ],
  'Plant / Machinery': [
    item(
      1,
      'Operator access / steps / handholds',
      'Check steps and handholds used to get on the machine.\n\nCheck that:\n- they are attached\n- treads and handles are not bent, broken or missing\n- keep this generic — not every machine has the same cab',
    ),
    item(
      2,
      'Guards / covers secure',
      'Check guards and covers you can see.\n\nCheck that:\n- they are fitted and latched\n- nothing is left off that would leave moving parts exposed on the road or in use',
    ),
    item(
      3,
      'Attachments secure for travel/use',
      'Check buckets, forks or other attachments fitted to this machine.\n\nCheck that:\n- they are coupled and look locked\n- they are in a sensible travel position if the machine will move\n- this is not a lifting-examination certificate',
    ),
    item(
      4,
      'Hydraulic hoses / visible leaks',
      'Look at hydraulic hoses from the ground.\n\nCheck that:\n- hoses are not burst, cut or rubbing through\n- there are no fresh hydraulic leaks\n- this does not replace a generic engine fuel/oil leak check where that item applies',
    ),
    item(
      5,
      'Loose equipment secured',
      'Check tools, pins and packing on the machine.\n\nCheck that:\n- they are stowed and secured\n- nothing can fall off in transit or during use',
    ),
    item(
      6,
      'Warning devices / beacon where fitted',
      'If a beacon, travel alarm or similar warning device is fitted, check what you can see.\n\nCheck that:\n- the beacon/lamp is attached and not smashed\n- it is not hanging off\n- do not treat this as a full lighting check — that remains the DVSA lights item where it applies',
    ),
  ],
  Forklift: [
    item(
      1,
      'Forks and fork heels visible condition',
      'Look at the forks and heels.\n\nCheck that:\n- forks are not obviously bent, cracked or worn through at the heel\n- they are not mismatched or missing\n- this is a visual check, not a fork-wear gauge inspection',
    ),
    item(
      2,
      'Carriage / mast visible condition',
      'Look at the carriage and mast.\n\nCheck that:\n- the mast is upright and attached\n- rollers/channels you can see are not obviously broken\n- nothing is jammed in the mast',
    ),
    item(
      3,
      'Lift chains visible condition',
      'Look at the lift chains you can see.\n\nCheck that:\n- chains are on the pulleys\n- there is no obvious broken link or severe rust-through\n- this is not a measured chain-wear inspection',
    ),
    item(
      4,
      'Hydraulic hoses / visible leaks',
      'Look at lift hydraulics from the ground.\n\nCheck that:\n- hoses are not burst, cut or rubbing through\n- there are no fresh hydraulic leaks',
    ),
    item(
      5,
      'Fork locking / retaining devices',
      'Check fork locks or retaining pins.\n\nCheck that:\n- locks/pins are in\n- forks cannot slide off the carriage',
    ),
    item(
      6,
      'Overhead guard / operator protection',
      'Check the overhead guard and operator protection.\n\nCheck that:\n- the guard is attached\n- it is not bent down onto the operator position\n- seat/restraint looks usable if fitted',
    ),
    item(
      7,
      'Attachments secure where fitted',
      'If a side shift, rotator or other attachment is fitted, check it.\n\nCheck that:\n- it is coupled and looks locked\n- hoses to the attachment are not hanging in the wheels\n- this is not a LOLER certificate',
    ),
  ],
  Telehandler: [
    item(
      1,
      'Boom visible condition',
      'Look at the boom from the ground.\n\nCheck that:\n- the boom is attached and not obviously bent or cracked at the mounts\n- it is retracted/stowed as required for travel or yard use\n- this is a visual check, not a structural lifting inspection',
    ),
    item(
      2,
      'Forks / attachment secure',
      'Check forks or the fitted attachment.\n\nCheck that:\n- they are on the carriage and look locked\n- they are not obviously bent or cracked',
    ),
    item(
      3,
      'Attachment locking system',
      'Check the attachment locking system.\n\nCheck that:\n- pins/locks look engaged\n- the attachment cannot drop off\n- this is not a LOLER certificate',
    ),
    item(
      4,
      'Hydraulic hoses / visible leaks',
      'Look at boom and attachment hydraulics.\n\nCheck that:\n- hoses are not burst, cut or rubbing through\n- there are no fresh hydraulic leaks',
    ),
    item(
      5,
      'Stabiliser legs where fitted',
      'If stabiliser legs are fitted, check they are set correctly for this use or locked for travel.\n\nCheck that:\n- legs are in or out as intended and locked\n- feet are not missing',
    ),
    item(
      6,
      'Load chart present/visible where applicable',
      'If a load chart is fitted in the cab or on the boom, check you can see it.\n\nCheck that:\n- the chart is present and readable\n- it is not torn off or covered over\n- do not treat this as a calculated lifting plan',
    ),
    item(
      7,
      'Operator protection / access',
      'Check the cab, ROPS/FOPS if fitted, steps and handholds.\n\nCheck that:\n- access steps and handles are attached\n- the cab/guard is not obviously smashed in\n- the seat and door latch look usable',
    ),
  ],
}

const MAX_RECOMMENDED_ITEMS_PER_TYPE = 10

export function normalizeDrevoraRecommendedTrailerType(
  trailerType: string | null | undefined,
): DrevoraRecommendedTrailerType | null {
  const trimmed = trailerType?.trim()
  if (!trimmed) return null
  if (trimmed in DREVORA_RECOMMENDED_PACKS) {
    return trimmed as DrevoraRecommendedTrailerType
  }
  return null
}

export function getDrevoraRecommendedCheckItems(
  trailerType: string | null | undefined,
): RecommendedItem[] {
  const key = normalizeDrevoraRecommendedTrailerType(trailerType)
  if (!key) return []
  const pack = DREVORA_RECOMMENDED_PACKS[key] ?? []
  return pack.slice(0, MAX_RECOMMENDED_ITEMS_PER_TYPE).map((entry) => ({ ...entry }))
}

/** Used when reopening a saved check that already has Recommended answers. */
export function inferDrevoraRecommendedTrailerTypeFromLabels(
  labels: string[],
): DrevoraRecommendedTrailerType | null {
  if (labels.length === 0) return null
  const set = new Set(labels.map((label) => label.trim()).filter(Boolean))
  for (const type of Object.keys(DREVORA_RECOMMENDED_PACKS) as DrevoraRecommendedTrailerType[]) {
    const pack = DREVORA_RECOMMENDED_PACKS[type]
    if (pack.length === 0) continue
    if (pack.every((entry) => set.has(entry.label))) return type
  }
  return null
}

export function normalizeDrevoraRecommendedVehicleType(
  vehicleType: string | null | undefined,
): DrevoraRecommendedVehicleType | null {
  const trimmed = vehicleType?.trim()
  if (!trimmed) return null
  if (trimmed in DREVORA_RECOMMENDED_VEHICLE_PACKS) {
    return trimmed as DrevoraRecommendedVehicleType
  }
  return null
}

export function getDrevoraRecommendedVehicleCheckItems(
  vehicleType: string | null | undefined,
): RecommendedItem[] {
  const key = normalizeDrevoraRecommendedVehicleType(vehicleType)
  if (!key) return []
  const pack = DREVORA_RECOMMENDED_VEHICLE_PACKS[key] ?? []
  return pack.slice(0, MAX_RECOMMENDED_ITEMS_PER_TYPE).map((entry) => ({ ...entry }))
}
