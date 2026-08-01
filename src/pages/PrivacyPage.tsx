import { useLocation } from 'react-router-dom'
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage'
import { WORKER_LEGAL_ROUTES } from '@/lib/legalContent'

export default function PrivacyPage() {
  const { pathname } = useLocation()
  const isWorker = pathname.startsWith('/worker')

  return (
    <LegalDocumentPage
      documentType="privacy_policy"
      layout={isWorker ? 'worker' : 'admin'}
      backTo={isWorker ? '/worker/settings/help' : undefined}
      backLabel={isWorker ? 'Help & Support' : undefined}
      showPrint={!isWorker || pathname === WORKER_LEGAL_ROUTES.privacy_policy}
    />
  )
}
