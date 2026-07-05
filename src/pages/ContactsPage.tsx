import AdminLayout from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/button'
import { adminEmptyStateLg, adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import { BookUser } from 'lucide-react'

export default function ContactsPage() {
  return (
    <AdminLayout premiumBackground>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-blue-300">
            Company directory
          </p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Contacts
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${adminTextMuted}`}>
            Keep important company, customer, supplier and site contacts organised.
          </p>
        </div>

        <div className={`${adminEmptyStateLg} sm:px-10`}>
          <div className="mx-auto flex size-14 items-center justify-center rounded-[16px] bg-[#E8F3FE] ring-1 ring-[#D3E9FC] dark:bg-slate-800/70 dark:ring-white/10">
            <BookUser className="size-7 text-[#218EE7] dark:text-blue-300" strokeWidth={1.8} />
          </div>
          <p className={`mt-5 text-sm font-medium ${adminTextMuted}`}>No contacts added yet.</p>
          <Button
            type="button"
            disabled
            className="mt-5 h-10 rounded-[12px] bg-[#218EE7]/50 px-4 text-sm font-semibold text-white"
          >
            Add contact
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}
