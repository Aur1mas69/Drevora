import { HelpNavCard } from '@/components/worker/help/HelpNavCard'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { translateSupportGuide } from '@/i18n/workerFinalDisplay'
import { SUPPORT_GUIDE_TOPICS } from '@/lib/supportGuides'
import { BookOpen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function WorkerSupportGuidesPage() {
  const { t } = useTranslation('worker')
  const [query, setQuery] = useState('')
  const topics = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return SUPPORT_GUIDE_TOPICS.map((topic) => {
      const translated = translateSupportGuide(topic.id, t)
      return { ...topic, ...translated }
    }).filter((topic) => {
      if (!needle) return true
      const haystack = [
        topic.title,
        topic.shortDescription,
        ...topic.keywords,
        ...topic.steps,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, t])

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink
          to="/worker/settings/help"
          label={t('help.title', { defaultValue: 'Help & Support' })}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          {t('help.guidesTitle', { defaultValue: 'User Guides' })}
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          {t('help.userGuidesDesc', { defaultValue: 'How to use DREVORA on the road.' })}
        </p>
      </header>

      <label className="block">
        <span className="sr-only">
          {t('help.guidesSearch', { defaultValue: 'Search guides' })}
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('help.guidesSearch', { defaultValue: 'Search guides' })}
          className="h-11 w-full rounded-2xl border border-[#BFE3F5] bg-white px-4 text-sm outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20 dark:border-slate-600 dark:bg-slate-900/50"
        />
      </label>

      {topics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--worker-border)] px-4 py-6 text-center text-sm text-[color:var(--worker-text-secondary)]">
          {t('help.noGuides', { defaultValue: 'No matching guides.' })}
        </p>
      ) : (
        <ul className="worker-list-stack space-y-2">
          {topics.map((topic, index) => (
            <li key={topic.id}>
              <HelpNavCard
                to={`/worker/settings/help/guides/${topic.id}`}
                title={topic.title}
                description={topic.shortDescription}
                icon={BookOpen}
                index={index}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
