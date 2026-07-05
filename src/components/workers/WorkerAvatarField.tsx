import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { validateWorkerAvatarFile } from '@/lib/workerAvatarStorage'
import { WorkerAvatar } from '@/components/workers/WorkerAvatar'

type WorkerAvatarFieldProps = {
  firstName: string
  lastName: string
  avatarUrl?: string | null
  pendingFile: File | null
  removeAvatar: boolean
  isUploading?: boolean
  errorMessage?: string | null
  onFileSelect: (file: File | null) => void
  onRemoveAvatar: () => void
  onClearPending: () => void
}

export function WorkerAvatarField({
  firstName,
  lastName,
  avatarUrl,
  pendingFile,
  removeAvatar,
  isUploading = false,
  errorMessage,
  onFileSelect,
  onRemoveAvatar,
  onClearPending,
}: WorkerAvatarFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const previewUrl = useMemo(() => {
    if (pendingFile) return URL.createObjectURL(pendingFile)
    return null
  }, [pendingFile])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const displayAvatarUrl = removeAvatar ? null : previewUrl ?? avatarUrl
  const hasCustomAvatar = Boolean(displayAvatarUrl && !removeAvatar)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!file) return

    const validationError = validateWorkerAvatarFile(file)
    if (validationError) {
      setLocalError(validationError)
      onFileSelect(null)
      return
    }

    setLocalError(null)
    onFileSelect(file)
  }

  return (
    <section className="rounded-[18px] bg-[#F8FBFF]/80 p-4 ring-1 ring-[#D3E9FC]/80 dark:bg-slate-900/40 dark:ring-white/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <WorkerAvatar
          firstName={firstName}
          lastName={lastName}
          avatarUrl={displayAvatarUrl}
          size="lg"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
            Worker photo
          </p>
          <p className="mt-1 text-xs font-medium text-[#5499BF]/90 dark:text-slate-400">
            Upload JPG, PNG or WEBP up to 5 MB. Leave empty to use initials.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              className="h-9 rounded-xl border border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#113C69] hover:bg-[#F5FAFF]"
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              Change avatar
            </Button>

            {hasCustomAvatar || pendingFile ? (
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={() => {
                  onClearPending()
                  onRemoveAvatar()
                }}
                className="h-9 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="size-4" />
                Remove avatar
              </Button>
            ) : null}
          </div>

          {(errorMessage ?? localError) ? (
            <p className="mt-2 text-xs font-medium text-rose-500">
              {errorMessage ?? localError}
            </p>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </section>
  )
}
