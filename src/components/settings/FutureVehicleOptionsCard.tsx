import { CheckCircle2, Clock3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const futureVehicleOptions = [
  { label: 'Manual vehicle entry', status: 'active' as const },
  { label: 'DVLA lookup', status: 'coming-later' as const },
  { label: 'What3Words location support', status: 'coming-later' as const },
  { label: 'Fuel & Fluids tracking', status: 'coming-later' as const },
  { label: 'Secondary / trailer registration', status: 'coming-later' as const },
]

export function FutureVehicleOptionsCard() {
  return (
    <Card className="mt-6 rounded-[20px] border border-[rgba(75,120,220,0.10)] bg-white/95 py-0 shadow-[0_8px_24px_rgba(40,80,140,0.05)] ring-1 ring-blue-100/70">
      <CardContent className="p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
            Fleet roadmap
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
            Future Vehicle Options
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Vehicle setup capabilities planned for DREVORA. Only manual entry is available in the
            MVP.
          </p>
        </div>

        <ul className="mt-6 space-y-3">
          {futureVehicleOptions.map((option) => {
            const isActive = option.status === 'active'

            return (
              <li
                key={option.label}
                className={`flex items-center justify-between gap-4 rounded-[16px] px-4 py-3 ring-1 ${
                  isActive
                    ? 'bg-[#EEF4FF] ring-[#BFDBFE]'
                    : 'bg-[#F8FAFC] ring-[#E2E8F0] opacity-80'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <CheckCircle2 className="size-4 shrink-0 text-[#16A34A]" strokeWidth={2.2} />
                  ) : (
                    <Clock3 className="size-4 shrink-0 text-slate-400" strokeWidth={2.2} />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      isActive ? 'text-slate-800' : 'text-slate-500'
                    }`}
                  >
                    {option.label}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    isActive
                      ? 'bg-[#DCFCE7] text-[#16A34A]'
                      : 'bg-[#F1F5F9] text-slate-500'
                  }`}
                >
                  {isActive ? 'Active' : 'Coming later'}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
