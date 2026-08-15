export const enWorker = {
  nav: {
    home: 'Home',
    timesheets: 'Timesheets',
    holidays: 'Holiday Requests',
    holidaysShort: 'Holidays',
    holiday: 'Holiday',
    holidayRequest: 'Request',
    vehicles: 'Vehicles',
    documents: 'Documents',
    contacts: 'Contacts',
    notes: 'Notes',
    settings: 'Settings',
  },
  settings: {
    title: 'Settings',
    preferences: 'Preferences',
    appearance: 'Appearance',
    language: 'Language',
    light: 'Light',
    dark: 'Dark',
    loading: 'Loading settings',
    languageSaving: 'Saving…',
    languageSaveError: 'Unable to save your language.',
  },
  home: {
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    greetingNight: 'Good night',
    workerFallback: 'Worker',
    heroTitle: 'Ready for the road?',
    defaultVehicle: 'Default vehicle',
    notSet: 'Not set',
    startVehicleCheck: 'Start Vehicle Check',
    vehicleCheck: 'Vehicle Check',
    timesheet: 'Timesheet',
    quickActions: 'Quick actions',
    loading: 'Loading worker home',
    profileMissingTitle: 'Worker profile',
    profileMissing:
      'We could not find a worker profile linked to your account. Please contact your manager.',
    offlineNotPrepared:
      'Connect to the internet once to prepare offline Vehicle Checks.',
    statusAria: 'Worker status',
    vehicleCheckCompletedToday: 'Completed today',
    vehicleCheckNotCompletedToday: 'Not completed today',
    timesheetOverdue: 'Overdue',
    timesheetSubmitted: 'Submitted',
    timesheetInProgress: 'In progress',
    defaultVehicleChanged: 'Default vehicle changed to {{registration}}',
    defaultVehicleChangeError: 'Unable to change default vehicle.',
    selectDefaultVehicle: 'Select default vehicle',
    closeSelectDefaultVehicle: 'Close select default vehicle',
    close: 'Close',
    activeVehiclesList: 'Active powered company vehicles',
    noActiveVehicles: 'No active powered vehicles available.',
  },
} as const

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>
}

export type WorkerPhase1Resources = DeepStringRecord<typeof enWorker>
