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
} as const

type DeepStringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>
}

export type WorkerPhase1Resources = DeepStringRecord<typeof enWorker>
