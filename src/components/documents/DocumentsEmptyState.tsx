import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'
import type {
  DocumentsCentreTab,
  DocumentsPageMode,
  DocumentWorkerUploadStatusFilter,
} from '@/lib/documentTypes'
import { documentPageCardClass } from './documentUiStyles'

type DocumentsEmptyStateProps = {
  hasActiveFilters: boolean
  activeTab?: DocumentsCentreTab
  pageMode?: DocumentsPageMode
  workerUploadStatusFilter?: DocumentWorkerUploadStatusFilter
  onAddFirst: () => void
}

function emptyCopy(options: {
  hasActiveFilters: boolean
  activeTab?: DocumentsCentreTab
  pageMode?: DocumentsPageMode
  workerUploadStatusFilter?: DocumentWorkerUploadStatusFilter
}) {
  const { hasActiveFilters, activeTab, pageMode, workerUploadStatusFilter } = options

  if (pageMode === 'worker_uploads') {
    if (workerUploadStatusFilter === 'pending_review') {
      return {
        title: 'No Worker documents are waiting for review.',
        body: 'New Worker uploads will appear here as soon as they are submitted.',
        showAdd: false,
      }
    }
    if (workerUploadStatusFilter === 'archived') {
      return {
        title: 'No archived Worker uploads.',
        body: 'Soft-deleted Worker submissions will appear here and can be restored.',
        showAdd: false,
      }
    }
    return {
      title: 'No Worker uploads found.',
      body: 'Try adjusting your search or status filter.',
      showAdd: false,
    }
  }

  if (hasActiveFilters && activeTab === 'workers') {
    return {
      title: 'No worker documents added yet',
      body: 'Worker documents from profiles and compliance records will appear here once added.',
      showAdd: false,
    }
  }

  if (hasActiveFilters) {
    return {
      title: 'No documents found.',
      body: 'Try adjusting your search or filters.',
      showAdd: false,
    }
  }

  return {
    title: 'No documents added yet.',
    body: 'Add company, worker or vehicle documents to track expiry dates and files.',
    showAdd: true,
  }
}

export function DocumentsEmptyState({
  hasActiveFilters,
  activeTab,
  pageMode,
  workerUploadStatusFilter,
  onAddFirst,
}: DocumentsEmptyStateProps) {
  const copy = emptyCopy({
    hasActiveFilters,
    activeTab,
    pageMode,
    workerUploadStatusFilter,
  })

  return (
    <div className={`px-6 py-14 text-center ${documentPageCardClass}`}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#EEF6FF] text-[#218EE7] ring-1 ring-[#C5DFFB]/70">
        <FileText className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-[#113C69]">{copy.title}</h2>
      <p className="mt-2 text-sm text-[#5499BF]">{copy.body}</p>
      {copy.showAdd ? (
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
