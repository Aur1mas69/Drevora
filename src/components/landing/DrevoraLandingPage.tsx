import {
  Boxes,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Files,
  Fingerprint,
  Globe2,
  IdCard,
  LayoutDashboard,
  MessageCircle,
  Package,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

type LandingPageProps = {
  onAdminLogin: () => void
  onWorkerLogin: () => void
}

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Solutions', href: '#modules' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#benefits' },
  { label: 'Resources', href: '#problem' },
]

type ModuleItem = {
  icon: LucideIcon
  title: string
  description: string
}

const heroFeatureCards: ModuleItem[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Real-time overview of your daily operations.',
  },
  { icon: Users, title: 'Workers', description: 'Manage your team, roles and details.' },
  { icon: Truck, title: 'Vehicles', description: 'Track vehicles, status and maintenance.' },
  { icon: ClipboardList, title: 'Timesheets', description: 'Log hours and track attendance.' },
  { icon: Calendar, title: 'Holiday Requests', description: 'Manage leave and approvals.' },
  { icon: ShieldCheck, title: 'Vehicle Checks', description: 'Daily checks and defect reporting.' },
  { icon: FileText, title: 'Driver Reports', description: 'Incidents, defects and observations.' },
  { icon: Files, title: 'Documents', description: 'Keep documents organised and up to date.' },
  { icon: IdCard, title: 'Contacts', description: 'Company, customer and site contacts.' },
  { icon: Package, title: 'Consumables', description: 'Track stock and manage usage.' },
]

const dashboardSidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Users, label: 'Workers' },
  { icon: Truck, label: 'Vehicles' },
  { icon: ClipboardList, label: 'Timesheets' },
  { icon: Calendar, label: 'Holiday Requests' },
  { icon: ShieldCheck, label: 'Vehicle Checks' },
  { icon: FileText, label: 'Driver Reports' },
  { icon: Files, label: 'Documents' },
  { icon: IdCard, label: 'Contacts' },
  { icon: Package, label: 'Consumables' },
] as const

const dashboardCards = [
  { icon: Users, label: 'Workers' },
  { icon: Truck, label: 'Vehicles' },
  { icon: ClipboardList, label: 'Timesheets' },
  { icon: ShieldCheck, label: 'Vehicle Checks' },
  { icon: FileText, label: 'Driver Reports' },
  { icon: Files, label: 'Documents' },
] as const

const recentActivity = [
  'Vehicle check completed',
  'Timesheet submitted',
  'Holiday request approved',
  'Driver report logged',
] as const

const floatingKpis = [
  { icon: Truck, label: 'Vehicles', value: '42', hint: 'On the road' },
  { icon: Users, label: 'Workers', value: '128', hint: 'Active' },
  { icon: Files, label: 'Documents', value: 'Up to date', hint: 'Records ready' },
  { icon: ClipboardList, label: 'Jobs Today', value: '24', hint: 'In progress' },
] as const

const benefitStrip = [
  { icon: Globe2, title: 'Built for UK & EU transport teams' },
  { icon: Smartphone, title: 'Mobile-first for workers' },
  { icon: Files, title: '24-month+ record keeping ready' },
  { icon: LayoutDashboard, title: 'Office dashboard for managers' },
] as const

const problemCards = [
  {
    icon: FileText,
    title: 'Paper forms',
    description: 'Handwritten checks and reports that are easy to lose and hard to search.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp messages',
    description: 'Important updates buried in chats with no clear record or audit trail.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Spreadsheets',
    description: 'Manual tracking that quickly becomes messy, outdated and error-prone.',
  },
] as const

const howItWorksSteps = [
  {
    step: '01',
    icon: Boxes,
    title: 'Set up your company',
    description:
      'Add your workers, vehicles and company settings so DREVORA matches the way your transport business operates.',
  },
  {
    step: '02',
    icon: Smartphone,
    title: 'Workers submit information',
    description:
      'Drivers and workers can complete timesheets, vehicle checks, holiday requests and reports from a mobile-friendly system.',
  },
  {
    step: '03',
    icon: LayoutDashboard,
    title: 'Office stays in control',
    description:
      'Managers can review submissions, track documents, approve timesheets and keep daily operations organised from one dashboard.',
  },
] as const

