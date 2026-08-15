import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { adminHeading, adminPanel, adminText, adminTextMuted } from '@/lib/adminUiStyles'
import { CUSTOMER_LEGAL_ROUTES, WORKER_LEGAL_ROUTES } from '@/lib/legalContent'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
import { cn } from '@/lib/utils'

type CustomerVersions = {
  customerTerms: string
  dpa: string
  privacy: string
}

type WorkerVersions = {
  workerTerms: string
  privacy: string
}

type CustomerSubmitPayload = {
  confirmedAuthority: boolean
  acceptCustomerTerms: boolean
  acceptDpa: boolean
  acknowledgePrivacy: boolean
}

type WorkerSubmitPayload = {
  acceptWorkerTerms: boolean
  acknowledgePrivacy: boolean
}

type LegalAcceptancePanelCustomerProps = {
  mode: 'customer'
  legalCompanyName: string
  versions: CustomerVersions
  termsHref?: string
  dpaHref?: string
  privacyHref?: string
  disabled?: boolean
  isSubmitting?: boolean
  submitLabel?: string
  onSubmit: (payload: CustomerSubmitPayload) => void | Promise<void>
  className?: string
}

type LegalAcceptancePanelWorkerProps = {
  mode: 'worker'
  versions: WorkerVersions
  workerTermsHref?: string
  privacyHref?: string
  disabled?: boolean
  isSubmitting?: boolean
  submitLabel?: string
  onSubmit: (payload: WorkerSubmitPayload) => void | Promise<void>
  className?: string
}

export type LegalAcceptancePanelProps =
  | LegalAcceptancePanelCustomerProps
  | LegalAcceptancePanelWorkerProps

function DocLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="font-semibold text-[#0B68BE] underline-offset-2 hover:underline dark:text-sky-400"
    >
      {children}
    </Link>
  )
}

function CheckRow({
  id,
  checked,
  onCheckedChange,
  children,
}: {
  id: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
  children: ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(75,120,220,0.12)] bg-white/80 px-3.5 py-3 dark:border-white/10 dark:bg-slate-900/40"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <span className={`text-sm leading-6 ${adminText}`}>{children}</span>
    </label>
  )
}

/** Checkbox acceptance panel for customer or worker legal gates. Never pre-checks boxes. */
export function LegalAcceptancePanel(props: LegalAcceptancePanelProps) {
  if (props.mode === 'customer') {
    return <CustomerAcceptancePanel {...props} />
  }
  return <WorkerAcceptancePanel {...props} />
}

function CustomerAcceptancePanel({
  legalCompanyName,
  versions,
  termsHref = CUSTOMER_LEGAL_ROUTES.customer_terms,
  dpaHref = CUSTOMER_LEGAL_ROUTES.dpa,
  privacyHref = CUSTOMER_LEGAL_ROUTES.privacy_policy,
  disabled = false,
  isSubmitting = false,
  submitLabel = 'Continue',
  onSubmit,
  className,
}: LegalAcceptancePanelCustomerProps) {
  const [confirmedAuthority, setConfirmedAuthority] = useState(false)
  const [acceptCustomerTerms, setAcceptCustomerTerms] = useState(false)
  const [acceptDpa, setAcceptDpa] = useState(false)
  const [acknowledgePrivacy, setAcknowledgePrivacy] = useState(false)

  const company = legalCompanyName.trim() || 'your organisation'
  const canContinue =
    !disabled &&
    !isSubmitting &&
    confirmedAuthority &&
    acceptCustomerTerms &&
    acceptDpa &&
    acknowledgePrivacy

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canContinue) return
    await onSubmit({
      confirmedAuthority,
      acceptCustomerTerms,
      acceptDpa,
      acknowledgePrivacy,
    })
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={cn(`${adminPanel} space-y-4 p-5 sm:p-6`, className)}
    >
      <div>
        <h2 className={`text-lg font-semibold tracking-[-0.02em] ${adminHeading}`}>
          Legal agreements
        </h2>
        <p className={`mt-1 text-sm leading-6 ${adminTextMuted}`}>
          Confirm authority and accept the current DREVORA documents to continue.
        </p>
      </div>

      <div className="space-y-2.5">
        <CheckRow
          id="legal-authority"
          checked={confirmedAuthority}
          onCheckedChange={setConfirmedAuthority}
        >
          I confirm I am authorised to accept these agreements on behalf of{' '}
          <span className="font-semibold">{company}</span>.
        </CheckRow>
        <CheckRow
          id="legal-customer-terms"
          checked={acceptCustomerTerms}
          onCheckedChange={setAcceptCustomerTerms}
        >
          I accept the{' '}
          <DocLink to={termsHref}>Customer Terms &amp; Conditions</DocLink> (v
          {versions.customerTerms}).
        </CheckRow>
        <CheckRow id="legal-dpa" checked={acceptDpa} onCheckedChange={setAcceptDpa}>
          I accept the <DocLink to={dpaHref}>Data Processing Agreement</DocLink> (v
          {versions.dpa}).
        </CheckRow>
        <CheckRow
          id="legal-privacy"
          checked={acknowledgePrivacy}
          onCheckedChange={setAcknowledgePrivacy}
        >
          I acknowledge the <DocLink to={privacyHref}>Privacy Policy</DocLink> (v
          {versions.privacy}).
        </CheckRow>
      </div>

      <Button
        type="submit"
        disabled={!canContinue}
        className="h-11 w-full rounded-2xl bg-[#2F80ED] text-white hover:bg-[#2563EB]"
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}

