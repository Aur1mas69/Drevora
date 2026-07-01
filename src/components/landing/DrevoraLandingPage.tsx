import { LandingButton } from '@/components/landing/LandingButtons'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

type LandingPageProps = {
  onAdminLogin: () => void
  onWorkerLogin: () => void
}

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
]

const trustHighlights = [
  'Built for transport teams',
  'Early Access available',
  'Mobile-friendly workflows',
  'Fleet, workers and compliance in one place',
]

const drevoraModules = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'See your daily operations, alerts and key fleet metrics in one place.',
  },
  {
    icon: Users,
    title: 'Workers',
    description: 'Manage workers, roles, contact details and availability.',
  },
  {
    icon: Truck,
    title: 'Vehicles',
    description: 'Track vehicles, status, documents and fleet information.',
  },
  {
    icon: Clock,
    title: 'Timesheets',
    description: 'Record hours, review work time and prepare payroll information.',
  },
  {
    icon: CalendarDays,
    title: 'Holiday Requests',
    description: 'Let workers request holidays and managers approve or decline.',
  },
  {
    icon: ClipboardCheck,
    title: 'Vehicle Checks',
    description: 'Create check templates and keep daily checks organised.',
  },
  {
    icon: FileText,
    title: 'Driver Reports',
    description:
      'Drivers can report issues, damage, site problems or operational incidents.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance',
    description: 'Track important compliance items, documents and expiry dates.',
  },
  {
    icon: Package,
    title: 'Consumables',
    description: 'Track fuel, fluids, AdBlue, admixtures and other operating consumables.',
  },
] as const

const secondaryModules = [
  { icon: Settings, title: 'Settings', muted: true, italic: false },
  { icon: HelpCircle, title: 'FAQ / Help', muted: true, italic: false },
  { icon: Sparkles, title: 'Future Features', muted: true, italic: true },
] as const

const earlyAccessFeatures = [
  'Dashboard access',
  'Workers',
  'Vehicles',
  'Timesheets',
  'Holiday Requests',
  'Vehicle Checks',
  'Driver Reports',
  'Compliance',
  'Consumables',
  'Basic settings',
  'Updates during MVP',
]

const howItWorksSteps = [
  {
    title: 'Set up your company',
    description: 'Add your company profile, vehicles and core fleet information.',
  },
  {
    title: 'Add workers and roles',
    description: 'Invite office users and prepare worker access for daily tasks.',
  },
  {
    title: 'Drivers use mobile workflows',
    description: 'Timesheets, checks and reports from any smartphone browser.',
  },
  {
    title: 'Manage from the dashboard',
    description: 'Track operations, compliance and approvals from one admin view.',
  },
]

const phoneFeatures = [
  {
    icon: Clock,
    title: 'Submit timesheets in seconds',
    description: 'Clock in and out with hours recorded digitally — no paper forms.',
  },
  {
    icon: CalendarDays,
    title: 'Request holidays',
    description: 'Workers request time off; managers approve or decline in the platform.',
  },
  {
    icon: ClipboardCheck,
    title: 'Complete vehicle checks',
    description: 'Daily checklists on mobile with defects and notes captured clearly.',
  },
  {
    icon: FileText,
    title: 'Report operational issues',
    description: 'Drivers report damage, site problems or incidents with a clear audit trail.',
  },
]

const faqItems = [
  {
    question: 'What is DREVORA?',
    answer:
      'DREVORA is a fleet, workers and transport operations platform.',
  },
  {
    question: 'Who is DREVORA for?',
    answer:
      'It is built for transport companies, managers, office teams and drivers.',
  },
  {
    question: 'Is DREVORA free?',
    answer: 'Early Access is free for now during MVP.',
  },
  {
    question: 'Can drivers use it on mobile?',
    answer: 'Mobile-friendly driver workflows are being prepared and improved.',
  },
]

