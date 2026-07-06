import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'

const tableCardClass =
  'mx-auto max-w-6xl rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/88 py-0 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35'

const tableHeadClass =
  'border-b border-[#D3E9FC]/70 bg-[#F5FAFF]/90 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0B68BE]'

const tableRowClass =
  'border-b border-[#D3E9FC]/45 transition-colors last:border-b-0 hover:bg-[#F5FAFF]/80'

export const workerProfileTableCardClass = tableCardClass
export const workerProfileTableHeadClass = tableHeadClass
export const workerProfileTableRowClass = tableRowClass

type WorkerProfileTabShellProps = {
  isLoading: boolean
  errorMessage: string | null
  isEmpty: boolean
  emptyMessage: string
  emptyIcon: LucideIcon
  viewAllHref?: string
  viewAllLabel?: string
  children: ReactNode
}

export function WorkerProfileTabShell({
  isLoading,
  errorMessage,
  isEmpty,
  emptyMessage,
  emptyIcon: EmptyIcon,
  viewAllHref,
  viewAllLabel = 'View all',
  children,
}: WorkerProfileTabShellProps) {
  if (isLoading) {
    return (
      <Card className={tableCardClass}>
        <CardContent className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-xl bg-[#E8F3FE]/70"
            />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (errorMessage) {
    return (
      <Card className={tableCardClass}>
        <CardContent className="px-5 py-8 text-center">
          <p className="text-sm font-semibold text-rose-600">{errorMessage}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Try switching tabs or refreshing the page.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isEmpty) {
    return (
      <Card className={tableCardClass}>
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#E8F3FE] text-[#0B68BE] ring-1 ring-[#C5DFFB]/60">
            <EmptyIcon className="size-5" strokeWidth={1.9} />
          </div>
          <p className="mt-3 text-base font-semibold tracking-[-0.02em] text-[#113C69]">
            {emptyMessage}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={tableCardClass}>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
        {viewAllHref ? (
          <div className="border-t border-[#D3E9FC]/60 px-5 py-3 text-right">
            <Link
              to={viewAllHref}
              className="text-sm font-semibold text-[#218EE7] transition-colors hover:text-[#0B68BE]"
            >
              {viewAllLabel}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