function WorkerAcceptancePanel({
  versions,
  workerTermsHref = WORKER_LEGAL_ROUTES.worker_terms,
  privacyHref = WORKER_LEGAL_ROUTES.privacy_policy,
  disabled = false,
  isSubmitting = false,
  submitLabel,
  onSubmit,
  className,
}: LegalAcceptancePanelWorkerProps) {
  const agreementsTitle = useWorkerChromeText('legal.agreementsTitle', 'Legal agreements')
  const agreementsHint = useWorkerChromeText(
    'legal.agreementsHint',
    'Please review and accept these documents before using DREVORA.',
  )
  const iHaveRead = useWorkerChromeText('legal.iHaveRead', 'I have read and accept')
  const workerTermsTitle = useWorkerChromeText(
    'legal.workerTermsTitle',
    'Worker Terms of Use',
  )
  const privacyTitle = useWorkerChromeText('legal.privacyTitle', 'Privacy Policy')
  const continueLabel = useWorkerChromeText('legal.continue', 'Continue')
  const savingLabel = useWorkerChromeText('legal.saving', 'Saving…')
  const workerTermsVersion = useWorkerChromeText('legal.versionAbbrev', '(v{{version}})', {
    version: versions.workerTerms,
  })
  const privacyVersion = useWorkerChromeText('legal.versionAbbrev', '(v{{version}})', {
    version: versions.privacy,
  })
  const [acceptWorkerTerms, setAcceptWorkerTerms] = useState(false)
  const [acknowledgePrivacy, setAcknowledgePrivacy] = useState(false)

  const canContinue =
    !disabled && !isSubmitting && acceptWorkerTerms && acknowledgePrivacy

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canContinue) return
    await onSubmit({ acceptWorkerTerms, acknowledgePrivacy })
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={cn(
        'space-y-4 rounded-2xl border border-[#BFE3F5]/80 bg-[#F5FAFF] p-5 dark:border-slate-700 dark:bg-slate-900/50',
        className,
      )}
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[color:var(--worker-text)]">
          {agreementsTitle}
        </h2>
        <p className="mt-1 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
          {agreementsHint}
        </p>
      </div>

      <div className="space-y-2.5">
        <CheckRow
          id="worker-legal-terms"
          checked={acceptWorkerTerms}
          onCheckedChange={setAcceptWorkerTerms}
        >
          {iHaveRead} <DocLink to={workerTermsHref}>{workerTermsTitle}</DocLink>{' '}
          {workerTermsVersion}
        </CheckRow>
        <CheckRow
          id="worker-legal-privacy"
          checked={acknowledgePrivacy}
          onCheckedChange={setAcknowledgePrivacy}
        >
          {iHaveRead} <DocLink to={privacyHref}>{privacyTitle}</DocLink>{' '}
          {privacyVersion}
        </CheckRow>
      </div>

      <Button
        type="submit"
        disabled={!canContinue}
        className="h-11 w-full rounded-2xl bg-[#2F80ED] text-white hover:bg-[#2563EB]"
      >
        {isSubmitting ? savingLabel : (submitLabel ?? continueLabel)}
      </Button>
    </form>
  )
}
