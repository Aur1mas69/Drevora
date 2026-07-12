import type { ReactNode } from 'react'
import AdminLayout from '@/layouts/AdminLayout'
import { Card, CardContent } from '@/components/ui/card'
import { adminCard, adminHeading, adminText, adminTextMuted } from '@/lib/adminUiStyles'

function Placeholder({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-[6px] bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-950 ring-1 ring-amber-300/80 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-400/40 print:bg-transparent print:px-0 print:ring-0 print:underline print:decoration-amber-600">
      {children}
    </span>
  )
}

function Callout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <aside
      className="my-5 rounded-[14px] border border-[#BFD9F5] bg-[#F0F7FF] px-4 py-3.5 dark:border-sky-500/30 dark:bg-sky-950/30 print:border print:border-slate-300 print:bg-slate-50"
      role="note"
    >
      <p className={`text-sm font-semibold ${adminHeading}`}>{title}</p>
      <div className={`mt-1.5 space-y-2 text-sm leading-6 ${adminText}`}>{children}</div>
    </aside>
  )
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className={`scroll-mt-24 text-lg font-semibold tracking-[-0.02em] ${adminHeading}`}
    >
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className={`mt-4 text-base font-semibold ${adminHeading}`}>{children}</h3>
}

const TOC_ITEMS = [
  { id: 'about', label: '1. About DREVORA and these Terms' },
  { id: 'service', label: '2. The Service' },
  { id: 'accounts', label: '3. Customer Accounts' },
  { id: 'responsibilities', label: '4. Customer Responsibilities' },
  { id: 'billing', label: '5. Subscription and Billing' },
  { id: 'trials', label: '6. Trials and Early Access' },
  { id: 'cancellation', label: '7. Cancellation and Refunds' },
  { id: 'failed-payments', label: '8. Failed Payments' },
  { id: 'customer-data', label: '9. Customer Data' },
  { id: 'medical', label: '10. Medical and Sensitive Information' },
  { id: 'retention', label: '11. Data Retention' },
  { id: 'exports', label: '12. Customer Exports and Independent Copies' },
  { id: 'security', label: '13. Data Security and Data Loss' },
  { id: 'acceptable-use', label: '14. Acceptable Use' },
  { id: 'availability', label: '15. Service Availability and Maintenance' },
  { id: 'third-party', label: '16. Third-Party Services' },
  { id: 'ip', label: '17. Intellectual Property' },
  { id: 'confidentiality', label: '18. Confidentiality' },
  { id: 'suspension', label: '19. Suspension and Termination' },
  { id: 'closure', label: '20. Account Closure and Data Access' },
  { id: 'liability', label: '21. Limitation of Liability' },
  { id: 'indemnity', label: '22. Customer Indemnity' },
  { id: 'feedback', label: '23. Feedback' },
  { id: 'changes', label: '24. Changes to the Service or these Terms' },
  { id: 'force-majeure', label: '25. Force Majeure' },
  { id: 'general', label: '26. General Terms' },
  { id: 'governing-law', label: '27. Governing Law and Courts' },
  { id: 'contact', label: '28. Contact' },
] as const

