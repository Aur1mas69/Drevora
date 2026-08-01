/**
 * Shared legal acceptance types and local cache helpers.
 * Supabase remains the source of truth for acceptance evidence.
 */

import type { LegalDocumentType } from '@/content/legal/legalManifest'

export type LegalAcceptanceSource =
  | 'onboarding'
  | 'trial'
  | 'subscription'
  | 'office_login'
  | 'worker_first_login'
  | 'legal_update'

export type LegalPlatform = 'android' | 'web' | 'pwa'

export type LegalDocumentStatusItem = {
  documentType: LegalDocumentType
  title: string
  version: string
  effectiveDate: string
  contentHash: string
  documentVersionId: string | null
  required: boolean
  isSatisfied: boolean
  acceptedAt: string | null
  acceptedByName: string | null
  acceptedByEmail: string | null
  acceptanceBatchId: string | null
  acceptanceAction: 'accepted' | 'acknowledged' | null
}

export type CustomerLegalStatus = {
  companyId: string
  companyLegalComplete: boolean
  missingLegalFields: string[]
  legalEntity: {
    legalCompanyName: string | null
    businessAddressLine1: string | null
    businessAddressLine2: string | null
    city: string | null
    county: string | null
    postcode: string | null
    country: string | null
    privacyContactEmail: string | null
  }
  documents: LegalDocumentStatusItem[]
  requiresAcceptance: boolean
}

export type WorkerLegalStatus = {
  companyId: string
  driverId: string
  documents: LegalDocumentStatusItem[]
  requiresAcceptance: boolean
  companyPrivacyNotice: {
    url: string | null
    content: string | null
    version: string | null
    updatedAt: string | null
  }
}

export type LegalAcceptanceBatchResult = {
  acceptanceBatchId: string
  acceptedAt: string
  documents: Array<{
    documentType: LegalDocumentType
    documentVersion: string
    documentHash: string
    acceptanceAction: string
  }>
}

const WORKER_LEGAL_CACHE_KEY = 'drevora.worker-legal-accepted-summary'

/**
 * Safe offline summary for Worker legal gate only.
 * Never store tokens, passwords, session contents, document text, or Admin evidence.
 */
export type WorkerLegalLocalSummary = {
  companyId: string
  driverId: string
  workerTermsVersion: string
  workerTermsAccepted: boolean
  privacyVersion: string
  privacyAcknowledged: boolean
  /** Optional hash snapshot when known from server/acceptance. */
  workerTermsHash?: string
  privacyHash?: string
  acceptedAt: string
  cachedAt: string
}

export type OfflineWorkerLegalDecision =
  | { kind: 'allow_cached' }
  | { kind: 'needs_online_acceptance' }

export function detectLegalPlatform(): LegalPlatform {
  if (import.meta.env.MODE === 'native') return 'android'
  if (typeof window !== 'undefined') {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    if (isStandalone) return 'pwa'
  }
  return 'web'
}

function normalizeWorkerLegalLocalSummary(
  raw: Record<string, unknown>,
): WorkerLegalLocalSummary | null {
  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : ''
  const driverId = typeof raw.driverId === 'string' ? raw.driverId.trim() : ''
  const workerTermsVersion =
    typeof raw.workerTermsVersion === 'string' ? raw.workerTermsVersion.trim() : ''
  const privacyVersion =
    typeof raw.privacyVersion === 'string' ? raw.privacyVersion.trim() : ''
  const acceptedAt =
    typeof raw.acceptedAt === 'string' && raw.acceptedAt.trim()
      ? raw.acceptedAt.trim()
      : ''
  if (!companyId || !driverId || !workerTermsVersion || !privacyVersion || !acceptedAt) {
    return null
  }

  // Older caches were written only after a successful acceptance batch.
  const workerTermsAccepted =
    typeof raw.workerTermsAccepted === 'boolean' ? raw.workerTermsAccepted : true
  const privacyAcknowledged =
    typeof raw.privacyAcknowledged === 'boolean' ? raw.privacyAcknowledged : true
  const cachedAt =
    typeof raw.cachedAt === 'string' && raw.cachedAt.trim()
      ? raw.cachedAt.trim()
      : acceptedAt

  return {
    companyId,
    driverId,
    workerTermsVersion,
    workerTermsAccepted,
    privacyVersion,
    privacyAcknowledged,
    workerTermsHash:
      typeof raw.workerTermsHash === 'string' ? raw.workerTermsHash : undefined,
    privacyHash: typeof raw.privacyHash === 'string' ? raw.privacyHash : undefined,
    acceptedAt,
    cachedAt,
  }
}

