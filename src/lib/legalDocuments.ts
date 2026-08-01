/**
 * Shared legal document configuration for Worker Help & Support.
 * Points at worker-facing in-app legal routes — do not invent legal text.
 */

import { WORKER_LEGAL_ROUTES } from '@/lib/legalContent'

export type LegalDocumentKey = 'privacy' | 'worker_terms' | 'company_privacy_notice'

export type LegalDocumentConfig = {
  key: LegalDocumentKey
  title: string
  /** In-app route when content exists. */
  path: string | null
  available: boolean
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentKey, LegalDocumentConfig> = {
  privacy: {
    key: 'privacy',
    title: 'Privacy Policy',
    path: WORKER_LEGAL_ROUTES.privacy_policy,
    available: true,
  },
  worker_terms: {
    key: 'worker_terms',
    title: 'Worker Terms of Use',
    path: WORKER_LEGAL_ROUTES.worker_terms,
    available: true,
  },
  company_privacy_notice: {
    key: 'company_privacy_notice',
    title: 'Company Privacy Notice',
    path: WORKER_LEGAL_ROUTES.company_privacy_notice,
    available: true,
  },
}

export function isLegalDocumentAvailable(key: LegalDocumentKey): boolean {
  const doc = LEGAL_DOCUMENTS[key]
  return Boolean(doc?.available && doc.path)
}

export const LEGAL_UNAVAILABLE_MESSAGE =
  'This document has not been published yet.'