export default function TermsPage() {
  return (
    <AdminLayout premiumBackground>
      <div className="legal-document space-y-5 pb-10 print:bg-white print:pb-0">
        <style>{`
          @media print {
            .drevora-app-shell aside,
            .drevora-app-shell header,
            .legal-document-toc {
              display: none !important;
            }
            .drevora-app-shell main,
            .legal-document,
            .legal-document * {
              color: #0f172a !important;
              box-shadow: none !important;
            }
            .legal-document a[href^="#"]::after {
              content: none !important;
            }
          }
        `}</style>

        <div className="mx-auto w-full max-w-[860px]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB] print:text-slate-600">
            Legal
          </p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
            DREVORA Terms & Conditions
          </h1>
          <p className={`mt-2 text-sm leading-6 ${adminTextMuted}`}>
            Effective date: <Placeholder>[EFFECTIVE DATE]</Placeholder>
          </p>
        </div>

        <Card
          className={`${adminCard} mx-auto w-full max-w-[860px] border border-[rgba(75,120,220,0.10)] print:border print:border-slate-300 print:shadow-none`}
        >
          <CardContent className="bg-[#F8FBFF] p-6 sm:p-8 dark:bg-slate-900/50 print:bg-white print:p-0">
            <nav
              aria-label="Terms table of contents"
              className="legal-document-toc mb-8 rounded-[14px] border border-[rgba(75,120,220,0.12)] bg-white/80 px-4 py-4 dark:border-white/10 dark:bg-slate-900/60"
            >
              <h2 className={`text-sm font-semibold ${adminHeading}`}>Contents</h2>
              <ol className={`mt-3 columns-1 gap-x-8 space-y-1.5 text-sm sm:columns-2 ${adminText}`}>
                {TOC_ITEMS.map((item) => (
                  <li key={item.id} className="break-inside-avoid">
                    <a
                      href={`#${item.id}`}
                      className="text-[#0B68BE] no-underline hover:underline dark:text-sky-400"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <article className={`space-y-8 text-sm leading-7 ${adminText}`}>
              <section className="space-y-3" aria-labelledby="about">
                <SectionHeading id="about">1. About DREVORA and these Terms</SectionHeading>
                <p>
                  These Terms & Conditions govern access to and use of the DREVORA fleet, workforce
                  and operations management platform.
                </p>
                <p>
                  DREVORA is a trading name operated by Aurimas Jokubaitis, a sole trader based in
                  England, United Kingdom.
                </p>
                <p>
                  Business address: <Placeholder>[BUSINESS ADDRESS]</Placeholder>
                </p>
                <p>Email: admin@drevora.uk</p>
                <p>Website: drevora.app</p>
                <p>
                  By creating an account, purchasing a subscription or using DREVORA, the Customer
                  agrees to these Terms.
                </p>
                <p>
                  DREVORA is provided only for business and professional use. The Customer confirms
                  that it is acting in the course of a trade, business or profession and has
                  authority to accept these Terms on behalf of its organisation.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="service">
                <SectionHeading id="service">2. The Service</SectionHeading>
                <p>
                  DREVORA provides business management and record-keeping tools which may include:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Workers</li>
                  <li>Vehicles</li>
                  <li>Timesheets</li>
                  <li>Holiday Requests</li>
                  <li>Vehicle Checks</li>
                  <li>Driver Reports</li>
                  <li>Documents</li>
                  <li>Contacts</li>
                  <li>Consumables</li>
                  <li>Dashboards, reminders, notifications and related records</li>
                </ul>
                <p>
                  DREVORA is an actively developed software service. Features, interfaces and
                  workflows may be updated, corrected, improved, replaced or removed where
                  reasonably necessary to maintain, secure or develop the Service.
                </p>
                <p>
                  DREVORA does not replace the Customer’s legal, regulatory, employment, tax,
                  payroll, road safety, DVSA, DVLA, working-time or data-protection obligations.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="accounts">
                <SectionHeading id="accounts">3. Customer Accounts</SectionHeading>
                <p>The Customer is responsible for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>providing accurate company and account information;</li>
                  <li>keeping login credentials secure;</li>
                  <li>controlling access granted to directors, office users, managers and Workers;</li>
                  <li>assigning appropriate roles and permissions;</li>
                  <li>removing access promptly when a user should no longer use the Service;</li>
                  <li>ensuring all invited users comply with these Terms;</li>
                  <li>reviewing activity carried out through its accounts.</li>
                </ul>
                <p>
                  The Customer must notify DREVORA promptly if it believes an account or Customer
                  Data has been accessed without authorisation.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="responsibilities">
                <SectionHeading id="responsibilities">4. Customer Responsibilities</SectionHeading>
                <p>
                  The Customer is responsible for the accuracy, legality and relevance of all
                  information entered or uploaded into DREVORA.
                </p>
                <p>DREVORA does not independently verify:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>working hours;</li>
                  <li>holiday entitlement;</li>
                  <li>vehicle condition;</li>
                  <li>completed walkaround checks;</li>
                  <li>defect reports;</li>
                  <li>licence or qualification information;</li>
                  <li>consumable quantities;</li>
                  <li>uploaded documents;</li>
                  <li>regulatory or compliance decisions.</li>
                </ul>
                <p>
                  The Customer must independently check information before relying on it for
                  payroll, safety, employment, legal or regulatory purposes.
                </p>
                <p>
                  The Customer remains responsible for vehicle roadworthiness, defect rectification,
                  Worker competence, legal record retention and all submissions to public
                  authorities.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="billing">
                <SectionHeading id="billing">5. Subscription and Billing</SectionHeading>
                <p>DREVORA subscriptions are currently offered on a monthly basis.</p>
                <p>
                  Subscription fees are charged in advance at the price shown when the Customer
                  subscribes or as otherwise agreed in writing.
                </p>
                <p>
                  Unless cancelled, the subscription renews automatically each month using the
                  payment method connected to the account.
                </p>
                <p>
                  Payments may be processed by Stripe or another payment provider shown during
                  checkout. DREVORA does not store complete payment card numbers.
                </p>
                <p>
                  Prices exclude VAT unless expressly stated otherwise. VAT will be added where
                  legally required.
                </p>
                <p>
                  DREVORA may change subscription prices by giving reasonable notice before the new
                  price applies to a future billing period.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="trials">
                <SectionHeading id="trials">6. Trials and Early Access</SectionHeading>
                <p>DREVORA may offer a free trial, promotional period or Early Access arrangement.</p>
                <p>
                  The exact duration, included features and whether payment details are required
                  will be explained when the Customer joins the offer.
                </p>
                <p>
                  A free trial will not convert into a paid subscription unless the applicable
                  sign-up process clearly explains that conversion and the Customer has provided the
                  required payment authorisation.
                </p>
                <p>
                  Trial and Early Access functionality may be limited or changed during product
                  development.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="cancellation">
                <SectionHeading id="cancellation">7. Cancellation and Refunds</SectionHeading>
                <Callout title="Cancellation summary">
                  <p>The Customer may cancel its monthly subscription at any time.</p>
                  <p>Cancellation prevents the next monthly renewal.</p>
                  <p>
                    Access continues until the end of the billing period already paid for. Payments
                    already taken for the current billing period are non-refundable, except where a
                    refund is required by law or DREVORA expressly agrees otherwise.
                  </p>
                </Callout>
                <p>The Customer may cancel its monthly subscription at any time.</p>
                <p>Cancellation prevents the next monthly renewal.</p>
                <p>After cancellation:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>access continues until the end of the billing period already paid for;</li>
                  <li>no further monthly subscription charge will be taken;</li>
                  <li>access may be restricted or terminated when the paid billing period ends.</li>
                </ul>
                <p>
                  Payments already taken for the current billing period are non-refundable, except
                  where a refund is required by law or DREVORA expressly agrees otherwise.
                </p>
                <p>
                  No partial refund or credit is provided for unused days in an already paid billing
                  period.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="failed-payments">
                <SectionHeading id="failed-payments">8. Failed Payments</SectionHeading>
                <p>If a subscription payment fails, DREVORA may:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>retry the payment;</li>
                  <li>notify the Customer;</li>
                  <li>request an alternative payment method;</li>
                  <li>restrict or suspend access;</li>
                  <li>prevent a new billing period from starting.</li>
                </ul>
                <p>The Customer remains responsible for properly due unpaid subscription fees.</p>
              </section>

              <section className="space-y-3" aria-labelledby="customer-data">
                <SectionHeading id="customer-data">9. Customer Data</SectionHeading>
                <p>The Customer retains ownership of Customer Data entered or uploaded into DREVORA.</p>
                <p>
                  The Customer grants DREVORA a limited right to host, copy, transmit, display and
                  process Customer Data only as necessary to provide, secure and support the
                  Service.
                </p>
                <p>The Customer is responsible for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>having a lawful reason to process personal data;</li>
                  <li>providing required privacy notices to Workers and other individuals;</li>
                  <li>collecting only necessary information;</li>
                  <li>keeping information accurate;</li>
                  <li>deciding who may access it;</li>
                  <li>responding to data-subject requests;</li>
                  <li>selecting appropriate retention periods;</li>
                  <li>deleting data that is no longer required.</li>
                </ul>
                <p>
                  Where DREVORA processes Worker Data on behalf of the Customer, the Customer
                  normally acts as data controller and DREVORA normally acts as data processor.
                </p>
                <p>
                  Personal-data processing is explained further in the Privacy Policy and, where
                  applicable, a Data Processing Agreement.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="medical">
                <SectionHeading id="medical">10. Medical and Sensitive Information</SectionHeading>
                <Callout title="Medical documents">
                  <p>
                    Medical document uploads are optional and disabled by default unless enabled by
                    the Customer. Medical documents may contain special-category personal data.
                  </p>
                  <p>
                    DREVORA does not require Customers to record diagnoses, medications, detailed
                    medical conditions, doctor’s notes or full examination responses.
                  </p>
                </Callout>
                <p>
                  Medical document uploads are optional and disabled by default unless enabled by
                  the Customer.
                </p>
                <p>Medical documents may contain special-category personal data.</p>
                <p>
                  If the Customer enables or uses medical-document uploads, the Customer is
                  responsible for:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>identifying a lawful basis and applicable special-category condition;</li>
                  <li>determining whether retaining a copy is genuinely necessary;</li>
                  <li>restricting access to authorised personnel;</li>
                  <li>setting an appropriate retention period;</li>
                  <li>deleting the document when it is no longer required;</li>
                  <li>complying with applicable employment and data-protection laws.</li>
                </ul>
                <p>
                  DREVORA does not require Customers to record diagnoses, medications, detailed
                  medical conditions, doctor’s notes or full examination responses.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="retention">
                <SectionHeading id="retention">11. Data Retention</SectionHeading>
                <p>
                  DREVORA is designed to support retention of business records for periods selected
                  or required by the Customer.
                </p>
                <p>
                  Unless a shorter retention period is selected, the Customer deletes the data, the
                  account is terminated, or applicable law requires a different period, Customer
                  operational records may be retained for up to six years.
                </p>
                <p>Different retention periods may apply to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>account and billing records;</li>
                  <li>Timesheets;</li>
                  <li>Holiday Requests;</li>
                  <li>Vehicle Checks;</li>
                  <li>Driver Reports;</li>
                  <li>Documents;</li>
                  <li>Consumables;</li>
                  <li>security and technical logs.</li>
                </ul>
                <p>
                  The detailed retention schedule will be stated in the Privacy Policy and may be
                  updated to reflect legal, technical and product requirements.
                </p>
                <p>
                  The Customer remains responsible for determining the retention period legally
                  required for its own records.
                </p>
                <p>
                  DREVORA may retain limited records for longer where required by law, necessary for
                  legal claims, fraud prevention, security investigations or dispute resolution.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="exports">
                <SectionHeading id="exports">12. Customer Exports and Independent Copies</SectionHeading>
                <Callout title="Exports and independent copies">
                  <p>
                    Where export functionality is available, the Customer may export records
                    regularly and should store those exports in its own private storage system.
                  </p>
                  <p>
                    The Customer should not rely on DREVORA as the only permanent copy of records
                    that it is legally required to retain.
                  </p>
                </Callout>
                <p>
                  The Customer should maintain independent copies of information that is important
                  to its business, regulatory compliance or legal obligations.
                </p>
                <p>
                  Where export functionality is available, the Customer may export records
                  regularly, including as frequently as daily, and store those exports in its own
                  private storage system.
                </p>
                <p>Export functionality and supported formats may vary between modules.</p>
                <p>
                  The Customer should not rely on DREVORA as the only permanent copy of records that
                  it is legally required to retain.
                </p>
                <p>
                  Before cancelling a subscription or closing an account, the Customer should export
                  all records it wishes to keep.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="security">
                <SectionHeading id="security">13. Data Security and Data Loss</SectionHeading>
                <p>
                  DREVORA uses reasonable technical and organisational measures intended to protect
                  Customer Data, including authentication, role-based access, encrypted
                  communications and organisation-level access controls.
                </p>
                <p>
                  However, no online service, storage provider or transmission method can guarantee
                  absolute security, uninterrupted availability or that data loss can never occur.
                </p>
                <p>DREVORA does not guarantee that:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>the Service will always be available without interruption;</li>
                  <li>all data can always be recovered;</li>
                  <li>third-party infrastructure will never fail;</li>
                  <li>Customer devices, accounts or networks will remain secure.</li>
                </ul>
                <p>
                  The Customer is responsible for maintaining reasonable independent backups using
                  available export tools.
                </p>
                <p>
                  Subject to the liability provisions in these Terms, DREVORA is not responsible for
                  data loss caused by:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Customer deletion or incorrect input;</li>
                  <li>misuse of accounts or credentials;</li>
                  <li>failure to maintain independent copies;</li>
                  <li>unauthorised access caused by the Customer’s security failures;</li>
                  <li>third-party service outages outside DREVORA’s reasonable control;</li>
                  <li>events outside DREVORA’s reasonable control.</li>
                </ul>
                <p>Nothing in this section excludes liability that cannot lawfully be excluded.</p>
              </section>

              <section className="space-y-3" aria-labelledby="acceptable-use">
                <SectionHeading id="acceptable-use">14. Acceptable Use</SectionHeading>
                <p>The Customer and its users must not:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>use DREVORA for unlawful, fraudulent or harmful purposes;</li>
                  <li>access or attempt to access another organisation’s data;</li>
                  <li>bypass security, permissions or usage restrictions;</li>
                  <li>upload malware, malicious code or unlawful content;</li>
                  <li>interfere with or overload the Service;</li>
                  <li>probe or test security without written permission;</li>
                  <li>
                    reverse engineer the Service except where that right cannot legally be excluded;
                  </li>
                  <li>copy, resell, sublicense or commercially exploit the Service without permission;</li>
                  <li>use DREVORA to discriminate against, harass or unlawfully monitor Workers;</li>
                  <li>upload information that the Customer has no legal right to process.</li>
                </ul>
              </section>

              <section className="space-y-3" aria-labelledby="availability">
                <SectionHeading id="availability">15. Service Availability and Maintenance</SectionHeading>
                <p>
                  DREVORA aims to provide a reliable Service but does not guarantee uninterrupted,
                  delay-free or error-free availability.
                </p>
                <p>The Service may be unavailable because of:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>planned or emergency maintenance;</li>
                  <li>software updates;</li>
                  <li>security work;</li>
                  <li>internet or infrastructure failures;</li>
                  <li>third-party provider outages;</li>
                  <li>legal or regulatory requirements;</li>
                  <li>events outside reasonable control.</li>
                </ul>
                <p>
                  Where reasonably possible, DREVORA will try to minimise disruption and communicate
                  significant planned maintenance.
                </p>
                <p>
                  No service-level agreement or guaranteed support-response time applies unless
                  agreed separately in writing.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="third-party">
                <SectionHeading id="third-party">16. Third-Party Services</SectionHeading>
                <p>
                  DREVORA may use third-party providers for hosting, databases, authentication,
                  storage, email delivery, payments, analytics, error reporting and network
                  security.
                </p>
                <p>
                  Those providers may include services such as Supabase, Vercel, Cloudflare, Stripe
                  and Resend where they are actively used by DREVORA.
                </p>
                <p>
                  DREVORA is not responsible for a third-party failure outside its reasonable
                  control but will take reasonable steps to restore affected functionality.
                </p>
                <p>
                  Third-party services may be governed by their own terms and privacy practices.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="ip">
                <SectionHeading id="ip">17. Intellectual Property</SectionHeading>
                <p>
                  DREVORA and all related software, source code, interfaces, designs, branding,
                  documentation and platform content belong to Aurimas Jokubaitis or the applicable
                  licensors.
                </p>
                <p>
                  The Customer receives a limited, non-exclusive, non-transferable and revocable
                  right to use DREVORA for its internal business operations during an active
                  subscription.
                </p>
                <p>The Customer must not:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>copy or reproduce the Service;</li>
                  <li>sell, sublicense or provide unauthorised third-party access;</li>
                  <li>remove ownership or copyright notices;</li>
                  <li>use protected DREVORA materials to build a competing product;</li>
                  <li>claim ownership of DREVORA software or branding.</li>
                </ul>
                <p>Customer Data remains owned by the Customer.</p>
              </section>

              <section className="space-y-3" aria-labelledby="confidentiality">
                <SectionHeading id="confidentiality">18. Confidentiality</SectionHeading>
                <p>
                  Each party must protect confidential information received from the other party and
                  use it only for providing or using the Service.
                </p>
                <p>Confidentiality obligations do not apply to information that:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>is lawfully public;</li>
                  <li>was already lawfully known;</li>
                  <li>is lawfully received from another source;</li>
                  <li>is independently developed without using confidential information;</li>
                  <li>must be disclosed by law or a competent authority.</li>
                </ul>
              </section>

              <section className="space-y-3" aria-labelledby="suspension">
                <SectionHeading id="suspension">19. Suspension and Termination</SectionHeading>
                <p>DREVORA may suspend or terminate access where:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>subscription fees remain unpaid;</li>
                  <li>the Customer materially breaches these Terms;</li>
                  <li>use creates a security, legal or operational risk;</li>
                  <li>fraudulent or unlawful activity is suspected;</li>
                  <li>
                    continued access could materially harm DREVORA, another Customer or a third
                    party.
                  </li>
                </ul>
                <p>
                  Where reasonably possible, DREVORA will provide notice and an opportunity to
                  correct the issue.
                </p>
                <p>The Customer may cancel and stop using the Service at any time.</p>
              </section>

              <section className="space-y-3" aria-labelledby="closure">
                <SectionHeading id="closure">20. Account Closure and Data Access</SectionHeading>
                <p>
                  When the subscription ends, access may continue until the end of the paid billing
                  period.
                </p>
                <p>
                  After access ends, DREVORA may provide a limited period for final data export
                  where technically and operationally available.
                </p>
                <p>
                  The Customer must not assume that access or export will remain available
                  indefinitely after termination.
                </p>
                <p>
                  Data may subsequently be deleted or anonymised according to the Privacy Policy,
                  retention schedule, legal requirements and any applicable Data Processing
                  Agreement.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="liability">
                <SectionHeading id="liability">21. Limitation of Liability</SectionHeading>
                <Callout title="Liability that cannot be excluded">
                  <p>
                    Nothing in these Terms excludes or limits liability for death or personal injury
                    caused by negligence, fraud or fraudulent misrepresentation, deliberate
                    misconduct, or any liability that cannot legally be excluded or limited.
                  </p>
                  <p>
                    Subject to liability that cannot legally be limited, DREVORA’s total aggregate
                    liability will not exceed the subscription fees paid by the Customer during the
                    12 months immediately preceding the event giving rise to the claim.
                  </p>
                </Callout>
                <p>Nothing in these Terms excludes or limits liability for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>death or personal injury caused by negligence;</li>
                  <li>fraud or fraudulent misrepresentation;</li>
                  <li>deliberate misconduct;</li>
                  <li>any liability that cannot legally be excluded or limited.</li>
                </ul>
                <p>Subject to the above, DREVORA will not be liable for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>indirect or consequential loss;</li>
                  <li>loss of profit, revenue, contracts, business or opportunity;</li>
                  <li>regulatory penalties caused by the Customer’s own acts or omissions;</li>
                  <li>inaccurate or incomplete Customer-entered data;</li>
                  <li>decisions made solely from reminders, reports or dashboard information;</li>
                  <li>
                    failure by the Customer to export or independently retain important records;
                  </li>
                  <li>third-party failures outside DREVORA’s reasonable control;</li>
                  <li>
                    unauthorised account use resulting from the Customer’s failure to secure
                    credentials.
                  </li>
                </ul>
                <p>
                  Subject to liability that cannot legally be limited, DREVORA’s total aggregate
                  liability arising from or connected with the Service will not exceed the
                  subscription fees paid by the Customer during the 12 months immediately preceding
                  the event giving rise to the claim.
                </p>
                <p>Each limitation applies only to the extent permitted by applicable law.</p>
              </section>

              <section className="space-y-3" aria-labelledby="indemnity">
                <SectionHeading id="indemnity">22. Customer Indemnity</SectionHeading>
                <p>
                  The Customer will be responsible for reasonably foreseeable claims, losses and
                  costs suffered by DREVORA as a direct result of:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>the Customer’s unlawful processing of personal data;</li>
                  <li>information uploaded without lawful authority;</li>
                  <li>material breach of these Terms;</li>
                  <li>deliberate misuse of the Service;</li>
                  <li>infringement of a third party’s rights through Customer Data.</li>
                </ul>
                <p>
                  This section does not require the Customer to indemnify DREVORA for losses caused
                  by DREVORA’s own negligence, breach or unlawful conduct.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="feedback">
                <SectionHeading id="feedback">23. Feedback</SectionHeading>
                <p>
                  If the Customer provides suggestions, ideas or product feedback, DREVORA may use
                  that feedback to improve the Service without payment or obligation.
                </p>
                <p>
                  This does not transfer ownership of the Customer’s confidential information or
                  Customer Data.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="changes">
                <SectionHeading id="changes">24. Changes to the Service or these Terms</SectionHeading>
                <p>DREVORA may update the Service or these Terms to reflect:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>product development;</li>
                  <li>security improvements;</li>
                  <li>changes in law;</li>
                  <li>regulatory requirements;</li>
                  <li>third-party provider changes;</li>
                  <li>billing or operational changes.</li>
                </ul>
                <p>
                  Material changes to these Terms will be notified through email, the platform or
                  another reasonable method before they take effect.
                </p>
                <p>
                  Continued use after the effective date of updated Terms constitutes acceptance of
                  those updated Terms.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="force-majeure">
                <SectionHeading id="force-majeure">25. Force Majeure</SectionHeading>
                <p>
                  Neither party is responsible for delay or failure caused by events outside its
                  reasonable control, including major internet failure, natural disaster, war,
                  government action, widespread cyberattack, utility failure or third-party
                  infrastructure outage.
                </p>
                <p>
                  This section does not excuse payment obligations that became due before the event.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="general">
                <SectionHeading id="general">26. General Terms</SectionHeading>
                <p>
                  If any provision of these Terms is found invalid or unenforceable, the remaining
                  provisions continue in effect.
                </p>
                <p>A delay in enforcing a right does not waive that right.</p>
                <p>
                  The Customer may not transfer its subscription or rights under these Terms without
                  written permission from DREVORA.
                </p>
                <p>
                  DREVORA may transfer its rights and obligations as part of a business sale,
                  restructuring or transfer of the DREVORA service, provided this does not
                  materially reduce the Customer’s rights.
                </p>
                <p>
                  These Terms, together with the Privacy Policy, applicable pricing information and
                  any signed Data Processing Agreement, form the entire agreement relating to the
                  Service.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="governing-law">
                <SectionHeading id="governing-law">27. Governing Law and Courts</SectionHeading>
                <p>
                  These Terms and any dispute or claim arising from them are governed by the laws of
                  England and Wales.
                </p>
                <p>
                  The courts of England and Wales have exclusive jurisdiction, except where
                  applicable law requires otherwise.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="contact">
                <SectionHeading id="contact">28. Contact</SectionHeading>
                <SubHeading>DREVORA</SubHeading>
                <p>Operated by Aurimas Jokubaitis, trading as DREVORA</p>
                <p>Business structure: Sole trader</p>
                <p>
                  Business address: <Placeholder>[BUSINESS ADDRESS]</Placeholder>
                </p>
                <p>Email: admin@drevora.uk</p>
                <p>Website: drevora.app</p>
                <p>
                  Effective date: <Placeholder>[EFFECTIVE DATE]</Placeholder>
                </p>
              </section>
            </article>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
