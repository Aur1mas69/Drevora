import AdminLayout from '@/layouts/AdminLayout'
import { Gauge } from 'lucide-react'

type AdminComingSoonPageProps = {
  title: string
  description?: string
}

export function AdminComingSoonPage({
  title,
  description = 'This module is under development and will be available in a future release.',
}: AdminComingSoonPageProps) {
  return (
    <AdminLayout premiumBackground>
      <div className="rounded-[20px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-14 shadow-[0_8px_24px_rgba(40,80,140,0.05)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)] sm:px-10">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div
            className="relative mb-8 flex h-32 w-full max-w-sm items-center justify-center"
            aria-hidden="true"
          >
            <div className="absolute inset-x-8 top-4 h-24 rounded-[18px] border border-[rgba(75,120,220,0.12)] bg-gradient-to-br from-[#EEF4FF] to-[#EAF2FF] dark:border-white/10 dark:from-slate-800/90 dark:to-slate-900/80" />
            <div className="absolute left-12 top-10 h-3 w-20 rounded-full bg-white/80 dark:bg-slate-700/80" />
            <div className="absolute left-12 top-16 h-3 w-28 rounded-full bg-white/60 dark:bg-slate-700/60" />
            <div className="absolute right-14 top-12 flex size-10 items-center justify-center rounded-full bg-[#2563EB]/10 ring-1 ring-[#2563EB]/20 dark:bg-blue-500/15 dark:ring-blue-400/25">
              <Gauge className="size-5 text-[#2563EB] dark:text-blue-300" />
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-blue-300">
            Coming Soon
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
            {title}
          </h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminComingSoonPage
