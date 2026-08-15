import type { WorkerPhase1Resources } from '../en/worker'

export const ltWorker = {
  nav: {
    home: 'Pradžia',
    timesheets: 'Tabeliai',
    holidays: 'Atostogų prašymai',
    holidaysShort: 'Atostogos',
    holiday: 'Atostogos',
    holidayRequest: 'Prašymas',
    vehicles: 'Transportas',
    documents: 'Dokumentai',
    contacts: 'Kontaktai',
    notes: 'Užrašai',
    settings: 'Nustatymai',
  },
  settings: {
    title: 'Nustatymai',
    preferences: 'Nuostatos',
    appearance: 'Išvaizda',
    language: 'Kalba',
    light: 'Šviesi',
    dark: 'Tamsi',
    loading: 'Įkeliami nustatymai',
    languageSaving: 'Saugoma…',
    languageSaveError: 'Nepavyko išsaugoti kalbos.',
  },
} as const satisfies WorkerPhase1Resources
