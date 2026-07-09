import type { DefaultVehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'

const insideCabSection = 'Inside cab / front view'
const outsideVehicleSection = 'Outside vehicle'

const defaultItemFlags = {
  isRequired: true,
  allowNotes: true,
  allowPhoto: false,
  failOnDefect: true,
  isActive: true,
  isCustom: false,
} as const

/**
 * Standard DVSA HGV daily walkaround checklist used when no saved template exists
 * for a vehicle type. Labels are short row titles; descriptions are full DVSA guidance.
 */
export const DEFAULT_DVSA_VEHICLE_CHECK_ITEMS: DefaultVehicleCheckTemplateItem[] = [
  {
    section: insideCabSection,
    label: 'Front view, mirrors, cameras and glass',
    description:
      'Check that no objects get in the way of your front view.\n\nAs a general rule, there should be nothing in the swept area of the windscreen wipers.\n\nSome official stickers and road safety items are allowed, as long as they do not seriously block your view of the road, for example, operator licence disc.\n\nCheck that the windscreen is not cracked, scratched or discoloured.\n\nCheck that the windscreen and front side windows are not excessively tinted.\n\nCheck that all mirrors are in place and not damaged or missing glass, obscured or insecure.\n\nIf a camera system is used instead of a mirror, check that it works and the view is correct.',
    sortOrder: 1,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Windscreen wipers and washers',
    description:
      'Make sure the windscreen wipers work. Check that they are not missing, damaged or worn.\n\nMake sure the windscreen washer is working.',
    sortOrder: 2,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Dashboard warning lights and gauges',
    description:
      'Check that all of these are working correctly:\n\n- instruments\n- gauges\n- warning lights, including the engine warning, emissions system, anti-lock braking system (ABS) and electronic braking system (EBS)',
    sortOrder: 3,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Steering',
    description:
      'Check that the steering wheel moves properly and that the power-assisted steering works correctly.\n\nCheck that there is no excessive play and that it does not jam.\n\nCheck that there is no excessive lift or movement in the steering column.',
    sortOrder: 4,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Horn',
    description:
      'Check that the horn works and is easily accessible from the driver’s seat.',
    sortOrder: 5,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Brakes and air build-up',
    description:
      'Check that:\n\n- the air builds up correctly and the warning system works\n- there are no air leaks\n- the footwell is clear\n- the service brake operates both the tractor and trailer brakes\n- the parking brake for the tractor works\n- the service brake pedal does not have excessive side play or missing, loose or incomplete anti-slip tread',
    sortOrder: 6,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Height marker',
    description:
      'Check the correct vehicle height is displayed on the vehicle height marker in the cab.\n\nRemember, the height can change, for example, when the fifth wheel is adjusted, or if the trailer is loaded, unloaded or reloaded.',
    sortOrder: 7,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Seatbelts',
    description:
      'Check that seatbelts:\n\n- do not have any cuts, damage or fraying that may stop them from working\n- stay secure when you plug them in\n- retract against you when fitted, and fully retract when you take them off',
    sortOrder: 8,
    ...defaultItemFlags,
  },
  {
    section: insideCabSection,
    label: 'Cab, doors and steps',
    description:
      'Check that:\n\n- cab mountings and tilt devices are secure\n- body panels are secure and not likely to fall off\n- all doors operate as required and secure when closed\n- steps are secure and safe to use',
    sortOrder: 9,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Lights and indicators',
    description:
      'Check that:\n\n- all lights and indicators work correctly\n- all lenses are fitted, clean and the right colour\n- stop lamps come on when you apply the service brake and go out when you release it\n- marker lights are fitted and work',
    sortOrder: 10,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Fuel and oil leaks',
    description:
      'Check that the fuel filler cap is fitted correctly.\n\nTurn on the engine and check underneath the vehicle for any fuel or oil leaks.',
    sortOrder: 11,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Body, wings and guards security',
    description:
      'Check that:\n\n- all fastening devices work\n- cab doors and trailer doors are secure when closed\n- body panels on tractor or trailer are secure and not likely to fall off\n- landing legs (if fitted) are secure and not likely to fall off while driving\n- sideguards and rear under-run guards are fitted if required, and are not insecure or damaged',
    sortOrder: 12,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Battery security and condition',
    description:
      'Check that your battery is secure, in good condition and not leaking.',
    sortOrder: 13,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Diesel exhaust fluid / AdBlue',
    description:
      'Check that your diesel vehicle has enough AdBlue diesel exhaust fluid and top up if necessary.',
    sortOrder: 14,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Excessive engine exhaust smoke',
    description: 'Check that the exhaust does not emit an excessive amount of smoke.',
    sortOrder: 15,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'High voltage emergency cut-off switch',
    description:
      'Check that:\n\n- you know where the high voltage emergency cut-off switch is located\n- the high voltage emergency cut-off switch operates correctly\n- all high voltage electrical components are secure and not damaged',
    sortOrder: 16,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Alternative fuel systems and isolation',
    description:
      'Check that:\n\n- you know where the fuel isolation switch is located\n- there are no leaks from the system\n- all visible components are in good condition',
    sortOrder: 17,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Spray suppression',
    description:
      'If spray suppression flaps are required, check that they are fitted, secure, not damaged and not clogged with mud or debris.',
    sortOrder: 18,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Tyres and wheel fixing',
    description:
      'Check that:\n\n- the tyres and wheels are secure\n- the tyres have a tread depth of at least 1mm\n- the tyres are inflated correctly\n- there are no deep cuts in the tyre’s sidewall\n- there is no cord visible anywhere on the tyre\n- all wheel nuts are tight enough (wheel nut indicators can help if fitted)\n- there are no objects or debris trapped between twin wheels',
    sortOrder: 19,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Brake lines and trailer parking brake',
    description:
      'Check that:\n\n- couplings are free from debris and are in the right place\n- there are no leaks\n- there is no damage or wear to the brake lines\n- the parking brake for the trailer works\n\nAfter the initial brake test, leave the engine running so pressure can build up. This makes it easier to hear any leaks as you carry out the rest of the walkaround check.',
    sortOrder: 20,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Electrical connections',
    description:
      'Check each connection and make sure that:\n\n- visible wiring is insulated\n- visible wiring is not likely to get caught or damaged\n- all electrical trailer couplings are connected securely\n- all electrical switches work correctly',
    sortOrder: 21,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Coupling security',
    description:
      'Check that your vehicle is securely attached to your trailer and that:\n\n- the trailer is located correctly in the fifth wheel or coupling\n- the secondary locking devices are in the correct position',
    sortOrder: 22,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Security of load',
    description:
      'Check that the load does not move and is not likely to move.\n\nMake sure you use the right type of load securing system for the load.\n\nIf you are not happy with how the load is secured or how stable it is, ask the person in charge of vehicle safety to get a competent person to assess it and reload or resecure it if necessary.',
    sortOrder: 23,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Number plate',
    description:
      'Check that the number plate is not broken or incomplete, incorrect or spaced incorrectly, dirty, faded or covered over by anything.',
    sortOrder: 24,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Reflectors',
    description:
      'Check that the reflectors (including side reflectors) are not missing, broken, insecure, fitted incorrectly, the wrong colour or obscured by dirt or other objects.',
    sortOrder: 25,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Markings and warning plates',
    description:
      'Check that the vehicle’s markings (including conspicuity markings) are the right colour, visible, securely fastened and not obscured by dirt or other objects.\n\nIf the vehicle is carrying dangerous goods, check that the hazard information panels show the correct information for the load, are visible, securely fastened and not obscured by dirt or other objects.',
    sortOrder: 26,
    ...defaultItemFlags,
  },
  {
    section: outsideVehicleSection,
    label: 'Other equipment',
    description:
      'You might need to check other items specific to the vehicle, for example, loading or specialised equipment.',
    sortOrder: 27,
    ...defaultItemFlags,
  },
]

export function getDefaultDvsaVehicleCheckItems(): DefaultVehicleCheckTemplateItem[] {
  return DEFAULT_DVSA_VEHICLE_CHECK_ITEMS.map((item) => ({ ...item }))
}
