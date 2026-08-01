import { slugifyLegalHeading } from '@/components/legal/LegalMarkdownBody'
import { adminHeading, adminText } from '@/lib/adminUiStyles'
import { cn } from '@/lib/utils'

export type LegalTocItem = {
  id: string
  label: string
}

/** Build TOC entries from markdown ## headings (ignores # title). */
export function parseLegalTableOfContents(markdown: string): LegalTocItem[] {
  const items: LegalTocItem[] = []
  const seen = new Set<string>()

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (!match) continue
    const label = match[1].replace(/\s+#+\s*$/, '').trim()
    if (!label) continue
    let id = slugifyLegalHeading(label)
    if (!id) continue
    if (seen.has(id)) {
      let n = 2
      while (seen.has(`${id}-${n}`)) n += 1
      id = `${id}-${n}`
    }
    seen.add(id)
    items.push({ id, label })
  }

  return items
}

type LegalTableOfContentsProps = {
  markdown: string
  className?: string
  label?: string
}

export function LegalTableOfContents({
  markdown,
  className,
  label = 'Contents',
}: LegalTableOfContentsProps) {
  const items = parseLegalTableOfContents(markdown)
  if (items.length === 0) return null

  return (
    <nav
      aria-label={label}
      className={cn(
        'legal-document-toc legal-print-hide mb-8 rounded-[14px] border border-[rgba(75,120,220,0.12)] bg-white/80 px-4 py-4 dark:border-white/10 dark:bg-slate-900/60',
        className,
      )}
    >
      <h2 className={`text-sm font-semibold ${adminHeading}`}>{label}</h2>
      <ol className={`mt-3 columns-1 gap-x-8 space-y-1.5 text-sm sm:columns-2 ${adminText}`}>
        {items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <a
              href={`#${item.id}`}
              className="text-[#0B68BE] no-underline hover:underline dark:text-sky-400"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
