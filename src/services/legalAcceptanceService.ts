import {
  getLegalManifestEntry,
  type LegalDocumentType,
} from '@/content/legal/legalManifest'
import {
  detectLegalPlatform,
  type CustomerLegalStatus,
  type LegalAcceptanceBatchResult,
  type LegalAcceptanceSource,
  type LegalDocumentStatusItem,
  type WorkerLegalStatus,
  writeWorkerLegalLocalSummary,
} from '@/lib/legalAcceptanceTypes'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

export class LegalAcceptanceServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LegalAcceptanceServiceError'
  }
}

function friendlyLegalError(error: unknown, fallback: string): LegalAcceptanceServiceError {
  if (error instanceof LegalAcceptanceServiceError) return error
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : ''
  const hint =
    error && typeof error === 'object' && 'hint' in error
      ? String((error as { hint?: unknown }).hint ?? '')
      : ''
  const combined = `${message} ${hint}`.toLowerCase()

  if (/relation .*legal_|function .*legal_|does not exist/i.test(combined)) {
    return new LegalAcceptanceServiceError(
      'Legal acceptance is not available yet. Please ask your Office to apply the latest DREVORA update.',
    )
  }
  if (/LEGAL_ACCEPT_CONTROLLER_INCOMPLETE|controller details are incomplete/i.test(combined)) {
    return new LegalAcceptanceServiceError(
      'Complete legal company details before accepting the DPA.',
    )
  }
  if (/LEGAL_ACCEPT_INCOMPLETE|all three document/i.test(combined)) {
    return new LegalAcceptanceServiceError(
      'Please confirm authority and accept every required document.',
    )
  }
  if (/LEGAL_ACCEPT_FORBIDDEN|42501|permission|jwt|auth/i.test(combined)) {
    return new LegalAcceptanceServiceError(
      'You do not have permission to record this legal acceptance.',
    )
  }
  if (hint.trim()) {
    return new LegalAcceptanceServiceError(hint.trim())
  }
  if (message.trim()) {
    return new LegalAcceptanceServiceError(message.trim())
  }
  return new LegalAcceptanceServiceError(fallback)
}

function mapDocumentStatus(raw: Record<string, unknown> | null | undefined): LegalDocumentStatusItem {
  const documentType = String(raw?.document_type ?? '') as LegalDocumentType
  const manifest = (() => {
    try {
      return getLegalManifestEntry(documentType)
    } catch {
      return null
    }
  })()

  return {
    documentType,
    title: String(raw?.title ?? manifest?.title ?? documentType),
    version: String(raw?.version ?? manifest?.version ?? ''),
    effectiveDate: String(raw?.effective_date ?? manifest?.effectiveDate ?? ''),
    contentHash: String(raw?.content_hash ?? manifest?.contentHash ?? ''),
    documentVersionId: raw?.document_version_id
      ? String(raw.document_version_id)
      : null,
    required: Boolean(raw?.required ?? true),
    isSatisfied: Boolean(raw?.is_satisfied),
    acceptedAt: raw?.accepted_at ? String(raw.accepted_at) : null,
    acceptedByName: raw?.accepted_by_name ? String(raw.accepted_by_name) : null,
    acceptedByEmail: raw?.accepted_by_email ? String(raw.accepted_by_email) : null,
    acceptanceBatchId: raw?.acceptance_batch_id
      ? String(raw.acceptance_batch_id)
      : null,
    acceptanceAction:
      raw?.acceptance_action === 'accepted' || raw?.acceptance_action === 'acknowledged'
        ? raw.acceptance_action
        : null,
  }
}

function mapCustomerStatus(data: Record<string, unknown>): CustomerLegalStatus {
  const entity = (data.legal_entity ?? {}) as Record<string, unknown>
  const documents = Array.isArray(data.documents)
    ? data.documents.map((item) => mapDocumentStatus(item as Record<string, unknown>))
    : []
  return {
    companyId: String(data.company_id ?? ''),
    companyLegalComplete: Boolean(data.company_legal_complete),
    missingLegalFields: Array.isArray(data.missing_legal_fields)
      ? data.missing_legal_fields.map(String)
      : [],
    legalEntity: {
      legalCompanyName: entity.legal_company_name
        ? String(entity.legal_company_name)
        : null,
      businessAddressLine1: entity.business_address_line_1
        ? String(entity.business_address_line_1)
        : null,
      businessAddressLine2: entity.business_address_line_2
        ? String(entity.business_address_line_2)
        : null,
      city: entity.city ? String(entity.city) : null,
      county: entity.county ? String(entity.county) : null,
      postcode: entity.postcode ? String(entity.postcode) : null,
      country: entity.country ? String(entity.country) : null,
      privacyContactEmail: entity.privacy_contact_email
        ? String(entity.privacy_contact_email)
        : null,
    },
    documents,
    requiresAcceptance: documents.some((doc) => doc.required && !doc.isSatisfied),
  }
}

function mapWorkerStatus(data: Record<string, unknown>): WorkerLegalStatus {
  const notice = (data.company_privacy_notice ?? {}) as Record<string, unknown>
  const documents = Array.isArray(data.documents)
    ? data.documents.map((item) => mapDocumentStatus(item as Record<string, unknown>))
    : []
  return {
    companyId: String(data.company_id ?? ''),
    driverId: String(data.driver_id ?? ''),
    documents,
    requiresAcceptance: documents.some((doc) => doc.required && !doc.isSatisfied),
    companyPrivacyNotice: {
      url: notice.url ? String(notice.url) : null,
      content: notice.content ? String(notice.content) : null,
      version: notice.version ? String(notice.version) : null,
      updatedAt: notice.updated_at ? String(notice.updated_at) : null,
    },
  }
}

