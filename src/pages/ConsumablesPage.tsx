import AdminLayout from '@/layouts/AdminLayout'
import { adminEmptyStateLg, adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import { Package } from 'lucide-react'

export default function ConsumablesPage() {
  return (
    <AdminLayout premiumBackground>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-blue-300">
            Fleet operations
          </p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Consumables
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${adminTextMuted}`}>
            Track fuel, fluids, AdBlue, admixtures and other operating consumables.
          </p>
        </div>

        <div className={`${adminEmptyStateLg} sm:px-10`}>
          <div className="mx-auto flex size-14 items-center justify-center rounded-[16px] bg-[#EEF4FF] ring-1 ring-[#BFDBFE] dark:bg-slate-800/70 dark:ring-white/10">
            <Package className="size-7 text-[#2563EB] dark:text-blue-300" strokeWidth={1.8} />
          </div>
          <p className={`mt-5 text-sm font-medium ${adminTextMuted}`}>No consumables records yet.</p>
        </div>
      </div>
    </AdminLayout>
  )
}
