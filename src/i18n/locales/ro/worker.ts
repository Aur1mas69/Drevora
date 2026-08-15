import type { WorkerPhase1Resources } from '../en/worker'

export const roWorker = {
  nav: {
    home: 'Acasă',
    timesheets: 'Pontaje',
    holidays: 'Cereri de concediu',
    holidaysShort: 'Concedii',
    holiday: 'Concediu',
    holidayRequest: 'Cerere',
    vehicles: 'Vehicule',
    documents: 'Documente',
    contacts: 'Contacte',
    notes: 'Note',
    settings: 'Setări',
  },
  settings: {
    title: 'Setări',
    preferences: 'Preferințe',
    appearance: 'Aspect',
    language: 'Limbă',
    light: 'Luminos',
    dark: 'Întunecat',
    loading: 'Se încarcă setările',
    languageSaving: 'Se salvează…',
    languageSaveError: 'Nu s-a putut salva limba.',
  },
} as const satisfies WorkerPhase1Resources
