import AdminLayout from '@/layouts/AdminLayout'
import { FaqHelpSection } from '@/components/help/FaqHelpSection'
import { FAQ_SECTIONS } from '@/lib/faqContent'
import { Card, CardContent } from '@/components/ui/card'
import { adminCard, adminHeading, adminPanel, adminTextMuted } from '@/lib/adminUiStyles'
import { Mail } from 'lucide-react'

export default function FaqHelpPage() {
  return (
    <AdminLayout premiumBackground>
      <div className="space-y-5 pb-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
            Support
          </p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
            FAQ / Help
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${adminTextMuted}`}>
            Find quick answers for setting up and using DREVORA.
          </p>
        </div>

        <Card className={`${adminCard} border border-[rgba(75,120,220,0.10)]`}>
          <CardContent className="space-y-10 p-6 sm:p-8">
            {FAQ_SECTIONS.map((section) => (
              <FaqHelpSection key={section.id} section={section} />
            ))}
          </CardContent>
        </Card>

        <div className={`${adminPanel} bg-[#F8FBFF] px-5 py-5 ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 sm:px-6`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={`text-sm font-semibold ${adminHeading}`}>Still need help?</p>
              <p className={`mt-1 text-sm ${adminTextMuted}`}>
                Contact the DREVORA support team and we will get back to you.
              </p>
            </div>
            <a
              href="mailto:support@drevora.app"
              className="inline-flex items-center gap-2 self-start rounded-[12px] bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#1d4ed8] sm:self-center"
            >
              <Mail className="size-4" strokeWidth={2} />
              support@drevora.app
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