const platformModules: ModuleItem[] = [
  { icon: Users, title: 'Workers', description: 'Manage workers, roles, contact details and availability.' },
  { icon: Truck, title: 'Vehicles', description: 'Track vehicles, status, documents and fleet information.' },
  {
    icon: ShieldCheck,
    title: 'Vehicle Checks',
    description: 'Create check templates and keep daily checks organised.',
  },
  {
    icon: ClipboardList,
    title: 'Timesheets',
    description: 'Record hours, review work time and prepare payroll information.',
  },
  {
    icon: Calendar,
    title: 'Holiday Requests',
    description: 'Let workers request holidays and managers approve or reject.',
  },
  {
    icon: FileText,
    title: 'Driver Reports',
    description: 'Drivers report issues, damage, site problems or operational incidents.',
  },
  { icon: Files, title: 'Documents', description: 'Manage company, worker and vehicle documents in one place.' },
  { icon: IdCard, title: 'Contacts', description: 'Keep company, customer, supplier and site contacts organised.' },
  {
    icon: Package,
    title: 'Consumables',
    description: 'Track fuel, fluids, AdBlue, admixtures and other operating consumables.',
  },
]

function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const iconSize = size === 'sm' ? 'size-8' : 'size-9'
  const textSize = size === 'sm' ? 'text-lg' : 'text-xl'

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex ${iconSize} items-center justify-center rounded-xl bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white shadow-[0_6px_16px_rgba(11,104,190,0.35)]`}
      >
        <Boxes className="size-5" strokeWidth={2.1} />
      </div>
      <div className="leading-none">
        <span className={`block font-extrabold tracking-[-0.02em] text-[#113C69] ${textSize}`}>
          DREVORA
        </span>
        {size === 'md' ? (
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3D7A9C]">
            Fleet &amp; Team Management
          </span>
        ) : null}
      </div>
    </div>
  )
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#218EE7]">{children}</p>
  )
}

function PrimaryButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl bg-[#218EE7] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(33,142,231,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0B68BE] hover:shadow-[0_16px_36px_rgba(11,104,190,0.36)] ${className}`}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl border border-[#BDDDFB] bg-white px-6 py-3 text-sm font-semibold text-[#0B68BE] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#83C1F6] hover:bg-[#E8F3FE] ${className}`}
    >
      {children}
    </button>
  )
}

function FloatingKpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-[#D3E9FC] bg-white/90 px-3 py-2.5 shadow-[0_12px_30px_rgba(11,38,70,0.10)] backdrop-blur-sm">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#E8F3FE] text-[#218EE7]">
        <Icon className="size-[18px]" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#3D7A9C]">
          {label}
        </p>
        <p className="truncate text-sm font-bold leading-tight text-[#113C69]">{value}</p>
        <p className="truncate text-[9px] font-medium text-[#5499BF]">{hint}</p>
      </div>
    </div>
  )
}

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#D3E9FC] bg-white shadow-[0_28px_70px_rgba(11,38,70,0.16)]">
      <div className="flex items-center gap-2 border-b border-[#E1EEFD] bg-[#F5FAFF] px-3 py-2.5">
        <div className="size-2 rounded-full bg-[#F87171]" />
        <div className="size-2 rounded-full bg-[#FBBF24]" />
        <div className="size-2 rounded-full bg-[#34D399]" />
        <span className="ml-1 text-[11px] font-medium text-[#5499BF]">drevora.app</span>
      </div>
      <div className="flex min-h-[300px] sm:min-h-[340px]">
        <div className="hidden w-[132px] shrink-0 flex-col gap-0.5 border-r border-[#E8F3FE] bg-[#F5FAFF] px-2 py-3 sm:flex">
          <div className="mb-1.5 flex items-center gap-2 px-1.5">
            <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white">
              <Boxes className="size-3.5" strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-extrabold tracking-[-0.02em] text-[#113C69]">
              DREVORA
            </span>
          </div>
          {dashboardSidebarItems.map(({ icon: Icon, label }, index) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[9.5px] font-medium ${
                index === 0
                  ? 'bg-[#218EE7] text-white shadow-[0_6px_14px_rgba(33,142,231,0.32)]'
                  : 'text-[#3D7A9C]'
              }`}
            >
              <Icon className="size-3 shrink-0" strokeWidth={2} />
              <span className="truncate">{label}</span>
            </div>
          ))}
          <div className="mt-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[9.5px] font-medium text-[#5499BF]">
            <Fingerprint className="size-3 shrink-0" strokeWidth={2} />
            Settings
          </div>
        </div>

        <div className="min-w-0 flex-1 bg-white p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#113C69]">Dashboard</p>
              <p className="text-[10px] text-[#5499BF]">Fleet &amp; team overview</p>
            </div>
            <span className="rounded-full bg-[#E8F3FE] px-2.5 py-1 text-[9px] font-semibold text-[#0B68BE]">
              This week
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {dashboardCards.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-xl border border-[#E1EEFD] bg-[#F5FAFF] px-2.5 py-2.5"
              >
                <div className="flex size-6 items-center justify-center rounded-md bg-white text-[#218EE7] ring-1 ring-[#D3E9FC]">
                  <Icon className="size-3.5" strokeWidth={2} />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-[#113C69]">{label}</p>
                <div className="mt-1 h-1 w-full rounded-full bg-[#D3E9FC]">
                  <div className="h-1 w-2/3 rounded-full bg-gradient-to-r from-[#218EE7] to-[#41A1EF]" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-[#E1EEFD] bg-white p-2.5">
            <p className="text-[10px] font-bold text-[#113C69]">Recent Activity</p>
            <div className="mt-1.5 space-y-1">
              {recentActivity.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-lg bg-[#F5FAFF] px-2 py-1.5"
                >
                  <span className="flex items-center gap-1.5 text-[9px] font-medium text-[#0D477F]">
                    <span className="size-1.5 rounded-full bg-[#34D399]" />
                    {item}
                  </span>
                  <span className="text-[8px] font-medium text-[#5499BF]">Today</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhoneMockup() {
  return (
    <div className="w-full max-w-[210px]">
      <div className="overflow-hidden rounded-[26px] border-[5px] border-[#113C69] bg-white shadow-[0_24px_54px_rgba(11,38,70,0.32)]">
        <div className="bg-[#113C69] px-4 py-1.5 text-center">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/30" />
        </div>
        <div className="bg-[#F5FAFF] px-3 pb-4 pt-3">
          <div className="flex items-center gap-1.5">
            <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white">
              <Boxes className="size-3" strokeWidth={2.2} />
            </div>
            <span className="text-[10px] font-extrabold text-[#113C69]">DREVORA</span>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-[#113C69]">Daily tasks</p>
          <p className="text-[8px] text-[#5499BF]">Mobile-first for workers</p>
          <div className="mt-2.5 space-y-1.5">
            {['Timesheets', 'Vehicle Checks', 'Holiday Requests', 'Driver Reports'].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-lg border border-[#D3E9FC] bg-white px-2.5 py-2"
              >
                <span className="text-[8.5px] font-semibold text-[#0D477F]">{item}</span>
                <span className="text-[7.5px] font-semibold text-[#218EE7]">Open</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LandingPage({ onAdminLogin }: LandingPageProps) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-svh overflow-x-hidden bg-[#F5FAFF] text-[#113C69] antialiased">
      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#D3E9FC] bg-[#F5FAFF]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <a href="#top" className="shrink-0 no-underline" aria-label="DREVORA home">
            <BrandMark size="sm" />
          </a>

          <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[#3D7A9C] no-underline transition-colors hover:text-[#0B68BE]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onAdminLogin}
              className="hidden h-9 items-center rounded-lg px-3 text-sm font-semibold text-[#0B68BE] transition-colors hover:bg-[#E8F3FE] sm:inline-flex"
            >
              Log in
            </button>
            <PrimaryButton onClick={() => scrollTo('contact')} className="h-9 px-4 py-0">
              Request Demo
            </PrimaryButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden pt-[68px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-120px] left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(131,193,246,0.28)_0%,transparent_65%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-180px] top-[80px] h-[480px] w-[480px] rounded-full bg-[radial-gradient(ellipse,rgba(191,227,245,0.45)_0%,transparent_60%)]"
        />

        <div className="relative mx-auto max-w-7xl px-6 pb-10 pt-10 sm:px-8 sm:pb-12 sm:pt-12 lg:px-8 lg:pb-14 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] lg:gap-12 xl:gap-14">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#BDDDFB] bg-[#E8F3FE] px-4 py-1.5 text-xs font-semibold text-[#0B68BE]">
                <span className="size-1.5 rounded-full bg-[#218EE7]" />
                Built for transport teams
              </div>

              <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.03em] text-[#113C69] sm:text-5xl lg:text-6xl">
                Manage your fleet, workers and daily operations with{' '}
                <span className="text-[#218EE7]">DREVORA</span> — all in{' '}
                <span className="text-[#218EE7]">one place</span>.
              </h1>

              <p className="mt-4 text-lg font-semibold text-[#0D477F] sm:text-xl">
                Save time. Reduce paperwork. Keep your transport business moving.
              </p>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#3D7A9C] sm:text-lg sm:leading-relaxed">
                DREVORA helps transport companies manage vehicles, workers, timesheets, holiday
                requests, vehicle checks, driver reports, documents, contacts and consumables from
                one simple platform.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <PrimaryButton onClick={() => scrollTo('contact')}>Request Demo</PrimaryButton>
                <SecondaryButton onClick={() => scrollTo('features')}>View Features</SecondaryButton>
              </div>

              <p className="mt-5 flex items-center gap-2 text-sm text-[#3D7A9C]">
                <ShieldCheck className="size-4 shrink-0 text-[#218EE7]" strokeWidth={2} />
                Secure platform · Record keeping ready · No card required for Early Access
              </p>
            </div>

            <div className="relative min-w-0 lg:flex lg:items-center lg:justify-end">
              <div className="w-full lg:max-w-[600px]">
                <div className="relative mx-auto w-full max-w-[520px] lg:mx-0 lg:max-w-none">
                  <DashboardMockup />

                  {/* Floating KPI cards */}
                  <div className="pointer-events-none absolute top-2 left-0 hidden w-[140px] sm:block">
                    <FloatingKpiCard {...floatingKpis[0]} />
                  </div>
                  <div className="pointer-events-none absolute top-0 right-2 hidden w-[140px] md:block">
                    <FloatingKpiCard {...floatingKpis[1]} />
                  </div>
                  <div className="pointer-events-none absolute top-[42%] -left-4 hidden w-[140px] lg:block">
                    <FloatingKpiCard {...floatingKpis[3]} />
                  </div>

                  {/* Phone overlapping the dashboard */}
                  <div className="absolute -bottom-4 -right-2 z-10 hidden w-[40%] min-w-[140px] max-w-[190px] rotate-[4deg] sm:block lg:-right-4">
                    <PhoneMockup />
                  </div>
                </div>

                {/* Mobile-only KPI row */}
                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:hidden">
                  {floatingKpis.map((kpi) => (
                    <FloatingKpiCard key={kpi.label} {...kpi} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Modules / features */}
          <div
            id="features"
            className="border-t border-[#D3E9FC]/80 pt-16 lg:pt-20"
          >
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D3E9FC] bg-[#E8F3FE] px-4 py-1.5 text-xs font-semibold text-[#0B68BE]">
                <span className="size-1.5 rounded-full bg-[#218EE7]" />
                All modules
              </div>

              <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-[-0.02em] text-[#113C69] sm:text-3xl lg:text-4xl">
                Everything your transport team needs in one platform
              </h2>

              <p className="mt-3 text-base leading-relaxed text-[#3D7A9C] sm:text-lg">
                Manage workers, vehicles, timesheets, checks, reports, documents, contacts and
                consumables from one simple system.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {heroFeatureCards.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[#D3E9FC] bg-white/80 p-5 shadow-sm shadow-[#BDDDFB]/25 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:shadow-[#BDDDFB]/40"
                >
                  <div className="flex size-11 items-center justify-center rounded-xl border border-[#D3E9FC] bg-[#E8F3FE] text-[#218EE7]">
                    <Icon className="size-5" strokeWidth={2} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#113C69]">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#3D7A9C]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefit strip */}
      <section id="benefits" className="px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1200px] gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {benefitStrip.map(({ icon: Icon, title }) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-2xl border border-[#D3E9FC] bg-[#E8F3FE]/60 px-4 py-4"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#218EE7] ring-1 ring-[#D3E9FC]">
                <Icon className="size-5" strokeWidth={2} />
              </div>
              <p className="text-sm font-semibold leading-snug text-[#0D477F]">{title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Problem section */}
      <section id="problem" className="px-6 py-16 sm:px-8 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D3E9FC] bg-[#E8F3FE] px-4 py-1.5 text-xs font-semibold text-[#0B68BE]">
              <span className="size-1.5 rounded-full bg-[#218EE7]" />
              The Problem
            </div>

            <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-[-0.02em] text-[#113C69] sm:text-3xl lg:text-4xl">
              Too many tools. Too much paperwork.
            </h2>

            <p className="mt-3 text-base leading-relaxed text-[#3D7A9C] sm:text-lg">
              Spreadsheets, WhatsApp messages and paper forms make it harder to stay organised, find
              information and keep daily operations under control.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {problemCards.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-[#D3E9FC] bg-white/80 p-6 shadow-sm shadow-[#BDDDFB]/25 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:shadow-[#BDDDFB]/40 sm:p-7"
              >
                <div className="flex size-11 items-center justify-center rounded-xl border border-[#D3E9FC] bg-[#E8F3FE] text-[#218EE7]">
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#113C69]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3D7A9C]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#F5FAFF] px-6 py-16 sm:px-8 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D3E9FC] bg-[#E8F3FE] px-4 py-1.5 text-xs font-semibold text-[#0B68BE]">
              <span className="size-1.5 rounded-full bg-[#218EE7]" />
              How it works
            </div>

            <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-[-0.02em] text-[#113C69] sm:text-3xl lg:text-4xl">
              Simple to set up. Easy to use every day.
            </h2>

            <p className="mt-3 text-base leading-relaxed text-[#3D7A9C] sm:text-lg">
              DREVORA is designed to help transport companies move from scattered paperwork to one
              organised digital system.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {howItWorksSteps.map(({ step, icon: Icon, title, description }) => (
              <div
                key={step}
                className="rounded-2xl border border-[#D3E9FC] bg-white/80 p-6 shadow-sm shadow-[#BDDDFB]/25 backdrop-blur-xl sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#D3E9FC] bg-[#E8F3FE] text-[#218EE7]">
                    <Icon className="size-5" strokeWidth={2} />
                  </div>
                  <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-xl border border-[#BDDDFB] bg-[#E8F3FE] px-2.5 py-1 text-sm font-bold tabular-nums text-[#218EE7]">
                    {step}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-[#113C69]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3D7A9C]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules section */}
      <section id="modules" className="border-y border-[#D3E9FC] bg-[#E8F3FE]/50 px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>The Platform</SectionEyebrow>
            <h2 className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#113C69]">
              Everything your transport team needs in one platform
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#3D7A9C]">
              Manage your fleet, workers and daily operations from one clean, mobile-friendly
              platform.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {platformModules.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-[#D3E9FC] bg-white p-7 shadow-sm shadow-[#BDDDFB]/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#83C1F6] hover:shadow-md hover:shadow-[#BDDDFB]/40"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8F3FE] to-[#D3E9FC] text-[#0B68BE]">
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#113C69]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3D7A9C]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#113C69]">
              Simple pricing during MVP
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-md">
            <div className="relative overflow-hidden rounded-3xl border border-[#83C1F6] bg-white p-8 shadow-[0_24px_60px_rgba(11,38,70,0.12)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 right-[-40px] size-48 rounded-full bg-[radial-gradient(circle,rgba(131,193,246,0.35),transparent_70%)]"
              />
              <span className="relative inline-block rounded-full bg-[#218EE7] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                Early Access
              </span>
              <p className="relative mt-4 text-4xl font-extrabold text-[#113C69]">FREE for now</p>
              <p className="relative mt-3 text-sm leading-relaxed text-[#3D7A9C]">
                Start using DREVORA while we finish the MVP.
              </p>
              <PrimaryButton onClick={() => scrollTo('contact')} className="relative mt-7 w-full">
                Request Demo
              </PrimaryButton>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="contact" className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl border border-[#BDDDFB] bg-gradient-to-br from-[#E8F3FE] via-[#F1F7FE] to-[#D3E9FC] px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[-120px] left-1/2 h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(131,193,246,0.45),transparent_70%)]"
          />
          <div className="relative">
            <h2 className="text-[clamp(1.75rem,3.8vw,2.6rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#113C69]">
              Ready to simplify your transport operations?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#3D7A9C]">
              Request a demo and see how DREVORA can help reduce paperwork and organise daily fleet
              operations.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton onClick={() => scrollTo('contact')}>Request Demo</PrimaryButton>
              <SecondaryButton onClick={onAdminLogin}>Log in</SecondaryButton>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D3E9FC] bg-[#F5FAFF] px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <BrandMark size="sm" />

          <nav className="flex flex-wrap items-center justify-center gap-5 sm:justify-end">
            <a href="#features" className="text-[13px] font-medium text-[#3D7A9C] no-underline hover:text-[#0B68BE]">
              Features
            </a>
            <a href="#pricing" className="text-[13px] font-medium text-[#3D7A9C] no-underline hover:text-[#0B68BE]">
              Pricing
            </a>
            <a href="#modules" className="text-[13px] font-medium text-[#3D7A9C] no-underline hover:text-[#0B68BE]">
              FAQ / Help
            </a>
            <button
              type="button"
              onClick={onAdminLogin}
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-[#3D7A9C] no-underline hover:text-[#0B68BE]"
            >
              Log in
            </button>
          </nav>
        </div>

        <p className="mx-auto mt-8 max-w-[1200px] text-center text-[13px] text-[#5499BF]">
          © 2026 DREVORA. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default LandingPage
