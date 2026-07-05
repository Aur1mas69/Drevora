import { Button } from '@/components/ui/button'
import { hasReceiptAttached } from '@/lib/consumableUtils'
import { openConsumableReceipt } from '@/services/consumableReceiptStorageService'
import { FileCheck, FileX } from 'lucide-react'
import { useState } from 'react'

type ConsumableReceiptStatusProps = {
  receiptUrl: string | null
  className?: string
}

export function ConsumableReceiptStatus({
  receiptUrl,
  className = '',
}: ConsumableReceiptStatusProps) {
  const [isOpening, setIsOpening] = useState(false)
  const attached = hasReceiptAttached(receiptUrl)

  async function handleOpen() {
    if (!receiptUrl || !attached) return

    setIsOpening(true)
    try {
      await openConsumableReceipt(receiptUrl)
    } catch {
      window.alert('Unable to open receipt. Please try again.')
    } finally {
      setIsOpening(false)
    }
  }

  if (!attached) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#3D7A9C] ${className}`}
      >
        <FileX className="size-4 shrink-0" />
        No receipt
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void handleOpen()}
      disabled={isOpening}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700 disabled:opacity-60 ${className}`}
    >
      <FileCheck className="size-4 shrink-0" />
      {isOpening ? 'Opening…' : 'Receipt attached'}
    </button>
  )
}

type ConsumableReceiptViewButtonProps = {
  receiptUrl: string
  label?: string
}

export function ConsumableReceiptViewButton({
  receiptUrl,
  label = 'View receipt',
}: ConsumableReceiptViewButtonProps) {
  const [isOpening, setIsOpening] = useState(false)

  async function handleOpen() {
    setIsOpening(true)
    try {
      await openConsumableReceipt(receiptUrl)
    } catch {
      window.alert('Unable to open receipt. Please try again.')
    } finally {
      setIsOpening(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isOpening}
      onClick={() => void handleOpen()}
      className="h-9 rounded-[10px] border-[#D3E9FC] bg-white px-3 text-sm font-semibold text-[#218EE7] hover:bg-[#E8F3FE]"
    >
      {isOpening ? 'Opening…' : label}
    </Button>
  )
}
