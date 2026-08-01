import { HelpNavCard } from '@/components/worker/help/HelpNavCard'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { searchSupportGuides } from '@/lib/supportGuides'
import { BookOpen } from 'lucide-react'
import { useMemo, useState } from 'react'

export default function WorkerSupportGuidesPage() {
  const [query, setQuery] = useState('')
  const topics = useMemo(() => searchSupportGuides(query), [query])

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink to="/worker/settings/help" label="Help & Support" />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          User Guides
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          Short how-to topics for everyday Worker tasks.
        </p>
      </header>

      <label className="block">
        <span className="sr-only">Search guides</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guides"
          className="h-11 w-full rounded-2xl border border-[#BFE3F5] bg-white px-4 text-sm outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20 dark:border-slate-600 dark:bg-slate-900/50"
        />
      </label>

      {topics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--worker-border)] px-4 py-6 text-center text-sm text-[color:var(--worker-text-secondary)]">
          No guides match your search.
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
