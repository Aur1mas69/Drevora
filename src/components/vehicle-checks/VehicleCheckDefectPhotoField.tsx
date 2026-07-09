import { compressImageFile } from '@/lib/compressImageFile'
import {
  getVehicleCheckPhotoDisplayName,
  validateVehicleCheckPhotoFile,
} from '@/lib/vehicleCheckPhotoStorage'
import { getVehicleCheckPhotoSignedUrl } from '@/services/vehicleCheckPhotoStorageService'
import { Camera, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type VehicleCheckDefectPhotoFieldProps = {
  storagePath?: string | null
  previewBlobUrl?: string | null
  selectedFile?: File | null
  onPhotoSelected: (file: File, previewUrl: string) => void
  onPhotoRemoved: () => void
  disabled?: boolean
}

export function VehicleCheckDefectPhotoField({
  storagePath,
  previewBlobUrl,
  selectedFile,
  onPhotoSelected,
  onPhotoRemoved,
  disabled = false,
}: VehicleCheckDefectPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [storedPreviewUrl, setStoredPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadStoredPreview() {
      if (previewBlobUrl || selectedFile || !storagePath?.trim()) {
        setStoredPreviewUrl(null)
        return
      }

      try {
        const signedUrl = await getVehicleCheckPhotoSignedUrl(storagePath)
        if (!cancelled) setStoredPreviewUrl(signedUrl)
      } catch {
        if (!cancelled) setStoredPreviewUrl(null)
      }
    }

    void loadStoredPreview()

    return () => {
      cancelled = true
    }
  }, [previewBlobUrl, selectedFile, storagePath])

  const previewUrl = previewBlobUrl ?? storedPreviewUrl
  const displayName = selectedFile
    ? selectedFile.name
    : storagePath
      ? getVehicleCheckPhotoDisplayName(storagePath)
      : null

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file || disabled) return

    setError(null)
    setIsProcessing(true)

    try {
      const compressed = await compressImageFile(file)
      const validationError = validateVehicleCheckPhotoFile(compressed)
      if (validationError) {
        setError(validationError)
        return
      }

      const nextPreviewUrl = URL.createObjectURL(compressed)
      onPhotoSelected(compressed, nextPreviewUrl)
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : 'Unable to prepare the selected photo.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || isProcessing}
        onChange={(event) => void handleFileChange(event)}
      />

      {previewUrl ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-[#C5DFFB] bg-[#F8FBFF] px-2 py-1.5">
          <img
            src={previewUrl}
            alt={displayName ? `Preview of ${displayName}` : 'Defect photo preview'}
            className="size-12 shrink-0 rounded-[8px] object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#113C69]">
              {displayName ?? 'Defect photo'}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isProcessing}
              className="mt-0.5 text-[11px] font-semibold text-[#0B68BE] hover:underline disabled:opacity-60"
            >
              Replace photo
            </button>
          </div>
          <button
            type="button"
            onClick={onPhotoRemoved}
            disabled={disabled || isProcessing}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#5499BF] hover:bg-white hover:text-rose-600 disabled:opacity-60"
            aria-label="Remove defect photo"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-dashed border-[#C5DFFB] bg-white px-3 py-2 text-xs font-semibold text-[#0B68BE] transition-colors hover:border-[#89CFF0] hover:bg-[#F5FAFF] disabled:opacity-60"
        >
          {isProcessing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Camera className="size-3.5" />
          )}
          {isProcessing ? 'Preparing photo…' : 'Add photo'}
        </button>
      )}

      {error ? <p className="mt-1.5 text-[11px] font-medium text-rose-600">{error}</p> : null}
    </div>
  )
}