export function readWorkerLegalLocalSummary(): WorkerLegalLocalSummary | null {
  try {
    const raw = localStorage.getItem(WORKER_LEGAL_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return normalizeWorkerLegalLocalSummary(parsed as Record<string, unknown>)
  } catch {
    return null
  }
}

export function writeWorkerLegalLocalSummary(summary: WorkerLegalLocalSummary): void {
  try {
    localStorage.setItem(
      WORKER_LEGAL_CACHE_KEY,
      JSON.stringify({
        companyId: summary.companyId,
        driverId: summary.driverId,
        workerTermsVersion: summary.workerTermsVersion,
        workerTermsAccepted: summary.workerTermsAccepted,
        privacyVersion: summary.privacyVersion,
        privacyAcknowledged: summary.privacyAcknowledged,
        workerTermsHash: summary.workerTermsHash,
        privacyHash: summary.privacyHash,
        acceptedAt: summary.acceptedAt,
        cachedAt: summary.cachedAt,
      }),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function clearWorkerLegalLocalSummary(): void {
  try {
    localStorage.removeItem(WORKER_LEGAL_CACHE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Compare a cached Worker acceptance summary to the currently bundled manifest
 * versions. Used only for offline / network-failure soft access — never as a
 * substitute for writing server acceptance.
 */
export function evaluateOfflineWorkerLegalAccess(input: {
  companyId: string
  driverId?: string | null
  bundledWorkerTermsVersion: string
  bundledPrivacyVersion: string
}): OfflineWorkerLegalDecision {
  const summary = readWorkerLegalLocalSummary()
  if (!summary) return { kind: 'needs_online_acceptance' }
  if (summary.companyId !== input.companyId.trim()) {
    return { kind: 'needs_online_acceptance' }
  }
  if (
    input.driverId &&
    summary.driverId &&
    summary.driverId !== input.driverId.trim()
  ) {
    return { kind: 'needs_online_acceptance' }
  }
  if (!summary.workerTermsAccepted || !summary.privacyAcknowledged) {
    return { kind: 'needs_online_acceptance' }
  }
  if (summary.workerTermsVersion !== input.bundledWorkerTermsVersion) {
    return { kind: 'needs_online_acceptance' }
  }
  if (summary.privacyVersion !== input.bundledPrivacyVersion) {
    return { kind: 'needs_online_acceptance' }
  }
  return { kind: 'allow_cached' }
}

/** Persist a safe summary after authoritative online Worker status or acceptance. */
export function cacheWorkerLegalStatusSummary(input: {
  companyId: string
  driverId: string
  documents: LegalDocumentStatusItem[]
}): void {
  const workerTerms = input.documents.find((doc) => doc.documentType === 'worker_terms')
  const privacy = input.documents.find((doc) => doc.documentType === 'privacy_policy')
  if (!workerTerms || !privacy) return
  if (!workerTerms.isSatisfied || !privacy.isSatisfied) return
  if (!workerTerms.version.trim() || !privacy.version.trim()) return

  const acceptedAt =
    workerTerms.acceptedAt ||
    privacy.acceptedAt ||
    new Date().toISOString()

  writeWorkerLegalLocalSummary({
    companyId: input.companyId,
    driverId: input.driverId,
    workerTermsVersion: workerTerms.version,
    workerTermsAccepted: true,
    privacyVersion: privacy.version,
    privacyAcknowledged: true,
    workerTermsHash: workerTerms.contentHash || undefined,
    privacyHash: privacy.contentHash || undefined,
    acceptedAt,
    cachedAt: new Date().toISOString(),
  })
}

export function companyLegalDetailsComplete(input: {
  legalCompanyName: string | null | undefined
  businessAddressLine1: string | null | undefined
  addressFallback?: string | null | undefined
  city: string | null | undefined
  postcode: string | null | undefined
  country: string | null | undefined
  privacyContactEmail: string | null | undefined
}): { complete: boolean; missing: string[] } {
  const line1 = (input.businessAddressLine1 || input.addressFallback || '').trim()
  const missing: string[] = []
  if (!input.legalCompanyName?.trim()) missing.push('Legal company name')
  if (!line1) missing.push('Business address')
  if (!input.city?.trim()) missing.push('City')
  if (!input.postcode?.trim()) missing.push('Postcode')
  if (!input.country?.trim()) missing.push('Country')
  if (!input.privacyContactEmail?.trim()) missing.push('Privacy contact email')
  return { complete: missing.length === 0, missing }
}
