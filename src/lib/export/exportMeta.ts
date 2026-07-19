import { getCompanyDisplayName } from '@/lib/company'

export type ExportMeta = {
  companyName: string
  logoUrl: string | null
  generatedBy: string | null
  generatedAtLabel: string
  filterSummary: string | null
  documentTitle: string
}

type ResolveExportMetaInput = {
  companyName?: string | null
  logoUrl?: string | null
  generatedBy?: string | null
  filterSummary?: string | null
  documentTitle: string
}

export function formatExportGeneratedAt(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function resolveExportMeta(input: ResolveExportMetaInput): ExportMeta {
  return {
    companyName: getCompanyDisplayName(input.companyName),
    logoUrl: input.logoUrl?.trim() || null,
    generatedBy: input.generatedBy?.trim() || null,
    generatedAtLabel: formatExportGeneratedAt(),
    filterSummary: input.filterSummary?.trim() || null,
    documentTitle: input.documentTitle.trim() || 'Export',
  }
}

export function joinFilterSummary(
  parts: Array<string | null | undefined>,
): string | null {
  const cleaned = parts.map((part) => part?.trim()).filter(Boolean) as string[]
  return cleaned.length > 0 ? cleaned.join(' · ') : null
}
