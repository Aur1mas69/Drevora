import customerTermsMarkdown from '@/content/legal/customer-terms-v0.2.md?raw'
import dpaMarkdown from '@/content/legal/dpa-v0.2.md?raw'
import privacyPolicyMarkdown from '@/content/legal/privacy-policy-v0.2.md?raw'
import workerTermsMarkdown from '@/content/legal/worker-terms-v0.1.md?raw'
import {
  getLegalManifestEntry,
  type LegalDocumentType,
} from '@/content/legal/legalManifest'

const MARKDOWN_BY_TYPE: Record<LegalDocumentType, string> = {
  customer_terms: customerTermsMarkdown,
  dpa: dpaMarkdown,
  privacy_policy: privacyPolicyMarkdown,
  worker_terms: workerTermsMarkdown,
}

export function getBundledLegalMarkdown(type: LegalDocumentType): string {
  return MARKDOWN_BY_TYPE[type]
}

export function getBundledLegalDocument(type: LegalDocumentType) {
  const entry = getLegalManifestEntry(type)
  return {
    ...entry,
    markdown: getBundledLegalMarkdown(type),
  }
}

/** Admin/customer document routes. */
export const CUSTOMER_LEGAL_ROUTES = {
  customer_terms: '/terms',
  privacy_policy: '/privacy',
  dpa: '/dpa',
} as const

/** Worker-facing document routes (no Customer Terms / DPA). */
export const WORKER_LEGAL_ROUTES = {
  worker_terms: '/worker/settings/help/legal/worker-terms',
  privacy_policy: '/worker/settings/help/legal/privacy',
  company_privacy_notice: '/worker/settings/help/legal/company-privacy-notice',
} as const
