/** Static Worker User Guides — no Supabase required. */

export type SupportGuideTopicId =
  | 'getting-started'
  | 'timesheets'
  | 'holiday-requests'
  | 'vehicle-checks'
  | 'tyre-checks'
  | 'vehicles'
  | 'documents'
  | 'offline-vehicle-checks'
  | 'account-security'
  | 'using-safely'

export type SupportGuideTopic = {
  id: SupportGuideTopicId
  title: string
  shortDescription: string
  keywords: string[]
  steps: string[]
}

export const SUPPORT_GUIDE_TOPICS: SupportGuideTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    shortDescription: 'Sign in, Home, navigation, and online indicators.',
    keywords: ['login', 'home', 'navigation', 'default vehicle', 'offline'],
    steps: [
      'Sign in with the email and password provided by your Office.',
      'Worker Home shows your greeting, motivational banner, and Start Vehicle Check.',
      'Use the bottom navigation for Timesheets, Holidays, Vehicles, Documents, and Settings.',
      'Set or change your default vehicle from Vehicles when your Office assigns one.',
      'Watch the online / offline indicators — some actions need a connection.',
    ],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    shortDescription: 'Enter hours, save days, and submit your week.',
    keywords: ['timesheet', 'hours', 'overtime', 'submit', 'break'],
    steps: [
      'Open Timesheets and select the day you worked.',
      'Enter Start and Finish times for that day.',
      'Select Break minutes when required.',
      'Review Basic, Overtime and Total hours for the day.',
      'Tap Save Day to store that day’s entry.',
      'Review the full week summary before submitting.',
      'Confirm that the hours are correct.',
      'Submit the week for Office review.',
      'Submitted and Approved Timesheets are read-only.',
    ],
  },
  {
    id: 'holiday-requests',
    title: 'Holiday Requests',
    shortDescription: 'Check balance and submit leave requests.',
    keywords: ['holiday', 'leave', 'balance', 'request'],
    steps: [
      'Open Holidays and check your holiday balance.',
      'Select a start date and an end date.',
      'Add an optional reason if helpful for your Office.',
      'Submit the request for Office approval.',
      'Review request status under your holiday list.',
    ],
  },
  {
    id: 'vehicle-checks',
    title: 'Vehicle Checks',
    shortDescription: 'Complete walkaround checks with defects and signature.',
    keywords: ['vehicle check', 'defect', 'odometer', 'signature'],
    steps: [
      'Select the vehicle you are checking.',
      'Complete every checklist item in order.',
      'Mark each item OK, Defect, or N/A.',
      'Add defect notes and photos when something is not OK.',
      'Enter mileage (miles or kilometres as shown).',
      'Sign the check.',
      'Submit the completed check.',
      'Completed checks are read-only.',
    ],
  },
  {
    id: 'tyre-checks',
    title: 'Tyre Checks',
    shortDescription: 'Inspect tyres, tread depth, and condition.',
    keywords: ['tyre', 'tread', 'axle'],
    steps: [
      'Select the vehicle for the tyre check.',
      'Inspect every tyre position shown for that vehicle.',
      'Enter tread depth where required.',
      'Choose the tyre condition for each position.',
      'Review any warnings before finishing.',
      'Complete and submit the tyre check.',
    ],
  },
  {
    id: 'vehicles',
    title: 'Vehicles',
    shortDescription: 'Find vehicles and manage your default.',
    keywords: ['fleet', 'registration', 'default vehicle'],
    steps: [
      'Search by registration to find a company vehicle.',
      'Select a company vehicle from the list.',
      'Save or remove your default vehicle when needed.',
      'Open available actions for that vehicle (checks, reports, consumables).',
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    shortDescription: 'View Office files and submit your documents.',
    keywords: ['cmr', 'pod', 'receipt', 'document'],
    steps: [
      'View documents shared by your Office.',
      'Submit CMR, POD, receipt, or other allowed document types.',
      'Review Pending, Reviewed, or Rejected status for your submissions.',
    ],
  },
  {
    id: 'offline-vehicle-checks',
    title: 'Offline Vehicle Checks',
    shortDescription: 'Prepare online, complete offline, then sync.',
    keywords: ['offline', 'sync', 'queue', 'storage'],
    steps: [
      'Log in online at least once on this device.',
      'Load Worker Home and Vehicle Checks online once so data can be cached.',
      'When offline, use Start Vehicle Check from Home.',
      'Complete the check with photos and signature as usual.',
      'The check remains queued until you reconnect.',
      'Reconnect to sync queued checks to your Office.',
      'Do not clear browser data or app storage while checks are pending.',
    ],
  },
  {
    id: 'account-security',
    title: 'Account & Security',
    shortDescription: 'Password, biometric lock, theme, and sign out.',
    keywords: ['password', 'biometric', 'dark mode', 'sign out'],
    steps: [
      'Keep your password private and change it if your Office asks you to.',
      'On Android, you can enable Biometric App Lock in Settings → Security.',
      'Choose Light or Dark mode in Settings.',
      'Sign out safely from Settings when you finish on a shared device.',
    ],
  },
  {
    id: 'using-safely',
    title: 'Using DREVORA Safely',
    shortDescription: 'Safe use while working on the road.',
    keywords: ['driving', 'safety', 'credentials', 'support'],
    steps: [
      'Do not operate DREVORA while driving.',
      'Stop and park safely before entering information.',
      'Enter complete and accurate working-time and inspection information.',
      'Do not share account credentials.',
      'Contact Office for work or operational instructions.',
      'Contact DREVORA Support for application errors.',
      'Do not clear app data while an offline Vehicle Check is waiting to sync.',
    ],
  },
]

export function getSupportGuideTopic(
  id: string | undefined,
): SupportGuideTopic | null {
  return SUPPORT_GUIDE_TOPICS.find((topic) => topic.id === id) ?? null
}

export function searchSupportGuides(query: string): SupportGuideTopic[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return SUPPORT_GUIDE_TOPICS
  return SUPPORT_GUIDE_TOPICS.filter((topic) => {
    const haystack = [
      topic.title,
      topic.shortDescription,
      ...topic.keywords,
      ...topic.steps,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}
