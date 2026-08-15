import type { WorkerPhase1Resources } from '../en/worker'

export const plWorker = {
  nav: {
    home: 'Start',
    timesheets: 'Czas pracy',
    holidays: 'Wnioski urlopowe',
    holidaysShort: 'Urlopy',
    holiday: 'Urlop',
    holidayRequest: 'Wniosek',
    vehicles: 'Pojazdy',
    documents: 'Dokumenty',
    contacts: 'Kontakty',
    notes: 'Notatki',
    settings: 'Ustawienia',
  },
  settings: {
    title: 'Ustawienia',
    preferences: 'Preferencje',
    appearance: 'Wygląd',
    language: 'Język',
    light: 'Jasny',
    dark: 'Ciemny',
    loading: 'Ładowanie ustawień',
    languageSaving: 'Zapisywanie…',
    languageSaveError: 'Nie udało się zapisać języka.',
  },
} as const satisfies WorkerPhase1Resources
