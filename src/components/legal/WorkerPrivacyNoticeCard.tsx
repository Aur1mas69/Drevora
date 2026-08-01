import { LegalMarkdownBody } from '@/components/legal/LegalMarkdownBody'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

type WorkerPrivacyNoticeCardProps = {
  url?: string | null
  content?: string | null
  className?: string
}

const FALLBACK =
  'Your company has not published a Worker Privacy Notice in DREVORA. Contact your Office for a copy.'

function looksLikeMarkdown(value: string): boolean {
  return /^#{1,3}\s+\S/m.test(value)
}

/** Renders a company Worker Privacy Notice URL, plain text, or markdown. */
export function WorkerPrivacyNoticeCard({
  url,
  content,
  className,
}: WorkerPrivacyNoticeCardProps) {
  const trimmedUrl = url?.trim() || null
  const trimmedContent = content?.trim() || null

  if (trimmedUrl) {
    return (
      <div
        className={`rounded-2xl border border-[#BFE3F5]/80 bg-[#F5FAFF] p-5 dark:border-slate-700 dark:bg-slate-900/50 ${className ?? ''}`}
      >
        <h2 className="text-base font-semibold text-[color:var(--worker-text)]">
          Worker Privacy Notice
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
          Your company has published an external Worker Privacy Notice.
        </p>
        <Button
          asChild
          className="mt-4 h-11 rounded-2xl bg-[#2F80ED] text-white hover:bg-[#2563EB]"
        >
          <a href={trimmedUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            Open notice
          </a>
        </Button>
      </div>
    )
  }

  if (trimmedContent) {
    const asMarkdown = looksLikeMarkdown(trimmedContent)
    return (
      <div
        className={`rounded-2xl border border-[#BFE3F5]/80 bg-[#F5FAFF] p-5 dark:border-slate-700 dark:bg-slate-900/50 ${className ?? ''}`}
      >
        <h2 className="text-base font-semibold text-[color:var(--worker-text)]">
          Worker Privacy Notice
        </h2>
        <div className="mt-3">
          {asMarkdown ? (
            <LegalMarkdownBody markdown={trimmedContent} />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--worker-text)]">
              {trimmedContent}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border border-[#BFE3F5]/80 bg-[#F5FAFF] p-5 dark:border-slate-700 dark:bg-slate-900/50 ${className ?? ''}`}
    >
      <h2 className="text-base font-semibold text-[color:var(--worker-text)]">
        Worker Privacy Notice
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
        {FALLBACK}
      </p>
    </div>
  )
}
