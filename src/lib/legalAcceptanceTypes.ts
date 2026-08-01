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

export type WorkerLegalLocalSummary = {
  companyId: string
  driverId: string
  workerTermsVersion: string
  workerTermsHash: string
  privacyVersion: string
  privacyHash: string
  acceptedAt: string
}

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

export function readWorkerLegalLocalSummary(): WorkerLegalLocalSummary | null {
  try {
    const raw = localStorage.getItem(WORKER_LEGAL_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WorkerLegalLocalSummary
  } catch {
    return null
  }
}

export function writeWorkerLegalLocalSummary(summary: WorkerLegalLocalSummary): void {
  try {
    localStorage.setItem(WORKER_LEGAL_CACHE_KEY, JSON.stringify(summary))
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