function HeaderBrand() {
  return (
    <span className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
      DREV<span className="text-[#3B6FFF]">ORA</span>
    </span>
  )
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.2em] text-[#3B6FFF] uppercase">
      {children}
    </p>
  )
}

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1A2035] bg-[#0F1420] shadow-[0_32px_64px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 border-b border-[#1A2035] bg-[#131829] px-3 py-2.5">
        <div className="size-2 rounded-full bg-[#EF4444]" />
        <div className="size-2 rounded-full bg-[#F59E0B]" />
        <div className="size-2 rounded-full bg-[#22C55E]" />
        <span className="ml-1 text-[11px] text-[#6B7A99]">drevora.app</span>
      </div>
      <div className="flex min-h-[280px] sm:min-h-[320px]">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-[#1A2035] bg-[#0A0D1A] py-3 sm:w-14">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B6FFF] to-[#7C5CFC] text-[10px] font-extrabold text-white">
            D
          </div>
          {drevoraModules.map(({ icon: Icon, title }, index) => (
            <div
              key={title}
              title={title}
              className={`flex size-8 items-center justify-center rounded-lg ${
                index === 0
                  ? 'bg-[#3B6FFF]/15 text-[#3B6FFF] ring-1 ring-[#3B6FFF]/30'
                  : 'text-[#6B7A99]'
              }`}
            >
              <Icon className="size-3.5" strokeWidth={2} />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <p className="text-sm font-bold text-white">DREVORA</p>
          <p className="text-[10px] text-[#6B7A99]">Fleet & Team Management</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {drevoraModules.map(({ icon: Icon, title }) => (
              <div
                key={title}
                className="rounded-lg border border-[#1A2035] bg-[#131829] px-2 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#3B6FFF]/10 text-[#3B6FFF]">
                    <Icon className="size-3" strokeWidth={2} />
                  </div>
                  <p className="text-[9px] font-medium leading-tight text-[#E8EDF5] sm:text-[10px]">
                    {title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PhoneMockup() {
  return (
    <div className="mx-auto w-full max-w-[220px]">
      <div className="overflow-hidden rounded-[28px] border-[6px] border-[#1A2035] bg-[#0A0D1A] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
        <div className="bg-[#04060D] px-4 py-1.5 text-center">
          <div className="mx-auto h-1 w-10 rounded-full bg-[#222840]" />
        </div>
        <div className="bg-[#0F1420] px-3 pb-4 pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#3B6FFF]">
            Worker portal
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-white">Daily tasks</p>
          <p className="text-[8px] text-[#6B7A99]">Mobile-friendly workflows</p>
          <div className="mt-3 space-y-1.5">
            {['Timesheets', 'Vehicle Checks', 'Holiday Requests', 'Driver Reports'].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-lg border border-[#1A2035] bg-[#131829] px-2.5 py-2"
                >
                  <span className="text-[8px] font-medium text-[#E8EDF5]">{item}</span>
                  <span className="text-[7px] text-[#3B6FFF]">Open</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:mx-0 lg:max-w-none">
      <DashboardMockup />
      <div className="absolute -right-2 bottom-0 z-10 hidden w-[38%] min-w-[120px] max-w-[168px] rotate-[6deg] sm:block lg:-right-4">
        <PhoneMockup />
      </div>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-[#1A2035] bg-[#131829]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-white">{question}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-[#6B7A99] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <p className="border-t border-[#1A2035] px-5 pb-4 text-sm leading-relaxed text-[#6B7A99]">
          {answer}
        </p>
      ) : null}
    </div>
  )
}

function LandingPage({ onAdminLogin, onWorkerLogin }: LandingPageProps) {
  function scrollToPricing() {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
  }

  function scrollToContact() {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-svh overflow-x-hidden bg-[#04060D] text-[#E8EDF5] antialiased">
      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1A2035] bg-[#04060D]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <a href="#" className="shrink-0 no-underline" aria-label="DREVORA home">
            <HeaderBrand />
          </a>

          <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-[#6B7A99] no-underline transition-colors hover:text-[#E8EDF5]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onWorkerLogin}
              className="hidden h-9 rounded-lg border border-[#1A2035] px-3 text-xs font-medium text-[#6B7A99] hover:border-[#3B6FFF] hover:bg-transparent hover:text-[#3B6FFF] sm:inline-flex sm:text-sm"
            >
              Worker Login
            </Button>
            <LandingButton
              type="button"
              motionVariant="ghost-dark"
              onClick={onAdminLogin}
              className="hidden h-9 px-3 text-xs sm:inline-flex sm:text-sm"
            >
              Admin Login
            </LandingButton>
            <LandingButton
              type="button"
              motionVariant="primary-dark"
              onClick={scrollToPricing}
              className="h-9 px-3 text-xs sm:px-4 sm:text-sm"
            >
              Get Demo
            </LandingButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-[68px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-200px] left-1/2 h-[600px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(59,111,255,0.14)_0%,transparent_65%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-200px] bottom-[-100px] h-[600px] w-[600px] bg-[radial-gradient(ellipse,rgba(124,92,252,0.08)_0%,transparent_60%)]"
        />

        <div className="relative mx-auto max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="min-w-0">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#3B6FFF]/20 bg-[#3B6FFF]/8 px-4 py-1.5 text-xs font-medium text-[#3B6FFF]">
                <span className="size-1.5 animate-pulse rounded-full bg-[#00C9A7] shadow-[0_0_8px_#00C9A7]" />
                Built for transport teams
              </div>

              <h1 className="text-[clamp(2rem,4.5vw,3.625rem)] leading-[1.05] font-extrabold tracking-[-0.04em] text-white">
                Manage your fleet, team and daily operations with{' '}
                <span className="bg-gradient-to-br from-[#3B6FFF] to-[#00C9A7] bg-clip-text text-transparent">
                  DREVORA
                </span>{' '}
                — all in one place.
              </h1>

              <p className="mt-5 text-lg font-medium text-[#3B6FFF]">
                Save time. Reduce paperwork. Keep your transport business moving.
              </p>

              <p className="mt-4 max-w-[460px] text-base leading-relaxed text-[#6B7A99]">
                DREVORA helps transport companies manage vehicles, workers, timesheets, holiday
                requests, vehicle checks, driver reports and compliance from one simple platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <LandingButton
                  type="button"
                  motionVariant="primary-dark"
                  onClick={scrollToPricing}
                  className="h-12 px-7 text-[15px]"
                >
                  Get Demo
                </LandingButton>
                <LandingButton
                  type="button"
                  motionVariant="secondary-dark"
                  onClick={onAdminLogin}
                  className="h-12 px-7 text-[15px]"
                >
                  Admin Login
                </LandingButton>
                <LandingButton
                  type="button"
                  motionVariant="secondary-dark"
                  onClick={onWorkerLogin}
                  className="h-12 px-7 text-[15px]"
                >
                  Worker Login
                </LandingButton>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {trustHighlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[#1A2035] bg-[#0F1420] px-3 py-1 text-xs text-[#6B7A99]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div className="border-y border-[#1A2035] bg-[#0A0D1A]">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 lg:grid-cols-4">
          {trustHighlights.map((item, index) => (
            <div
              key={item}
              className={`px-6 py-8 text-center ${
                index < trustHighlights.length - 1 ? 'lg:border-r lg:border-[#1A2035]' : ''
              } ${index % 2 === 0 ? 'border-r border-[#1A2035] lg:border-r-[#1A2035]' : ''}`}
            >
              <p className="text-sm font-semibold text-white">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform / modules */}
      <section id="platform" className="border-b border-[#1A2035] bg-[#0A0D1A] px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1200px]">
          <SectionEyebrow>The Platform</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.04em] text-white">
            Everything in one dashboard
          </h2>
          <p className="mt-4 max-w-[520px] text-base leading-relaxed text-[#6B7A99]">
            Your admin panel gives you a complete view of your fleet, workers, compliance and
            operations — from any device.
          </p>

          <div className="mt-14 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <DashboardMockup />

            <div>
              <p className="text-[13px] font-semibold tracking-[0.15em] text-[#6B7A99] uppercase">
                Dashboard Modules
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {drevoraModules.map(({ icon: Icon, title }) => (
                  <div
                    key={title}
                    className="flex items-center gap-2.5 rounded-[10px] border border-[#1A2035] bg-[#131829] px-3.5 py-3 text-[13px] font-medium text-[#E8EDF5] transition-colors hover:border-[#3B6FFF]/40 hover:bg-[#3B6FFF]/6"
                  >
                    <Icon className="size-4 shrink-0 text-[#3B6FFF]" strokeWidth={2} />
                    {title}
                  </div>
                ))}
              </div>

              <div className="my-4 h-px bg-[#1A2035]" />

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {secondaryModules.map(({ icon: Icon, title, muted, italic }) => (
                  <div
                    key={title}
                    className={`flex items-center gap-2.5 rounded-[10px] border border-[#1A2035] bg-[#131829] px-3.5 py-3 text-[13px] font-medium text-[#E8EDF5] ${
                      muted ? 'opacity-60' : ''
                    } ${italic ? 'italic' : ''}`}
                  >
                    <Icon className="size-4 shrink-0 text-[#6B7A99]" strokeWidth={2} />
                    {title}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1200px]">
          <SectionEyebrow>Core Features</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.04em] text-white">
            Everything you need, all in one place
          </h2>
          <p className="mt-4 max-w-[520px] text-base leading-relaxed text-[#6B7A99]">
            Nine core modules built to streamline fleet operations and keep your team organised.
          </p>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {drevoraModules.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-[#1A2035] bg-[#131829] p-8 transition-all hover:-translate-y-0.5 hover:border-[#3B6FFF]/30"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#3B6FFF] to-[#7C5CFC] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex size-12 items-center justify-center rounded-xl border border-[#3B6FFF]/15 bg-[#3B6FFF]/10 text-[#3B6FFF]">
                  <Icon className="size-5" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#6B7A99]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Driver / mobile */}
      <section
        id="mobile"
        className="border-y border-[#1A2035] bg-[#0A0D1A] px-5 py-20 sm:px-8 lg:px-12"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionEyebrow>Driver App</SectionEyebrow>
              <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.04em] text-white">
                Your drivers use their phones — nothing else needed
              </h2>
              <p className="mt-4 max-w-[520px] text-base leading-relaxed text-[#6B7A99]">
                Drivers open drevora.app on any smartphone. Mobile-friendly workflows for daily
                tasks — no extra apps required during MVP.
              </p>

              <div className="mt-10 space-y-6">
                {phoneFeatures.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="flex gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#3B6FFF]/15 bg-[#3B6FFF]/10 text-[#3B6FFF]">
                      <Icon className="size-[18px]" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B7A99]">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-[280px]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(ellipse,rgba(59,111,255,0.12),transparent_70%)]"
                />
                <PhoneMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1200px]">
          <SectionEyebrow>How It Works</SectionEyebrow>
          <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.04em] text-white">
            Get started step by step
          </h2>
          <p className="mt-4 max-w-[520px] text-base leading-relaxed text-[#6B7A99]">
            Set up your company, add your team and start managing daily transport operations from
            one platform.
          </p>

          <div className="relative mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-5 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-[#1A2035] to-transparent lg:block"
            />
            {howItWorksSteps.map((step, index) => (
              <div key={step.title} className="relative text-center">
                <div className="relative z-10 mx-auto flex size-10 items-center justify-center rounded-full border border-[#1A2035] bg-[#131829] text-sm font-extrabold text-[#3B6FFF]">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6B7A99]">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="border-y border-[#1A2035] bg-[#0A0D1A] px-5 py-20 sm:px-8 lg:px-12"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.04em] text-white">
              Pricing
            </h2>
            <p className="mt-4 text-base text-[#6B7A99]">
              Start using DREVORA for free while we finish the MVP.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-md">
            <div className="relative rounded-2xl border border-[#3B6FFF] bg-gradient-to-b from-[#3B6FFF]/8 to-[#131829] p-8">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#3B6FFF] px-3.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                MVP
              </span>
              <p className="text-xs font-semibold tracking-[0.15em] text-[#6B7A99] uppercase">
                Early Access
              </p>
              <p className="mt-3 text-4xl font-extrabold text-white">FREE for now</p>
              <p className="mt-3 text-sm text-[#6B7A99]">
                For transport companies that want to test DREVORA during MVP development.
              </p>
              <ul className="mt-6 space-y-2">
                {earlyAccessFeatures.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[13px] text-[#6B7A99]">
                    <span className="font-bold text-[#00C9A7]">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <LandingButton
                type="button"
                motionVariant="primary-dark"
                onClick={scrollToContact}
                className="mt-8 h-11 w-full"
              >
                Get Demo
              </LandingButton>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[720px]">
          <div className="text-center">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="mt-4 text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.04em] text-white">
              Common questions
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqItems.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="contact" className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl border border-[#3B6FFF]/20 bg-gradient-to-br from-[#3B6FFF]/12 to-[#7C5CFC]/8 px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[-100px] left-1/2 h-[300px] w-[500px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(59,111,255,0.15),transparent_70%)]"
          />
          <div className="relative">
            <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.04em] text-white">
              Ready to reduce paperwork in your transport business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-[#6B7A99]">
              Start with Early Access today. Explore the platform and help shape DREVORA during MVP
              development.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <LandingButton
                type="button"
                motionVariant="primary-dark"
                onClick={scrollToPricing}
                className="h-12 px-8 text-[15px]"
              >
                Get Demo
              </LandingButton>
              <LandingButton
                type="button"
                motionVariant="secondary-dark"
                onClick={onAdminLogin}
                className="h-12 px-8 text-[15px]"
              >
                Admin Login
              </LandingButton>
              <LandingButton
                type="button"
                motionVariant="secondary-dark"
                onClick={onWorkerLogin}
                className="h-12 px-8 text-[15px]"
              >
                Worker Login
              </LandingButton>
            </div>
            <p className="mt-4 text-[13px] text-[#6B7A99]">
              Early Access is free during MVP · No payment required
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1A2035] px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
          <div>
            <HeaderBrand />
            <p className="mt-1 text-[13px] text-[#6B7A99]">Fleet & Team Management</p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-5 sm:justify-end">
            <button
              type="button"
              onClick={onAdminLogin}
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-[#6B7A99] no-underline hover:text-[#E8EDF5]"
            >
              Admin Login
            </button>
            <button
              type="button"
              onClick={onWorkerLogin}
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-[#6B7A99] no-underline hover:text-[#E8EDF5]"
            >
              Worker Login
            </button>
            <a
              href="#faq"
              className="text-[13px] text-[#6B7A99] no-underline hover:text-[#E8EDF5]"
            >
              FAQ / Help
            </a>
            <a
              href="#pricing"
              className="text-[13px] text-[#6B7A99] no-underline hover:text-[#E8EDF5]"
            >
              Pricing
            </a>
          </nav>
        </div>

        <p className="mx-auto mt-8 max-w-[1200px] text-center text-[13px] text-[#222840]">
          © 2026 DREVORA. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default LandingPage
