import { Button } from '@/components/ui/button'
import { hasReceiptAttached } from '@/lib/consumableUtils'
import { getReceiptDisplayName } from '@/lib/consumableReceiptStorage'
import { openConsumableReceipt } from '@/services/consumableReceiptStorageService'
import { FileImage, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

type ConsumableReceiptFieldProps = {
  existingReceiptPath: string | null
  selectedFile: File | null
  removeExistingReceipt: boolean
  disabled?: boolean
  onSelectFile: (file: File | null) => void
  onRemoveExisting: () => void
  onUndoRemoveExisting: () => void
  onClearSelectedFile: () => void
}

export function ConsumableReceiptField({
  existingReceiptPath,
  selectedFile,
  removeExistingReceipt,
  disabled = false,
  onSelectFile,
  onRemoveExisting,
  onUndoRemoveExisting,
  onClearSelectedFile,
}: ConsumableReceiptFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpening, setIsOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const hasExistingReceipt = hasReceiptAttached(existingReceiptPath) && !removeExistingReceipt
  const existingLabel = existingReceiptPath
    ? getReceiptDisplayName(existingReceiptPath)
    : 'Receipt'

  async function handleViewExisting() {
    if (!existingReceiptPath) return

    setIsOpening(true)
    setOpenError(null)

    try {
      await openConsumableReceipt(existingReceiptPath)
    } catch (error) {
      setOpenError(
        error instanceof Error ? error.message : 'Unable to open receipt. Please try again.',
      )
    } finally {
      setIsOpening(false)
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    onSelectFile(file)
    event.target.value = ''
  }

  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-medium text-[#113C69]">Receipt / Photo</p>

      {hasExistingReceipt ? (
        <div className="mt-1.5 rounded-xl border border-[#D3E9FC] bg-[#F5FAFF]/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#113C69]">
                <FileImage className="size-4 shrink-0 text-[#218EE7]" />
                Receipt attached
              </div>
              <p className="mt-1 truncate text-sm text-[#3D7A9C]">{existingLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isOpening}
                onClick={() => void handleViewExisting()}
                className="h-9 rounded-[10px] border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#218EE7] hover:bg-[#E8F3FE]"
              >
                {isOpening ? 'Opening…' : 'View receipt'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="h-9 rounded-[10px] border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#113C69] hover:bg-[#E8F3FE]"
              >
                Replace receipt
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={onRemoveExisting}
                className="h-9 rounded-[10px] border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Remove receipt
              </Button>
            </div>
          </div>
        </div>
      ) : removeExistingReceipt ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#D3E9FC] bg-[#F5FAFF]/60 px-4 py-3">
          <p className="text-sm font-medium text-[#3D7A9C]">Receipt will be removed when you save.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onUndoRemoveExisting}
            className="h-8 rounded-[10px] border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#218EE7]"
          >
            Undo
          </Button>
        </div>
      ) : null}

      {!hasExistingReceipt ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-1.5 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#D3E9FC] bg-[#F5FAFF]/80 px-4 py-8 text-center transition-colors hover:border-[#218EE7] hover:bg-[#E8F3FE]/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="size-6 text-[#218EE7]" strokeWidth={1.8} />
          <p className="mt-3 text-sm font-semibold text-[#113C69]">Upload receipt or photo</p>
          <p className="mt-1 text-sm text-[#3D7A9C]">JPG, PNG, WEBP or PDF up to 10 MB</p>
        </button>
      ) : null}

      {selectedFile ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#D3E9FC] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#3D7A9C]">
              Selected file
            </p>
            <p className="mt-1 truncate text-sm font-medium text-[#113C69]">
              {getReceiptDisplayName(selectedFile.name)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onClearSelectedFile}
            className="h-8 w-8 shrink-0 rounded-[10px] p-0 text-slate-500 hover:bg-[#F5FAFF]"
            aria-label="Clear selected file"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {openError ? (
        <p className="mt-2 text-sm font-medium text-rose-600">{openError}</p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        disabled={disabled}
        onChange={handleFileChange}
      />
    </div>
  )
}
