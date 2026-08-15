import type { ReactNode } from 'react'
import { LegalDocumentHeader } from '@/components/legal/LegalDocumentHeader'
import { LegalMarkdownBody } from '@/components/legal/LegalMarkdownBody'
import { LegalTableOfContents } from '@/components/legal/LegalTableOfContents'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
import { Card, CardContent } from '@/components/ui/card'
import type { LegalDocumentType } from '@/content/legal/legalManifest'
import AdminLayout from '@/layouts/AdminLayout'
import { getBundledLegalDocument } from '@/lib/legalContent'
import { adminCard } from '@/lib/adminUiStyles'
import { cn } from '@/lib/utils'

export type LegalDocumentPageProps = {
  documentType: LegalDocumentType
  layout: 'admin' | 'worker' | 'bare'
  backTo?: string
  backLabel?: string
  /** Full markdown override (e.g. DPA with customer summary injected). */
  markdownOverride?: string
  headerExtra?: ReactNode
  showPrint?: boolean
  className?: string
}

const PRINT_STYLES = `
@media print {
  .drevora-app-shell aside,
  .drevora-app-shell header,
  .legal-print-hide {
    display: none !important;
  }
  .drevora-app-shell main,
  .legal-document,
  .legal-document * {
    color: #0f172a !important;
    box-shadow: none !important;
  }
  .legal-document a[href^="#"]::after {
    content: none !important;
  }
}
`

/** Strip leading ATX H1 so LegalDocumentHeader remains the sole page H1. */
function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^#[ \t]+[^\n]*\n+/, '')
}

function LegalDocumentBody({
  documentType,
  markdownOverride,
  headerExtra,
  showPrint = true,
  backTo,
  backLabel,
  showWorkerBack,
}: {
  documentType: LegalDocumentType
  markdownOverride?: string
  headerExtra?: ReactNode
  showPrint?: boolean
  backTo?: string
  backLabel?: string
  showWorkerBack?: boolean
}) {
  const defaultBackLabel = useWorkerChromeText('legal.back', 'Back')
  const doc = getBundledLegalDocument(documentType)
  const markdown = stripLeadingH1(markdownOverride ?? doc.markdown)

  return (
    <div className="legal-document space-y-5 pb-10 print:bg-white print:pb-0">
      <style>{PRINT_STYLES}</style>

      {showWorkerBack && backTo ? (
        <div className="legal-print-hide mx-auto w-full max-w-[860px]">
          <WorkerSettingsBackLink to={backTo} label={backLabel ?? defaultBackLabel} />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[860px]">
        <LegalDocumentHeader
          title={doc.title}
          version={doc.version}
          effectiveDate={doc.effectiveDate}
          showPrint={showPrint}
          extra={headerExtra}
        />
      </div>

      <Card
        className={`${adminCard} mx-auto w-full max-w-[860px] border border-[rgba(75,120,220,0.10)] print:border print:border-slate-300 print:shadow-none`}
      >
        <CardContent className="bg-[#F8FBFF] p-6 sm:p-8 dark:bg-slate-900/50 print:bg-white print:p-0">
          <LegalTableOfContents markdown={markdown} />
          <article aria-label={doc.title}>
            <LegalMarkdownBody markdown={markdown} />
          </article>
        </CardContent>
      </Card>
    </div>
  )
}

export function LegalDocumentPage({
  documentType,
  layout,
  backTo,
  backLabel,
  markdownOverride,
  headerExtra,
  showPrint = true,
  className,
}: LegalDocumentPageProps) {
  const body = (
    <LegalDocumentBody
      documentType={documentType}
      markdownOverride={markdownOverride}
      headerExtra={headerExtra}
      showPrint={showPrint}
      backTo={backTo}
      backLabel={backLabel}
      showWorkerBack={layout === 'worker'}
    />
  )

  if (layout === 'admin') {
    return (
      <AdminLayout premiumBackground>
        <div className={cn(className)}>{body}</div>
      </AdminLayout>
    )
  }

  if (layout === 'worker') {
    return (
      <div
        className={cn(
          'mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-3xl',
          className,
        )}
      >
        {body}
      </div>
    )
  }

  return <div className={cn(className)}>{body}</div>
}

export default LegalDocumentPage
