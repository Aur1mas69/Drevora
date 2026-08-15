import {
  SUPPORT_ACCEPTED_IMAGE_TYPES,
  SUPPORT_MAX_ATTACHMENT_BYTES,
  SUPPORT_MAX_ATTACHMENTS,
} from '@/lib/supportRequestTypes'
import { validateSupportScreenshotFiles } from '@/services/supportAttachmentsService'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
import { X } from 'lucide-react'
import { useRef } from 'react'

type SupportScreenshotFieldProps = {
  files: File[]
  onChange: (files: File[]) => void
  error: string | null
  onError: (message: string | null) => void
  disabled?: boolean
}

export function SupportScreenshotField({
  files,
  onChange,
  error,
  onError,
  disabled = false,
}: SupportScreenshotFieldProps) {
  const addScreenshot = useWorkerChromeText('support.addScreenshot', 'Add screenshot')
  const screenshotLabel = useWorkerChromeText('support.screenshot', 'Screenshot')
  const optionalMax = useWorkerChromeText('support.optionalMax', '(optional, max {{n}})', {
    n: SUPPORT_MAX_ATTACHMENTS,
  })
  const screenshotHint = useWorkerChromeText(
    'support.screenshotHint',
    'JPEG, PNG or WebP. Max {{mb}} MB each. Only photos you select are uploaded.',
    { mb: Math.round(SUPPORT_MAX_ATTACHMENT_BYTES / (1024 * 1024)) },
  )
  const removeFileLabel = useWorkerChromeText('support.removeFile', 'Remove {{name}}')
  const inputRef = useRef<HTMLInputElement>(null)

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selected.length === 0) return

    const next = [...files, ...selected].slice(0, SUPPORT_MAX_ATTACHMENTS)
    const validationError = validateSupportScreenshotFiles(next)
    if (validationError) {
      onError(validationError)
      return
    }
    onError(null)
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index))
    onError(null)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[color:var(--worker-text)]">
        {screenshotLabel}{' '}
        <span className="font-normal text-[color:var(--worker-text-muted)]">{optionalMax}</span>
      </label>
      <p className="text-xs text-[color:var(--worker-text-secondary)]">
        {screenshotHint}
      </p>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#BFE3F5]/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <span className="min-w-0 truncate text-sm text-[color:var(--worker-text)]">
                {file.name}
              </span>
              <button
                type="button"
                aria-label={removeFileLabel.replace(/\{\{\s*name\s*\}\}/g, file.name)}
                disabled={disabled}
                onClick={() => removeAt(index)}
                className="inline-flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length < SUPPORT_MAX_ATTACHMENTS ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={SUPPORT_ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            className="sr-only"
            disabled={disabled}
            onChange={handlePick}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#89CFF0] bg-[#E8F3FE] text-sm font-semibold text-[#0B68BE] hover:bg-[#DCEEFF] disabled:opacity-60"
          >
            {addScreenshot}
          </button>
        </>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
