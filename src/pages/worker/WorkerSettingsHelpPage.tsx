import { HelpNavCard } from '@/components/worker/help/HelpNavCard'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import {
  getAppPlatformDisplayName,
  getAppVersionLabel,
  getNativeBuildNumber,
} from '@/lib/appVersion'
import {
  isLegalDocumentAvailable,
  LEGAL_DOCUMENTS,
  LEGAL_UNAVAILABLE_MESSAGE,
} from '@/lib/legalDocuments'
import {
  BookOpen,
  Bug,
  FileText,
  History,
  MessageSquarePlus,
  Scale,
  Shield,
  Star,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Worker Help & Support home — Office vs DREVORA support, guides, legal, version.
 */
export default function WorkerSettingsHelpPage() {
  const { t } = useTranslation('worker')
  const [buildNumber, setBuildNumber] = useState<string | null>(null)
  const platform = getAppPlatformDisplayName()

  useEffect(() => {
    let cancelled = false
    void getNativeBuildNumber().then((value) => {
      if (!cancelled) setBuildNumber(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-md space-y-5 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <div className="space-y-2">
        <WorkerSettingsBackLink />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          {t('help.title', { defaultValue: 'Help & Support' })}
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--worker-text-secondary)]">
          {t('help.intro', {
            defaultValue:
              'Work, rota, vehicle or company questions belong in Contacts. App errors, technical problems and suggestions should be sent to DREVORA Support.',
          })}
        </p>
      </div>

      <section className="space-y-2" aria-labelledby="help-drevora-heading">
        <h2
          id="help-drevora-heading"
          className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]"
        >
          {t('help.drevoraSupport', { defaultValue: 'DREVORA Support' })}
        </h2>
        <ul className="worker-list-stack space-y-2">
          <li>
            <HelpNavCard
              to="/worker/settings/help/bug"
              title={t('help.reportBug', { defaultValue: 'Report a Bug' })}
              description={t('help.reportBugDesc', {
                defaultValue: 'App errors, crashes and unexpected behaviour.',
              })}
              icon={Bug}
              index={0}
            />
          </li>
          <li>
            <HelpNavCard
              to="/worker/settings/help/feedback"
              title={t('help.sendFeedback', { defaultValue: 'Send Feedback' })}
              description={t('help.sendFeedbackDesc', {
                defaultValue: 'Suggestions, ease of use and feature ideas.',
              })}
              icon={MessageSquarePlus}
              index={1}
            />
          </li>
          <li>
            <HelpNavCard
              to="/worker/settings/help/rate"
              title={t('help.rate', { defaultValue: 'Rate DREVORA' })}
              description={t('help.rateDesc', {
                defaultValue: 'Share a quick star rating for the app.',
              })}
              icon={Star}
              index={2}
            />
          </li>
          <li>
            <HelpNavCard
              to="/worker/settings/help/requests"
              title={t('help.myRequests', { defaultValue: 'My Support Requests' })}
              description={t('help.myRequestsDesc', {
                defaultValue: 'Track bugs and feedback you have sent.',
              })}
              icon={History}
              index={3}
            />
          </li>
        </ul>
      </section>

      <section className="space-y-2" aria-labelledby="help-guides-heading">
        <h2
          id="help-guides-heading"
          className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]"
        >
          {t('help.guides', { defaultValue: 'Guides' })}
        </h2>
        <ul className="worker-list-stack space-y-2">
          <li>
            <HelpNavCard
              to="/worker/settings/help/guides"
              title={t('help.userGuides', { defaultValue: 'User Guides' })}
              description={t('help.userGuidesDesc', {
                defaultValue: 'How to use DREVORA on the road.',
              })}
              icon={BookOpen}
              index={0}
            />
          </li>
        </ul>
      </section>

      <section className="space-y-2" aria-labelledby="help-legal-heading">
        <h2
          id="help-legal-heading"
          className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]"
        >
          {t('help.legal', { defaultValue: 'Legal' })}
        </h2>
        <ul className="worker-list-stack space-y-2">
          <li>
            <HelpNavCard
              to={LEGAL_DOCUMENTS.worker_terms.path ?? '#'}
              title={t('legal.workerTermsTitle', {
                defaultValue: LEGAL_DOCUMENTS.worker_terms.title,
              })}
              description={t('support.termsDesc', {
                defaultValue: 'Terms for using the DREVORA Worker app.',
              })}
              icon={Scale}
              index={0}
              disabled={!isLegalDocumentAvailable('worker_terms')}
              unavailableMessage={LEGAL_UNAVAILABLE_MESSAGE}
            />
          </li>
          <li>
            <HelpNavCard
              to={LEGAL_DOCUMENTS.privacy.path ?? '#'}
              title={t('legal.privacyTitle', {
                defaultValue: LEGAL_DOCUMENTS.privacy.title,
              })}
              description={t('support.privacyDesc', {
                defaultValue: 'How DREVORA handles personal information.',
              })}
              icon={Shield}
              index={1}
              disabled={!isLegalDocumentAvailable('privacy')}
              unavailableMessage={LEGAL_UNAVAILABLE_MESSAGE}
            />
          </li>
          <li>
            <div className="worker-list-card worker-list-row flex items-start gap-3 px-4 py-3">
              <span className="worker-home-icon-well flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F3FE] text-[#0B68BE]">
                <FileText className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[color:var(--worker-text)]">
                  {t('settings.appVersion', { defaultValue: 'App Version' })}
                </p>
                <p className="mt-0.5 text-sm text-[color:var(--worker-text-secondary)]">
                  {getAppVersionLabel()}
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--worker-text-muted)]">
                  {buildNumber
                    ? t('help.platformBuildLine', {
                        platform,
                        build: buildNumber,
                        defaultValue: 'Platform: {{platform}} · Build {{build}}',
                      })
                    : t('help.platformLine', {
                        platform,
                        defaultValue: 'Platform: {{platform}}',
                      })}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  )
}
