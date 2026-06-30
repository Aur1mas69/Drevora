import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function ProfilePage() {
  return (
    <Card className="gap-0 border-white/10 bg-[#121829]/90 py-0 text-white ring-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-xl text-white">Profile</CardTitle>
        <CardDescription className="text-slate-400">
          Driver profile details and settings will appear here.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="rounded-lg border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
          Profile setup is coming soon.
        </div>
      </CardContent>
    </Card>
  )
}

export default ProfilePage
