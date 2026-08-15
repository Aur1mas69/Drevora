import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { translateSupportGuide } from '@/i18n/workerFinalDisplay'
import { getSupportGuideTopic } from '@/lib/supportGuides'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

export default function WorkerSupportGuideTopicPage() {
  const { t } = useTranslation('worker')
  const { topicId } = useParams<{ topicId: string }>()
  const topic = getSupportGuideTopic(topicId)

  if (!topic) {
    return <Navigate to="/worker/settings/help/guides" replace />
  }

  const translated = translateSupportGuide(topic.id, t)

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink
          to="/worker/settings/help/guides"
          label={t('help.guidesTitle', { defaultValue: 'User Guides' })}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          {translated.title}
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          {translated.shortDescription}
        </p>
      </header>

      <ol className="space-y-3 rounded-[1.5rem] border border-[#BFE3F5]/80 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
        {translated.steps.map((step, index) => (
          <li key={`${topic.id}-${index}`} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E8F3FE] text-sm font-bold text-[#0B68BE]">
              {index + 1}
            </span>
            <p className="pt-1 text-sm leading-relaxed text-[color:var(--worker-text)]">
              {step}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
