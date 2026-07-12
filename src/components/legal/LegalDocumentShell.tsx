import AdminLayout from '@/layouts/AdminLayout'
import { Card, CardContent } from '@/components/ui/card'
import { adminCard, adminHeading, adminText, adminTextMuted } from '@/lib/adminUiStyles'

type LegalDocumentShellProps = {
  title: string
  subtitle: string
}

export function LegalDocumentShell({ title, subtitle }: LegalDocumentShellProps) {
  return (
    <AdminLayout premiumBackground>
      <div className="space-y-5 pb-10">
        <div>
          <h1 className={`text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>{title}</h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${adminTextMuted}`}>{subtitle}</p>
        </div>

        <Card className={`${adminCard} border border-[rgba(75,120,220,0.10)]`}>
          <CardContent className="bg-[#F8FBFF] p-6 sm:p-8 dark:bg-slate-900/50">
            <p className={`text-sm leading-6 ${adminText}`}>
              Legal content is being prepared and will be published here.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
