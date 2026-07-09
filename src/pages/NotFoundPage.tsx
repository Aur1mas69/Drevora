import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#0B1023] px-4 py-12 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md gap-0 border-white/10 bg-[#121829]/90 py-0 text-center text-white ring-0">
        <CardHeader className="px-6 pt-8 pb-4">
          <CardTitle className="text-3xl text-white">404</CardTitle>
          <CardDescription className="text-slate-400">
            This DREVORA page does not exist.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          <Button
            asChild
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Link to="/login" replace>
              Back to login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default NotFoundPage
