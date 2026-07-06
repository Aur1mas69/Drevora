import { Button } from '@/components/ui/button'
import { BookUser } from 'lucide-react'
import { contactPageCardClass, contactPrimaryButtonClass } from './contactUiStyles'

type ContactsEmptyStateProps = {
  onAddFirst: () => void
}

export function ContactsEmptyState({ onAddFirst }: ContactsEmptyStateProps) {
  return (
    <div className={`px-6 py-14 text-center ${contactPageCardClass}`}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E8F3FE] ring-1 ring-[#D3E9FC]">
        <BookUser className="size-7 text-[#218EE7]" strokeWidth={1.8} />
      </div>
      <p className="mt-5 text-sm font-medium text-[#5499BF]">No contacts added yet.</p>
      <Button type="button" onClick={onAddFirst} className={`mt-5 ${contactPrimaryButtonClass}`}>
        Add first contact
      </Button>
    </div>
  )
}
