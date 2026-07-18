import { getDocumentFileDisplayName } from '@/lib/documentFileStorage'
import type { Document as DrevoraDocument } from '@/lib/documentTypes'
import { validateDocumentFile } from '@/lib/documentFileStorage'
import { FileText, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

type DocumentFileFieldProps = {
  existingPath: string | null
  selectedFile: File | null
  removeFile: boolean
  onSelectFile: (file: File | null) => void
  onRemoveExisting: () => void
  onClearSelection: () => void
}

export function DocumentFileField({
  existingPath,
  selectedFile,
  removeFile,
  onSelectFile,
  onRemoveExisting,
  onClearSelection,
}: DocumentFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    const validationError = validateDocumentFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    onSelectFile(file)
  }

  const existingLabel = existingPath ? getDocumentFileDisplayName(existingPath) : null
  const showExisting = Boolean(existingLabel) && !removeFile && !selectedFile

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {selectedFile ? (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#C5DFFB] bg-[#F5FAFF] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-[#218EE7]" />
            <span className="truncate text-sm font-medium text-[#113C69]">{selectedFile.name}</span>
          </div>
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-lg p-1 text-[#5499BF] hover:bg-white hover:text-[#113C69] dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
            aria-label="Remove selected file"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : showExisting ? (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#C5DFFB] bg-[#F5FAFF] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-[#218EE7]" />
            <span className="truncate text-sm font-medium text-[#113C69]">{existingLabel}</span>
          </div>
          <button
            type="button"
            onClick={onRemoveExisting}
            className="text-xs font-semibold text-rose-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#C5DFFB] bg-white px-4 py-6 text-sm font-semibold text-[#0B68BE] transition-colors hover:border-[#89CFF0] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
        >
          <Upload className="size-4" />
          Upload PDF or image (max 10 MB)
        </button>
      )}

      {!selectedFile && !showExisting ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 text-xs font-semibold text-[#0B68BE] hover:underline"
        >
          Choose file
        </button>
      ) : null}

      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  )
}

export function getDocumentStoragePath(record: DrevoraDocument): string | null {
  return record.filePath?.trim() || record.fileUrl?.trim() || null
}
