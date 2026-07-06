import { Button } from '@/components/ui/button'
import type { Contact } from '@/lib/contactTypes'
import { getContactPrimaryName } from '@/lib/contactUtils'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type DeleteContactModalProps = {
  contact: Contact
  errorMessage: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteContactModal({
  contact,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteContactModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onCancel])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[20px] border border-[#D3E9FC] bg-white p-5 shadow-[0_30px_80px_rgba(11,38,70,0.18)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-contact-title"
      >
        <h2
          id="delete-contact-title"
          className="text-xl font-semibold leading-snug tracking-[-0.03em] text-[#113C69]"
        >
          Delete contact?
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#5499BF]">
          This contact will be permanently removed from your directory.
        </p>

        <div className="mt-4 rounded-[14px] border border-[#D3E9FC] bg-[#F5FAFF] px-4 py-3 text-sm font-medium text-[#113C69]">
          {getContactPrimaryName(contact)}
        </div>

        {errorMessage ? (
          <p className="mt-3 rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-10 rounded-[12px] bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
          >
            {isDeleting ? 'Deleting…' : 'Delete contact'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
