import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function WorkerLoginPage() {
  const navigate = useNavigate()

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center bg-[#0B1023] px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 size-[320px] translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 -ml-2 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Button>

        <Card className="w-full gap-0 border-white/10 bg-white py-0 shadow-2xl shadow-black/40 ring-0">
          <CardHeader className="items-center space-y-4 px-8 pt-10 pb-6 text-center">
            <img
              src="/drevora-logo.png"
              alt="DREVORA"
              className="mx-auto max-h-28 max-w-full object-contain"
            />
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-[0.06em] text-[#0B1023]">
                Worker Login
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Worker portal sign-in is coming soon.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-8 pb-8 text-center">
            <p className="text-sm leading-6 text-slate-600">
              DREVORA worker access for timesheets, vehicle checks and daily tasks is not
              available yet. Office teams can use Admin Login in the meantime.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin-login')}
              className="h-11 w-full rounded-[16px] border-slate-200 bg-slate-50 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Go to Admin Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
