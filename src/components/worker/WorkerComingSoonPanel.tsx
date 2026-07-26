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
    <Card className="worker-card gap-0 rounded-[1.75rem] border-[color:var(--worker-border)] bg-[color:var(--worker-card)] py-0 shadow-none">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-xl font-semibold text-[color:var(--worker-text)]">
          {title}
        </CardTitle>
        <CardDescription className="text-[color:var(--worker-text-secondary)]">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="rounded-2xl border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-4 py-8 text-center text-sm font-medium text-[color:var(--worker-text-secondary)]">
          Coming soon
        </div>
      </CardContent>
    </Card>
  )
}
