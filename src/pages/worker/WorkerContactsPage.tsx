import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Worker-safe contacts shell.
 *
 * public.contacts has category values including `emergency`, but Phase 3 RLS only
 * exposes contacts via contacts_office_* policies. Drivers cannot SELECT contacts
 * without a new Worker-visible RLS policy (and optionally an explicit worker-visible
 * flag). Until that exists, do not fetch or expose the full contacts directory.
 */
export default function WorkerContactsPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Contacts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Company emergency and operational telephone numbers for Workers.
        </p>
      </header>

      <Card className="gap-0 rounded-[1.75rem] border border-slate-100 bg-white py-0 shadow-lg shadow-slate-200/60">
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-lg font-semibold text-slate-950">
            No Worker contacts available yet
          </CardTitle>
          <CardDescription className="text-slate-500">
            Safe Worker-visible telephone contacts require a database policy that
            allows Drivers to read only approved operational contacts (for example
            category <span className="font-medium">emergency</span> / office /
            breakdown). That access is not enabled yet, so this page stays empty
            rather than showing the Office contacts directory.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F6F9FF] px-4 py-8 text-center text-sm text-slate-500">
            Contact your office for emergency numbers until Worker contacts are
            enabled.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
