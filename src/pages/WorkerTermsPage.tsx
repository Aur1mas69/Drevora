import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage'

export default function WorkerTermsPage() {
  return (
    <LegalDocumentPage
      documentType="worker_terms"
      layout="worker"
      backTo="/worker/settings/help"
      backLabel="Help & Support"
    />
  )
}
