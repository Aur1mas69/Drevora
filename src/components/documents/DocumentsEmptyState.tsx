import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'
import type { DocumentsCentreTab } from '@/lib/documentTypes'
import { documentPageCardClass } from './documentUiStyles'

type DocumentsEmptyStateProps = {
  hasActiveFilters: boolean
  activeTab?: DocumentsCentreTab
  onAddFirst: () => void
}

function emptyCopy(hasActiveFilters: boolean, activeTab?: DocumentsCentreTab) {
  if (hasActiveFilters && activeTab === 'workers') {
    return {
      title: 'No worker documents added yet',
      body: 'Worker documents from profiles and compliance records will appear here once added.',
    }
  }

  if (hasActiveFilters) {
    return {
      title: 'No documents found.',
      body: 'Try adjusting your search or filters.',
    }
  }

  return {
    title: 'No documents added yet.',
    body: 'Add company, worker or vehicle documents to track expiry dates and files.',
  }
}

export function DocumentsEmptyState({
  hasActiveFilters,
  activeTab,
  onAddFirst,
}: DocumentsEmptyStateProps) {
  const copy = emptyCopy(hasActiveFilters, activeTab)

  return (
    <div className={`px-6 py-14 text-center ${documentPageCardClass}`}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#EEF6FF] text-[#218EE7] ring-1 ring-[#C5DFFB]/70">
        <FileText className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-[#113C69]">{copy.title}</h2>
      <p className="mt-2 text-sm text-[#5499BF]">{copy.body}</p>
      {!hasActiveFilters ? (
        <Button
          type="button"
          onClick={onAddFirst}
          className="mt-5 h-10 rounded-[12px] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] px-4 text-sm font-semibold text-white"
        >
          <Plus className="mr-1.5 size-4" />
          Add first document
        </Button>
      ) : null}
    </div>
  )
}
