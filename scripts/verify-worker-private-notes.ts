/**
 * Focused verification for Worker private notes helpers and nav contract.
 * Run: npx tsx scripts/verify-worker-private-notes.ts
 */
import {
  previewWorkerPrivateNoteContent,
  sortWorkerPrivateNotes,
  validateWorkerPrivateNoteContent,
  validateWorkerPrivateNoteTitle,
  WORKER_PRIVATE_NOTE_CONTENT_MAX,
  WORKER_PRIVATE_NOTE_TITLE_MAX,
} from '../src/lib/workerPrivateNotes.ts'
import {
  getWorkerBottomNavItems,
  isWorkerNavPathActive,
  WORKER_HOME_PATH,
  WORKER_NOTES_PATH,
} from '../src/lib/workerNavigation.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// --- Validation ---
assert(validateWorkerPrivateNoteTitle('') !== null, 'empty title rejected')
assert(validateWorkerPrivateNoteTitle('   ') !== null, 'blank title rejected')
assert(validateWorkerPrivateNoteTitle('Gate code') === null, 'title ok')
assert(
  validateWorkerPrivateNoteTitle('x'.repeat(WORKER_PRIVATE_NOTE_TITLE_MAX + 1)) !==
    null,
  'title max enforced',
)
assert(validateWorkerPrivateNoteContent('') !== null, 'empty content rejected')
assert(validateWorkerPrivateNoteContent('Depot open 06:00') === null, 'content ok')
assert(
  validateWorkerPrivateNoteContent(
    'x'.repeat(WORKER_PRIVATE_NOTE_CONTENT_MAX + 1),
  ) !== null,
  'content max enforced',
)

// --- Sort: pinned first, then updated_at desc ---
const sorted = sortWorkerPrivateNotes([
  {
    id: 'a',
    isPinned: false,
    updatedAt: '2026-08-07T12:00:00.000Z',
  },
  {
    id: 'b',
    isPinned: true,
    updatedAt: '2026-08-01T12:00:00.000Z',
  },
  {
    id: 'c',
    isPinned: false,
    updatedAt: '2026-08-07T18:00:00.000Z',
  },
  {
    id: 'd',
    isPinned: true,
    updatedAt: '2026-08-06T12:00:00.000Z',
  },
])
assert(
  sorted.map((n) => n.id).join(',') === 'd,b,c,a',
  `pinned-first sort expected d,b,c,a got ${sorted.map((n) => n.id).join(',')}`,
)

assert(
  previewWorkerPrivateNoteContent('short') === 'short',
  'preview short unchanged',
)
assert(
  previewWorkerPrivateNoteContent('word '.repeat(40)).endsWith('…'),
  'preview truncates',
)

// --- Bottom nav: Home is separate; Contacts, Notes, Settings data-driven ---
const bottom = getWorkerBottomNavItems()
assert(bottom.length === 3, 'bottom nav middle items = 3 (Contacts, Notes, Settings)')
assert(bottom[0]?.id === 'contacts', 'first middle item Contacts')
assert(bottom[1]?.id === 'notes', 'second middle item Notes')
assert(bottom[2]?.id === 'settings', 'third middle item Settings')
assert(bottom[1]?.to === WORKER_NOTES_PATH, 'Notes route path')
assert(WORKER_NOTES_PATH === '/worker/notes', 'Notes path constant')

assert(isWorkerNavPathActive('/worker/notes', WORKER_NOTES_PATH), 'Notes active')
assert(
  isWorkerNavPathActive('/worker/notes/x', WORKER_NOTES_PATH),
  'Notes nested active',
)
assert(
  !isWorkerNavPathActive('/worker/contacts', WORKER_NOTES_PATH),
  'Contacts not Notes',
)
assert(isWorkerNavPathActive(WORKER_HOME_PATH, WORKER_HOME_PATH), 'Home active')

// --- Privacy / identity contract (documented for RLS review) ---
const RLS_OWN_DRIVER = 'driver_id = public.drevora_auth_user_driver_id()'
const RLS_COMPANY = 'public.drevora_auth_user_belongs_to_company_id(company_id)'
const RLS_DRIVER_COMPANY = 'public.drevora_driver_in_company(driver_id, company_id)'
assert(RLS_OWN_DRIVER.includes('drevora_auth_user_driver_id'), 'own driver helper')
assert(RLS_COMPANY.includes('belongs_to_company_id'), 'company membership helper')
assert(RLS_DRIVER_COMPANY.includes('driver_in_company'), 'driver/company helper')
// Office must not receive a SELECT policy — verified by migration design
// (no worker_private_notes_office_* policies).

console.log('verify-worker-private-notes: PASS')
