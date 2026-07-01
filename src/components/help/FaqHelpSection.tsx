import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { FaqItem, FaqSection } from '@/lib/faqContent'
import { adminHeading, adminInnerSoft, adminPanelSm, adminText, adminTextMuted } from '@/lib/adminUiStyles'

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`overflow-hidden ${adminPanelSm} bg-[#F8FBFF] dark:bg-slate-900/70`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-white dark:hover:bg-slate-800/60 sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold sm:text-[15px] ${adminHeading}`}>
              {item.question}
            </span>
            {item.comingLater ? (
              <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${adminInnerSoft} text-slate-500 dark:text-slate-400`}>
                Coming later
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <div className="border-t border-[rgba(75,120,220,0.08)] bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900/50 sm:px-5">
          <p className={`text-sm leading-6 ${adminText}`}>{item.answer}</p>
        </div>
      ) : null}
    </div>
  )
}

export function FaqHelpSection({ section }: { section: FaqSection }) {
  return (
    <section aria-labelledby={`faq-section-${section.id}`}>
      <div className="mb-4">
        <h2
          id={`faq-section-${section.id}`}
          className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}
        >
          {section.title}
        </h2>
        <p className={`mt-1 text-sm leading-6 ${adminTextMuted}`}>{section.description}</p>
      </div>

      <div className="space-y-3">
        {section.items.map((item) => (
          <FaqAccordionItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}