function mapBatchResult(data: Record<string, unknown>): LegalAcceptanceBatchResult {
  return {
    acceptanceBatchId: String(data.acceptance_batch_id ?? ''),
    acceptedAt: String(data.accepted_at ?? new Date().toISOString()),
    documents: Array.isArray(data.documents)
      ? data.documents.map((item) => {
          const row = item as Record<string, unknown>
          return {
            documentType: String(row.document_type ?? '') as LegalDocumentType,
            documentVersion: String(row.document_version ?? ''),
            documentHash: String(row.document_hash ?? ''),
            acceptanceAction: String(row.acceptance_action ?? ''),
          }
        })
      : [],
  }
}

export async function fetchCustomerLegalStatus(
  companyId: string,
): Promise<CustomerLegalStatus> {
  const { data, error } = await requireSupabase().rpc(
    'drevora_get_customer_legal_status',
    { p_company_id: companyId },
  )

  logSupabaseQuery({
    service: 'legalAcceptanceService.getCustomerStatus',
    table: 'rpc.drevora_get_customer_legal_status',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw friendlyLegalError(error, 'Unable to load customer legal status.')
  }

  return mapCustomerStatus(data as Record<string, unknown>)
}

export async function fetchWorkerLegalStatus(
  companyId: string,
): Promise<WorkerLegalStatus> {
  const { data, error } = await requireSupabase().rpc(
    'drevora_get_worker_legal_status',
    { p_company_id: companyId },
  )

  logSupabaseQuery({
    service: 'legalAcceptanceService.getWorkerStatus',
    table: 'rpc.drevora_get_worker_legal_status',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw friendlyLegalError(error, 'Unable to load worker legal status.')
  }

  return mapWorkerStatus(data as Record<string, unknown>)
}

export async function acceptCustomerLegalDocuments(input: {
  companyId: string
  confirmedAuthority: boolean
  acceptCustomerTerms: boolean
  acceptDpa: boolean
  acknowledgePrivacy: boolean
  acceptedByName: string
  acceptanceSource: LegalAcceptanceSource
  route?: string | null
}): Promise<LegalAcceptanceBatchResult> {
  const { data, error } = await requireSupabase().rpc(
    'drevora_accept_customer_legal_documents',
    {
      p_company_id: input.companyId,
      p_confirmed_authority: input.confirmedAuthority,
      p_accept_customer_terms: input.acceptCustomerTerms,
      p_accept_dpa: input.acceptDpa,
      p_acknowledge_privacy: input.acknowledgePrivacy,
      p_accepted_by_name: input.acceptedByName.trim(),
      p_acceptance_source: input.acceptanceSource,
      p_platform: detectLegalPlatform(),
      p_route: input.route ?? null,
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    },
  )

  logSupabaseQuery({
    service: 'legalAcceptanceService.acceptCustomer',
    table: 'rpc.drevora_accept_customer_legal_documents',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw friendlyLegalError(error, 'Unable to record legal acceptance.')
  }

  return mapBatchResult(data as Record<string, unknown>)
}

export async function acceptWorkerLegalDocuments(input: {
  companyId: string
  acceptWorkerTerms: boolean
  acknowledgePrivacy: boolean
  acceptedByName: string
  acceptanceSource: LegalAcceptanceSource
  route?: string | null
  driverId: string
}): Promise<LegalAcceptanceBatchResult> {
  const { data, error } = await requireSupabase().rpc(
    'drevora_accept_worker_legal_documents',
    {
      p_company_id: input.companyId,
      p_accept_worker_terms: input.acceptWorkerTerms,
      p_acknowledge_privacy: input.acknowledgePrivacy,
      p_accepted_by_name: input.acceptedByName.trim(),
      p_acceptance_source: input.acceptanceSource,
      p_platform: detectLegalPlatform(),
      p_route: input.route ?? null,
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    },
  )

  logSupabaseQuery({
    service: 'legalAcceptanceService.acceptWorker',
    table: 'rpc.drevora_accept_worker_legal_documents',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw friendlyLegalError(error, 'Unable to record worker legal acceptance.')
  }

  const result = mapBatchResult(data as Record<string, unknown>)
  const workerTerms = result.documents.find((d) => d.documentType === 'worker_terms')
  const privacy = result.documents.find((d) => d.documentType === 'privacy_policy')
  if (workerTerms && privacy) {
    writeWorkerLegalLocalSummary({
      companyId: input.companyId,
      driverId: input.driverId,
      workerTermsVersion: workerTerms.documentVersion,
      workerTermsHash: workerTerms.documentHash,
      privacyVersion: privacy.documentVersion,
      privacyHash: privacy.documentHash,
      acceptedAt: result.acceptedAt,
    })
  }
  return result
}

/** Typed placeholder for future secure server-side confirmation email (e.g. Resend). */
export type LegalAcceptanceEmailHook = {
  sendAcceptanceConfirmation: (input: {
    acceptanceBatchId: string
    recipientEmail: string
    subjectType: 'customer_admin' | 'worker'
  }) => Promise<void>
}
