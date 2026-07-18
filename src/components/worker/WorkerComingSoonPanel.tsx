import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type WorkerComingSoonPanelProps = {
  title: string
  description: string
}

/** Minimal Worker-safe placeholder — never mounts Office UI. */
export function WorkerComingSoonPanel({
  title,
  description,
}: WorkerComingSoonPanelProps) {
  return (
    <Card className="gap-0 rounded-[1.75rem] border border-slate-100 bg-white py-0 shadow-lg shadow-slate-200/60">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-xl font-semibold text-slate-950">{title}</CardTitle>
        <CardDescription className="text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F6F9FF] px-4 py-8 text-center text-sm font-medium text-slate-500">
          Coming soon
        </div>
      </CardContent>
    </Card>
  )
}
