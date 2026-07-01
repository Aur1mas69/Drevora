import { HeroBackground } from '@/components/landing/HeroBackground'
import { LandingButton } from '@/components/landing/LandingButtons'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  Home,
  LayoutDashboard,
  ShieldCheck,
  Star,
  Truck,
  Users,
} from 'lucide-react'

type LandingPageProps = {
  onAdminLogin: () => void
  onDriverLogin?: () => void
}

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Vehicle Checks', href: '#features' },
  { label: 'Timesheets', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
]

const stats = [
  { value: '120+', label: 'Vehicles Managed' },
  { value: '24/7', label: 'Access Anywhere' },
  { value: '30', label: 'Day Tracking History' },
  { value: '100%', label: 'Digital Checks' },
]

const features = [
  {
    icon: ClipboardCheck,
    title: 'Vehicle Checks',
    description:
      'Create flexible inspection templates and let drivers complete checks from their phone.',
  },
  {
    icon: CalendarDays,
    title: 'Timesheets',
    description: 'Track working hours, submissions and approvals in one place.',
  },
  {
    icon: Users,
    title: 'Holiday Requests',
    description: 'Manage driver and staff holiday requests without paper forms.',
  },
  {
    icon: FileText,
    title: 'Driver Reports',
    description:
      'Let workers report vehicle, load, damage, site or delay issues directly to the office.',
  },
  {
    icon: ShieldCheck,
    title: 'Fleet Compliance',
    description: 'Keep MOT, insurance, service and document reminders organised.',
  },
  {
    icon: Truck,
    title: 'Vehicle Setup',
    description:
      'Set up vehicles manually now, with DVLA and What3Words options prepared for future integrations.',
  },
]

const pricingPlans = [
  {
    name: 'Starter',
    description: 'For small teams getting organised',
    features: [
      'Up to 5 vehicles',
      'Timesheets',
      'Holiday requests',
      'Basic vehicle checks',
    ],
    cta: 'Start with Starter',
    popular: false,
  },
  {
    name: 'Professional',
    description: 'For growing fleets',
    features: [
      'Up to 25 vehicles',
      'Advanced vehicle checks',
      'Driver reports',
      'Compliance alerts',
      'Office dashboard',
    ],
    cta: 'Choose Professional',
    popular: true,
  },
  {
    name: 'Business',
    description: 'For larger transport operations',
    features: [
      '25+ vehicles',
      'Custom vehicle check templates',
      'Multi-role access',
      'Priority support',
      'Future integrations ready',
    ],
    cta: 'Contact Us',
    popular: false,
    contact: true,
  },
]

const howItWorksSteps = [
  'Add your company and vehicles',
  'Set up workers and office users',
  'Choose vehicle check templates',
  'Drivers complete daily tasks from their phone',
  'Office team tracks everything from the dashboard',
]

function LogoMark() {
  return (
    <img
      src="/drevora-logo.png"
      alt="DREVORA"
      className="h-auto max-h-9 w-auto max-w-[160px] shrink-0 object-contain sm:max-w-[180px]"
    />
  )
}

