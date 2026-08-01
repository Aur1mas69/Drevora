import { Fragment, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { adminHeading, adminText } from '@/lib/adminUiStyles'
import { cn } from '@/lib/utils'

const PAGEBREAK_TOKEN = '[[PAGEBREAK]]'

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function textFromChildren(children: ReactNode): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textFromChildren).join('')
  if (typeof children === 'object' && 'props' in children) {
    const props = children.props as { children?: ReactNode }
    return textFromChildren(props.children)
  }
  return ''
}

const linkClass =
  'font-medium text-[#0B68BE] underline-offset-2 hover:underline dark:text-sky-400'

type LegalMarkdownBodyProps = {
  markdown: string
  className?: string
}

function MarkdownChunk({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => {
          const id = slugifyHeading(textFromChildren(children))
          return (
            <h2
              id={id || undefined}
              className={cn(
                'mt-8 scroll-mt-24 text-xl font-semibold tracking-[-0.02em] first:mt-0',
                adminHeading,
              )}
            >
              {children}
            </h2>
          )
        },
        h2: ({ children }) => {
          const id = slugifyHeading(textFromChildren(children))
          return (
            <h2
              id={id || undefined}
              className={cn(
                'mt-8 scroll-mt-24 text-lg font-semibold tracking-[-0.02em] first:mt-0',
                adminHeading,
              )}
            >
              {children}
            </h2>
          )
        },
        h3: ({ children }) => (
          <h3 className={cn('mt-5 text-base font-semibold', adminHeading)}>{children}</h3>
        ),
        p: ({ children }) => (
          <p className={cn('my-3 text-sm leading-7', adminText)}>{children}</p>
        ),
        ul: ({ children }) => (
          <ul className={cn('my-3 list-disc space-y-1.5 pl-5 text-sm leading-7', adminText)}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={cn('my-3 list-decimal space-y-1.5 pl-5 text-sm leading-7', adminText)}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="break-inside-avoid">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote
            className={cn(
              'my-5 rounded-[14px] border border-[#BFD9F5] bg-[#F0F7FF] px-4 py-3.5 dark:border-sky-500/30 dark:bg-sky-950/30',
              adminText,
            )}
          >
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className={linkClass}
            {...(href?.startsWith('http')
              ? { target: '_blank', rel: 'noreferrer' }
              : undefined)}
          >
            {children}
          </a>
        ),
        hr: () => (
          <hr className="my-8 border-0 border-t border-[rgba(75,120,220,0.16)] dark:border-white/10" />
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-[rgba(75,120,220,0.16)] dark:border-white/10">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className={cn('px-3 py-2 align-top font-semibold', adminHeading)}>{children}</th>
        ),
        td: ({ children }) => (
          <td
            className={cn(
              'border-t border-[rgba(75,120,220,0.08)] px-3 py-2 align-top dark:border-white/10',
              adminText,
            )}
          >
            {children}
          </td>
        ),
        strong: ({ children }) => (
          <strong className={cn('font-semibold', adminHeading)}>{children}</strong>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  )
}

/** Renders bundled legal markdown safely (no raw HTML). */
export function LegalMarkdownBody({ markdown, className }: LegalMarkdownBodyProps) {
  const parts = markdown.split(PAGEBREAK_TOKEN)

  return (
    <div className={cn('legal-markdown mx-auto max-w-[42rem]', className)}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <div
              className="legal-page-break my-6 border-0 border-t border-dashed border-slate-300 print:my-0 print:border-0"
              style={{ breakAfter: 'page', pageBreakAfter: 'always' }}
              aria-hidden
            />
          ) : null}
          <MarkdownChunk markdown={part.trim()} />
        </Fragment>
      ))}
    </div>
  )
}

export function slugifyLegalHeading(text: string): string {
  return slugifyHeading(text)
}
