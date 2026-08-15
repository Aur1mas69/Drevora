import type { WorkerPhase1Resources } from '../en/worker'

export const ruWorker = {
  nav: {
    home: 'Главная',
    timesheets: 'Табели',
    holidays: 'Заявки на отпуск',
    holidaysShort: 'Отпуска',
    holiday: 'Отпуск',
    holidayRequest: 'Заявка',
    vehicles: 'Транспорт',
    documents: 'Документы',
    contacts: 'Контакты',
    notes: 'Заметки',
    settings: 'Настройки',
  },
  settings: {
    title: 'Настройки',
    preferences: 'Предпочтения',
    appearance: 'Оформление',
    language: 'Язык',
    light: 'Светлая',
    dark: 'Тёмная',
    loading: 'Загрузка настроек',
    languageSaving: 'Сохранение…',
    languageSaveError: 'Не удалось сохранить язык.',
  },
} as const satisfies WorkerPhase1Resources