function HeroVisual() {
  const floatingCards = [
    {
      icon: AlertTriangle,
      title: 'MOT Alert',
      subtitle: 'Expires in 7 days',
      className: '-left-1 top-4 sm:left-0 sm:top-6',
      iconTone: 'text-amber-500',
    },
    {
      icon: ClipboardCheck,
      title: 'Vehicle Check',
      subtitle: 'Completed',
      className: 'right-0 top-10 sm:top-12',
      iconTone: 'text-emerald-500',
    },
    {
      icon: Clock,
      title: 'Timesheet',
      subtitle: 'Submitted',
      className: 'bottom-32 left-0 sm:bottom-36 sm:left-2',
      iconTone: 'text-[#2563EB]',
    },
    {
      icon: FileText,
      title: 'Driver Report',
      subtitle: 'New report',
      className: 'right-0 bottom-28 sm:bottom-32',
      iconTone: 'text-[#2563EB]',
    },
  ]

  const kpis = [
    { label: 'Vehicles', value: '120+' },
    { label: 'Workers', value: '24' },
    { label: 'MOT Alerts', value: '12' },
    { label: 'Insurance Alerts', value: '5' },
  ]

  const motExpiry = [
    { vehicle: 'FLT-08', date: '12 Apr' },
    { vehicle: 'FLT-14', date: '18 Apr' },
    { vehicle: 'FLT-21', date: '24 Apr' },
  ]

  const recentActivity = [
    { text: 'Vehicle check completed', time: '2m ago' },
    { text: 'Timesheet submitted', time: '14m ago' },
    { text: 'MOT reminder sent', time: '1h ago' },
  ]

  return (
    <div className="relative mx-auto w-full max-w-[640px] lg:mx-0 lg:max-w-none lg:pl-2">
      {floatingCards.map(({ icon: Icon, title, subtitle, className, iconTone }) => (
        <div
          key={title}
          className={`absolute z-30 hidden max-w-[148px] rounded-xl border border-[#BFDBFE]/90 bg-white/95 px-3 py-2.5 shadow-[0_16px_40px_rgba(37,99,235,0.14)] backdrop-blur-md sm:block ${className}`}
        >
          <div className="flex items-start gap-2">
            <Icon className={`mt-0.5 size-3.5 shrink-0 ${iconTone}`} strokeWidth={2.2} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#0F172A]">{title}</p>
              <p className="text-[9px] font-medium text-[#64748B]">{subtitle}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="relative overflow-visible rounded-[24px] border border-[#BFDBFE]/90 bg-white/80 p-3 shadow-[0_32px_80px_rgba(37,99,235,0.18)] backdrop-blur-md sm:p-4">
        <div className="overflow-hidden rounded-[18px] border border-[#E2E8F0]/90 bg-[#F8FAFC] shadow-inner">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-white/95 px-3 py-2.5">
            <div className="size-2 rounded-full bg-[#EF4444]" />
            <div className="size-2 rounded-full bg-[#F59E0B]" />
            <div className="size-2 rounded-full bg-[#22C55E]" />
            <span className="ml-1 text-[11px] font-medium text-[#64748B]">app.drevora.co.uk</span>
          </div>

          <div className="flex min-h-[340px] sm:min-h-[380px]">
            <div className="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-[#E2E8F0] bg-[#FCFDFF] py-4 sm:w-14">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#2563EB] to-[#60A5FA] text-xs font-extrabold text-white">
                D
              </div>
              {[LayoutDashboard, Users, Truck, ClipboardCheck, ShieldCheck].map((Icon, index) => (
                <div
                  key={index}
                  className={`flex size-8 items-center justify-center rounded-lg ${
                    index === 0
                      ? 'bg-[#2563EB]/12 text-[#2563EB] ring-1 ring-[#BFDBFE]'
                      : 'text-[#94A3B8]'
                  }`}
                >
                  <Icon className="size-4" strokeWidth={2} />
                </div>
              ))}
            </div>

            <div className="min-w-0 flex-1 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">Dashboard</p>
                  <p className="text-[10px] text-[#64748B]">Fleet operations overview</p>
                </div>
                <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE]">
                  Live
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-[#E2E8F0] bg-white px-2.5 py-2 shadow-sm sm:px-3 sm:py-2.5"
                  >
                    <p className="text-base font-extrabold leading-none text-[#2563EB] sm:text-lg">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-[9px] font-medium text-[#64748B] sm:text-[10px]">
                      {kpi.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-xl border border-[#BFDBFE]/80 bg-gradient-to-br from-[#EFF6FF] to-white p-3">
                  <p className="text-[10px] font-semibold text-[#0F172A] sm:text-xs">Fleet status</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative flex size-14 shrink-0 items-center justify-center sm:size-16">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background:
                            'conic-gradient(#2563EB 0deg 280deg, #E2E8F0 280deg 360deg)',
                        }}
                      />
                      <div className="absolute inset-1.5 rounded-full bg-white" />
                      <span className="relative text-xs font-bold text-[#2563EB]">78%</span>
                    </div>
                    <div className="min-w-0 space-y-1.5 text-[9px] sm:text-[10px]">
                      <div className="flex justify-between gap-2">
                        <span className="text-[#64748B]">Available</span>
                        <span className="font-semibold text-[#0F172A]">86</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#64748B]">Off road</span>
                        <span className="font-semibold text-[#0F172A]">8</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#64748B]">Workshop</span>
                        <span className="font-semibold text-[#0F172A]">4</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                  <p className="text-[10px] font-semibold text-[#0F172A] sm:text-xs">MOT expiry</p>
                  <ul className="mt-2 space-y-1.5">
                    {motExpiry.map((item) => (
                      <li
                        key={item.vehicle}
                        className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-2 py-1.5 text-[9px] sm:text-[10px]"
                      >
                        <span className="font-semibold text-[#334155]">{item.vehicle}</span>
                        <span className="text-[#64748B]">{item.date}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-[#E2E8F0] bg-white p-3">
                <p className="text-[10px] font-semibold text-[#0F172A] sm:text-xs">Recent activity</p>
                <ul className="mt-2 space-y-1.5">
                  {recentActivity.map((item) => (
                    <li
                      key={item.text}
                      className="flex items-center justify-between gap-2 text-[9px] sm:text-[10px]"
                    >
                      <span className="truncate text-[#475569]">{item.text}</span>
                      <span className="shrink-0 text-[#94A3B8]">{item.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Phone mockup */}
        <div
          className="absolute -right-2 bottom-2 z-20 w-[34%] min-w-[118px] max-w-[156px] rotate-[8deg] rounded-[22px] border-[5px] border-[#0F172A] bg-[#0F172A] p-1 shadow-[0_28px_60px_rgba(15,23,42,0.32)] sm:-right-4 sm:bottom-0 sm:max-w-[168px]"
        >
          <div className="overflow-hidden rounded-[14px] bg-white">
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2">
              <p className="text-[10px] font-bold text-[#0F172A]">Dashboard</p>
            </div>
            <div className="space-y-1.5 p-2">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'MOT Alerts', value: '3', tone: 'text-amber-600' },
                  { label: 'Insurance', value: '2', tone: 'text-[#2563EB]' },
                  { label: 'Off-Road', value: '4', tone: 'text-[#64748B]' },
                  { label: 'Available', value: '18', tone: 'text-emerald-600' },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-1.5"
                  >
                    <p className={`text-xs font-extrabold leading-none ${card.tone}`}>{card.value}</p>
                    <p className="mt-0.5 text-[7px] font-medium text-[#64748B]">{card.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-1.5">
                <p className="text-[8px] font-semibold text-[#0F172A]">Upcoming</p>
                <div className="mt-1 space-y-1">
                  {['MOT review', 'Insurance renewal'].map((event) => (
                    <div
                      key={event}
                      className="rounded bg-[#EFF6FF] px-1.5 py-1 text-[7px] font-medium text-[#334155]"
                    >
                      {event}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-around border-t border-[#E2E8F0] bg-[#FCFDFF] px-2 py-1.5">
              {[Home, Truck, ClipboardCheck, Users].map((Icon, index) => (
                <Icon
                  key={index}
                  className={`size-3 ${index === 0 ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}
                  strokeWidth={2}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LandingPage({ onAdminLogin }: LandingPageProps) {
  function scrollToPricing() {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
  }

  function scrollToContact() {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-svh overflow-x-hidden bg-[#F8FBFF] text-[#0F172A] antialiased">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-[#E2E8F0]/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#" className="shrink-0 no-underline">
            <LogoMark />
          </a>

          <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[#475569] no-underline transition-colors hover:text-[#2563EB]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onAdminLogin}
              className="hidden h-9 rounded-xl text-sm font-semibold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB] sm:inline-flex"
            >
              Login
            </Button>
            <LandingButton
              type="button"
              onClick={onAdminLogin}
              className="h-9 px-4 text-sm sm:px-5"
            >
              Get Started
            </LandingButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="grid items-center gap-10 py-12 md:gap-12 lg:grid-cols-12 lg:gap-8 lg:py-16 xl:gap-10">
            <div className="min-w-0 lg:col-span-5 xl:col-span-5">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-white/90 px-3.5 py-1 text-xs font-semibold text-[#2563EB] shadow-sm">
                Fleet management made simple
              </div>
              <h1 className="text-[clamp(1.75rem,3.2vw,2.75rem)] leading-[1.14] font-extrabold tracking-tight text-[#0F172A]">
                Manage your fleet, team and daily operations with DREVORA — all in one place.
              </h1>
              <p className="mt-4 text-lg font-semibold text-[#2563EB]">
                Save time. Reduce paperwork. Keep your transport business moving.
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#475569]">
                DREVORA helps transport companies manage vehicles, workers, timesheets, holiday
                requests, vehicle checks, driver reports and compliance from one simple platform.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LandingButton type="button" onClick={onAdminLogin} className="h-11 px-6">
                  Get Started for Free
                </LandingButton>
                <LandingButton
                  type="button"
                  motionVariant="secondary"
                  onClick={scrollToPricing}
                  className="h-11 px-6"
                >
                  View Pricing
                </LandingButton>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {['A', 'B', 'C', 'D'].map((initial) => (
                    <span
                      key={initial}
                      className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#93C5FD] to-[#2563EB] text-[10px] font-bold text-white shadow-sm"
                    >
                      {initial}
                    </span>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5 text-[#2563EB]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="size-3.5 fill-[#2563EB]" strokeWidth={0} />
                    ))}
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#64748B]">
                    Trusted by modern transport teams
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 lg:col-span-7 xl:col-span-7">
              <HeroVisual />
            </div>
          </div>

          <div className="mx-auto mb-4 max-w-6xl overflow-hidden rounded-2xl border border-[#BFDBFE]/80 bg-white/85 pb-2 shadow-[0_20px_50px_rgba(37,99,235,0.08)] backdrop-blur-sm lg:mb-6">
            <div className="grid grid-cols-2 divide-x divide-[#E2E8F0]/80 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="px-4 py-5 text-center sm:px-6 sm:py-6">
                  <p className="text-2xl font-extrabold text-[#2563EB] sm:text-[1.75rem]">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#64748B] sm:text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gradient-to-b from-[#EFF6FF] to-[#F8FBFF] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
              Built for transport teams
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-[#E2E8F0]/80 bg-white/90 p-6 shadow-[0_8px_30px_rgba(37,99,235,0.06)] backdrop-blur-sm transition-shadow hover:shadow-[0_12px_40px_rgba(37,99,235,0.1)]"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#0F172A]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
              Simple pricing for growing transport businesses
            </h2>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  plan.popular
                    ? 'border-[#2563EB] shadow-[0_16px_48px_rgba(37,99,235,0.12)] ring-1 ring-[#2563EB]/20'
                    : 'border-[#E2E8F0]'
                }`}
              >
                {plan.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                    Most Popular
                  </span>
                ) : null}
                <h3 className="text-xl font-extrabold text-[#0F172A]">{plan.name}</h3>
                <p className="mt-2 text-sm text-[#64748B]">{plan.description}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-[#334155]">
                      <span className="mt-0.5 text-[#2563EB]">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <LandingButton
                  type="button"
                  motionVariant={plan.popular ? 'primary' : 'secondary'}
                  onClick={plan.contact ? scrollToContact : onAdminLogin}
                  className="mt-8 h-11 w-full"
                >
                  {plan.cta}
                </LandingButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-[#EFF6FF] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
              How DREVORA works
            </h2>
          </div>
          <ol className="mx-auto mt-12 grid max-w-3xl gap-4">
            {howItWorksSteps.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-4 rounded-2xl border border-[#BFDBFE]/60 bg-white/90 px-5 py-4 shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <p className="pt-1.5 text-base font-medium text-[#334155]">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section
        id="contact"
        className="bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] px-4 py-20 text-center sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to reduce paperwork in your transport business?
          </h2>
          <p className="mt-4 text-lg text-[#BFDBFE]">
            Start with manual setup today and grow into a smarter fleet management system over time.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LandingButton
              type="button"
              motionVariant="primary-on-dark"
              onClick={onAdminLogin}
              className="h-11 px-6"
            >
              Get Started
            </LandingButton>
            <LandingButton
              type="button"
              motionVariant="secondary-light"
              onClick={onAdminLogin}
              className="h-11 px-6"
            >
              Login
            </LandingButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <LogoMark />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#64748B]">
                All-in-one transport management platform for modern fleet and operations teams.
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0F172A]">Product</p>
              <ul className="mt-3 space-y-2 text-sm">
                {['Features', 'Vehicle Checks', 'Timesheets', 'Pricing'].map((item) => (
                  <li key={item}>
                    <a
                      href={item === 'Pricing' ? '#pricing' : '#features'}
                      className="text-[#64748B] no-underline hover:text-[#2563EB]"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0F172A]">Company</p>
              <ul className="mt-3 space-y-2 text-sm">
                {[
                  { label: 'About', href: '#features' },
                  { label: 'Contact', href: '#contact' },
                  { label: 'Support', href: 'mailto:support@drevora.app' },
                ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-[#64748B] no-underline hover:text-[#2563EB]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0F172A]">Legal</p>
              <ul className="mt-3 space-y-2 text-sm">
                {['Privacy Policy', 'Terms'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[#64748B] no-underline hover:text-[#2563EB]">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-[#E2E8F0] pt-6 text-center text-sm text-[#64748B]">
            © 2026 DREVORA. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
