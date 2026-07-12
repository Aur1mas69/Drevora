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
  { id: 'who-we-are', label: '1. Who We Are' },
  { id: 'roles', label: '2. Our Data Protection Roles' },
  { id: 'personal-information', label: '3. Personal Information We May Process' },
  { id: 'collection', label: '4. How Information Is Collected' },
  { id: 'use', label: '5. How We Use Information' },
  { id: 'lawful-bases', label: '6. Lawful Bases' },
  { id: 'medical', label: '7. Medical and Special-Category Information' },
  { id: 'payments', label: '8. Payment Information' },
  { id: 'emails', label: '9. Transactional Emails' },
  { id: 'providers', label: '10. Service Providers and Sub-processors' },
  { id: 'transfers', label: '11. International Data Transfers' },
  { id: 'security', label: '12. Security' },
  { id: 'retention', label: '13. Data Retention' },
  { id: 'exports', label: '14. Customer Export and Deletion' },
  { id: 'rights', label: '15. Individual Rights' },
  { id: 'cookies', label: '16. Cookies and Local Storage' },
  { id: 'children', label: '17. Children' },
  { id: 'automated', label: '18. Automated Decisions' },
  { id: 'incidents', label: '19. Data Incidents' },
  { id: 'complaints', label: '20. Complaints' },
  { id: 'changes', label: '21. Changes to this Privacy Policy' },
  { id: 'contact', label: '22. Contact Details' },
] as const

export default function PrivacyPage() {
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
            DREVORA Privacy Policy
          </h1>
          <p className={`mt-2 text-sm leading-6 ${adminTextMuted}`}>
            Effective date: <Placeholder>[EFFECTIVE DATE]</Placeholder>
          </p>
          <div
            className="mt-4 rounded-[14px] border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
            role="status"
          >
            Draft Privacy Policy — complete the business address and effective date, and align
            technical retention controls before accepting live customers.
          </div>
        </div>

        <Card
          className={`${adminCard} mx-auto w-full max-w-[860px] border border-[rgba(75,120,220,0.10)] print:border print:border-slate-300 print:shadow-none`}
        >
          <CardContent className="bg-[#F8FBFF] p-6 sm:p-8 dark:bg-slate-900/50 print:bg-white print:p-0">
            <nav
              aria-label="Privacy Policy table of contents"
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
              <section className="space-y-3" aria-labelledby="who-we-are">
                <SectionHeading id="who-we-are">1. Who We Are</SectionHeading>
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
                  This Privacy Policy explains how personal information is collected, used, stored
                  and protected when individuals visit the DREVORA website, create an account or use
                  the DREVORA fleet, workforce and operations management platform.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="roles">
                <SectionHeading id="roles">2. Our Data Protection Roles</SectionHeading>
                <Callout title="Controller and processor roles">
                  <p>
                    DREVORA normally acts as data controller for Customer account, billing, support
                    and security information. Customer organisations normally act as data controller
                    for Worker and operational data they enter, with DREVORA acting as data
                    processor.
                  </p>
                </Callout>
                <p>DREVORA may act in two different roles.</p>

                <SubHeading>When DREVORA acts as data controller</SubHeading>
                <p>
                  DREVORA normally acts as data controller for personal information relating to:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Customer account owners and administrators;</li>
                  <li>subscription and billing contacts;</li>
                  <li>website enquiries;</li>
                  <li>support requests;</li>
                  <li>security and access logs;</li>
                  <li>communications sent directly to DREVORA;</li>
                  <li>DREVORA’s own legal, accounting and business records.</li>
                </ul>
                <p>In these cases, DREVORA determines why and how the information is processed.</p>

                <SubHeading>When DREVORA acts as data processor</SubHeading>
                <p>
                  A Customer organisation normally acts as data controller for personal information
                  it enters or uploads concerning its Workers, drivers, staff, contractors, contacts
                  and business operations.
                </p>
                <p>
                  For that information, DREVORA normally acts as data processor and processes the
                  information on the Customer’s documented instructions.
                </p>
                <p>The Customer is responsible for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>identifying an appropriate lawful basis;</li>
                  <li>providing required privacy information to its Workers;</li>
                  <li>controlling user access;</li>
                  <li>responding to individual rights requests;</li>
                  <li>deciding which information should be entered;</li>
                  <li>selecting appropriate retention periods;</li>
                  <li>deleting information that is no longer required.</li>
                </ul>
                <p>
                  A separate Data Processing Agreement may apply between DREVORA and the Customer.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="personal-information">
                <SectionHeading id="personal-information">
                  3. Personal Information We May Process
                </SectionHeading>
                <p>
                  The information processed depends on which DREVORA modules and features the
                  Customer uses.
                </p>

                <SubHeading>Account and company information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>name;</li>
                  <li>business or company name;</li>
                  <li>email address;</li>
                  <li>telephone number;</li>
                  <li>account role;</li>
                  <li>organisation membership;</li>
                  <li>login and authentication information;</li>
                  <li>subscription status;</li>
                  <li>billing contact details;</li>
                  <li>communications with DREVORA.</li>
                </ul>
                <p>
                  Passwords are managed through the authentication provider and are not stored by
                  DREVORA in readable plain text.
                </p>

                <SubHeading>Worker information</SubHeading>
                <p>Information entered by Customers may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>name;</li>
                  <li>Worker code;</li>
                  <li>email address;</li>
                  <li>telephone number;</li>
                  <li>address, where entered;</li>
                  <li>job role;</li>
                  <li>employment type;</li>
                  <li>employment start date;</li>
                  <li>assigned vehicle;</li>
                  <li>profile image;</li>
                  <li>emergency contact details;</li>
                  <li>driving licence categories;</li>
                  <li>driving licence expiry dates;</li>
                  <li>CPC expiry date;</li>
                  <li>tachograph (tacho) card number;</li>
                  <li>tachograph card expiry date;</li>
                  <li>D4 / medical expiry date, where entered;</li>
                  <li>other compliance expiry dates enabled by the Customer.</li>
                </ul>
                <p>
                  Vehicle records may also include tachograph calibration expiry dates where entered
                  by the Customer.
                </p>

                <SubHeading>Timesheet information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>working dates;</li>
                  <li>clock-in and clock-out times;</li>
                  <li>breaks;</li>
                  <li>normal and overtime hours;</li>
                  <li>daily comments;</li>
                  <li>submission status;</li>
                  <li>approval or rejection information;</li>
                  <li>approval timestamps;</li>
                  <li>related Worker and vehicle information.</li>
                </ul>

                <SubHeading>Holiday and leave information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>requested leave dates;</li>
                  <li>leave duration;</li>
                  <li>holiday entitlement and balances;</li>
                  <li>request status;</li>
                  <li>approval or rejection information;</li>
                  <li>related comments.</li>
                </ul>

                <SubHeading>Vehicle Check information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Worker or driver;</li>
                  <li>vehicle;</li>
                  <li>checklist answers;</li>
                  <li>OK, Defect and N/A selections;</li>
                  <li>odometer readings;</li>
                  <li>inspection start and completion times;</li>
                  <li>duration;</li>
                  <li>defect notes;</li>
                  <li>defect photographs;</li>
                  <li>signatures;</li>
                  <li>related follow-up records.</li>
                </ul>

                <SubHeading>Driver Report information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>report title and description;</li>
                  <li>vehicle issues;</li>
                  <li>damage information;</li>
                  <li>load or cargo issues;</li>
                  <li>site or customer incidents;</li>
                  <li>photographs and other attachments;</li>
                  <li>Worker and vehicle relationships;</li>
                  <li>report status and office actions.</li>
                </ul>

                <SubHeading>Consumables information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Worker;</li>
                  <li>vehicle;</li>
                  <li>consumable type;</li>
                  <li>quantities and units;</li>
                  <li>odometer;</li>
                  <li>supplier or location;</li>
                  <li>price or cost;</li>
                  <li>receipts;</li>
                  <li>notes;</li>
                  <li>date and time.</li>
                </ul>

                <SubHeading>Documents and compliance records</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>document name and type;</li>
                  <li>related Worker, vehicle or organisation;</li>
                  <li>reference number;</li>
                  <li>issue and expiry dates;</li>
                  <li>document status;</li>
                  <li>uploaded file;</li>
                  <li>upload and update history.</li>
                </ul>

                <SubHeading>Contacts information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>contact name;</li>
                  <li>organisation;</li>
                  <li>category;</li>
                  <li>telephone number;</li>
                  <li>email address;</li>
                  <li>address;</li>
                  <li>notes;</li>
                  <li>related Worker, where linked.</li>
                </ul>

                <SubHeading>Technical and security information</SubHeading>
                <p>This may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>IP address;</li>
                  <li>browser and device type;</li>
                  <li>operating system;</li>
                  <li>login time;</li>
                  <li>authentication activity;</li>
                  <li>security events;</li>
                  <li>error and diagnostic information;</li>
                  <li>session identifiers;</li>
                  <li>essential cookie information.</li>
                </ul>
              </section>

              <section className="space-y-3" aria-labelledby="collection">
                <SectionHeading id="collection">4. How Information Is Collected</SectionHeading>
                <p>Information may be collected:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>directly from a Customer account owner;</li>
                  <li>from invited office users, managers or Workers;</li>
                  <li>when information is entered into forms;</li>
                  <li>when files or photographs are uploaded;</li>
                  <li>automatically when the Service is accessed;</li>
                  <li>through authentication and security systems;</li>
                  <li>through payment providers when billing is enabled;</li>
                  <li>through transactional email systems when email delivery is enabled;</li>
                  <li>through support enquiries.</li>
                </ul>
                <p>
                  DREVORA does not obtain Worker information directly from government databases
                  unless a specific integration is later introduced and disclosed.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="use">
                <SectionHeading id="use">5. How We Use Information</SectionHeading>
                <p>Personal information may be used to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>create and manage accounts;</li>
                  <li>authenticate users;</li>
                  <li>provide the DREVORA Service;</li>
                  <li>separate Customer organisations and permissions;</li>
                  <li>
                    operate Timesheets, Holiday Requests, Vehicle Checks, Driver Reports, Documents,
                    Contacts and Consumables;
                  </li>
                  <li>send account invitations and transactional notifications;</li>
                  <li>process subscription payments;</li>
                  <li>provide support;</li>
                  <li>investigate technical issues;</li>
                  <li>protect the Service from unauthorised access;</li>
                  <li>prevent fraud and misuse;</li>
                  <li>maintain audit and security records;</li>
                  <li>meet legal, accounting and regulatory obligations;</li>
                  <li>establish, exercise or defend legal claims;</li>
                  <li>improve the reliability and security of the Service.</li>
                </ul>
                <p>DREVORA does not sell personal information.</p>
                <p>DREVORA does not use Worker Data for advertising.</p>
                <p>DREVORA does not create advertising profiles from Worker Data.</p>
              </section>

              <section className="space-y-3" aria-labelledby="lawful-bases">
                <SectionHeading id="lawful-bases">6. Lawful Bases</SectionHeading>
                <p>When DREVORA acts as data controller, processing may rely on:</p>

                <SubHeading>Contract</SubHeading>
                <p>Where processing is necessary to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>create or manage an account;</li>
                  <li>provide a subscription;</li>
                  <li>deliver support;</li>
                  <li>provide requested Service functionality.</li>
                </ul>

                <SubHeading>Legal obligation</SubHeading>
                <p>Where processing is necessary for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>tax records;</li>
                  <li>accounting obligations;</li>
                  <li>legal requests;</li>
                  <li>regulatory obligations;</li>
                  <li>responding to competent authorities.</li>
                </ul>

                <SubHeading>Legitimate interests</SubHeading>
                <p>Where processing is reasonably necessary for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>protecting accounts;</li>
                  <li>maintaining Service security;</li>
                  <li>preventing fraud;</li>
                  <li>improving reliability;</li>
                  <li>managing support requests;</li>
                  <li>maintaining business records;</li>
                  <li>establishing or defending legal claims.</li>
                </ul>
                <p>
                  DREVORA considers whether those interests are overridden by the rights and
                  interests of affected individuals.
                </p>

                <SubHeading>Consent</SubHeading>
                <p>
                  Consent may be used only where it is genuinely appropriate, for example optional
                  marketing communications.
                </p>
                <p>
                  Consent is not normally relied upon for core Worker Data entered by an employer.
                </p>
                <p>
                  When DREVORA acts as processor, the Customer determines the lawful basis for
                  processing Worker Data.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="medical">
                <SectionHeading id="medical">7. Medical and Special-Category Information</SectionHeading>
                <Callout title="Medical data">
                  <p>
                    Medical document upload functionality is optional and disabled by default unless
                    enabled by the Customer.
                  </p>
                  <p>
                    DREVORA does not require Customers to enter diagnoses, medical conditions,
                    medication details, doctor’s notes, full examination answers or unnecessary
                    medical history.
                  </p>
                </Callout>
                <p>
                  A D4 or medical expiry date and an uploaded medical document may reveal information
                  relating to health and may therefore require additional protection.
                </p>
                <p>
                  Medical document upload functionality is optional and disabled by default unless
                  enabled by the Customer.
                </p>
                <p>The Customer is responsible for determining:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>whether the information is necessary;</li>
                  <li>the applicable lawful basis;</li>
                  <li>the applicable special-category processing condition;</li>
                  <li>who should have access;</li>
                  <li>how long it should be retained;</li>
                  <li>when it should be deleted.</li>
                </ul>
                <p>DREVORA does not require Customers to enter:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>diagnoses;</li>
                  <li>medical conditions;</li>
                  <li>medication details;</li>
                  <li>doctor’s notes;</li>
                  <li>full examination answers;</li>
                  <li>unnecessary medical history.</li>
                </ul>
                <p>
                  Where medical files are supported, they must use private storage and authorised
                  access controls.
                </p>
                <p>
                  Medical files should be retained only for the shortest period reasonably necessary
                  for the Customer’s identified purpose.
                </p>
                <p>
                  Medical documents are not automatically subject to the general six-year
                  operational-record maximum.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="payments">
                <SectionHeading id="payments">8. Payment Information</SectionHeading>
                <p>
                  Where paid subscriptions are enabled, payments may be processed through Stripe or
                  another payment provider shown during checkout.
                </p>
                <p>DREVORA may receive:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>payment status;</li>
                  <li>transaction identifier;</li>
                  <li>subscription identifier;</li>
                  <li>billing contact;</li>
                  <li>invoice information;</li>
                  <li>payment failure status.</li>
                </ul>
                <p>DREVORA does not receive or store full payment card numbers.</p>
                <p>
                  Payment providers process payment information under their own privacy terms.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="emails">
                <SectionHeading id="emails">9. Transactional Emails</SectionHeading>
                <p>
                  Where transactional email delivery is enabled, DREVORA may use a provider such as
                  Resend to send:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>account invitations;</li>
                  <li>password or authentication messages;</li>
                  <li>holiday request updates;</li>
                  <li>account notices;</li>
                  <li>subscription notices;</li>
                  <li>security notifications;</li>
                  <li>support responses;</li>
                  <li>website demo or enquiry acknowledgements, where configured.</li>
                </ul>
                <p>Transactional emails are not advertising emails.</p>
              </section>

              <section className="space-y-3" aria-labelledby="providers">
                <SectionHeading id="providers">10. Service Providers and Sub-processors</SectionHeading>
                <p>
                  DREVORA uses third-party providers where necessary to operate, secure and support
                  the Service.
                </p>
                <p>The active providers may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Supabase — database, authentication and file storage;</li>
                  <li>Vercel — application hosting and delivery;</li>
                  <li>Stripe — subscription payment processing, when paid billing is enabled;</li>
                  <li>
                    Resend — transactional and enquiry email delivery, when email delivery is
                    enabled;
                  </li>
                </ul>
                <p>
                  These providers may process limited personal information required to provide their
                  services.
                </p>
                <p>DREVORA does not share personal information with advertisers or data brokers.</p>
              </section>

              <section className="space-y-3" aria-labelledby="transfers">
                <SectionHeading id="transfers">11. International Data Transfers</SectionHeading>
                <p>
                  Some providers may store or process information outside the United Kingdom.
                </p>
                <p>
                  Where a restricted international transfer occurs, DREVORA relies on an appropriate
                  transfer mechanism where required, which may include:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>a UK adequacy regulation;</li>
                  <li>the UK International Data Transfer Agreement;</li>
                  <li>the UK Addendum to approved Standard Contractual Clauses;</li>
                  <li>another legally recognised safeguard.</li>
                </ul>
                <p>
                  DREVORA does not claim that all processing occurs exclusively in the United
                  Kingdom or European Economic Area.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="security">
                <SectionHeading id="security">12. Security</SectionHeading>
                <p>
                  DREVORA uses reasonable technical and organisational measures intended to protect
                  personal information.
                </p>
                <p>These measures may include:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>encrypted HTTPS communications;</li>
                  <li>authentication controls;</li>
                  <li>role-based access;</li>
                  <li>Customer organisation isolation;</li>
                  <li>Supabase Row Level Security where enabled for specific tables;</li>
                  <li>private file storage;</li>
                  <li>temporary signed file URLs;</li>
                  <li>restricted administrative access;</li>
                  <li>security monitoring;</li>
                  <li>backups provided through infrastructure services;</li>
                  <li>access and activity logging where implemented.</li>
                </ul>
                <p>
                  No internet-based service can guarantee absolute security or uninterrupted
                  availability.
                </p>
                <p>Customers are responsible for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>keeping credentials secure;</li>
                  <li>removing former users;</li>
                  <li>assigning appropriate roles;</li>
                  <li>reviewing access permissions;</li>
                  <li>maintaining independent copies of important business records.</li>
                </ul>
              </section>

              <section className="space-y-3" aria-labelledby="retention">
                <SectionHeading id="retention">13. Data Retention</SectionHeading>
                <Callout title="Six-year maximum framework">
                  <p>
                    Six years is a maximum retention framework. It does not mean every record will
                    always be retained for six years, and automated six-year deletion is not yet
                    implemented across the Service.
                  </p>
                </Callout>
                <p>
                  DREVORA retains personal information only for as long as reasonably necessary for
                  the relevant purpose, Customer instructions, legal obligations, security
                  requirements and the establishment or defence of legal claims.
                </p>
                <p>The following is a maximum retention framework.</p>
                <p>It does not mean every record will always be retained for six years.</p>

                <SubHeading>Account, contract and billing records</SubHeading>
                <p>
                  Account, subscription, invoice, transaction and contract records may be retained
                  for up to six years after the relevant transaction or the end of the Customer
                  relationship where required for accounting, tax, contractual or legal purposes.
                </p>

                <SubHeading>Worker profile and compliance records</SubHeading>
                <p>Worker profile, role, licence, CPC, tachograph and related operational records may be retained:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>while the Customer account is active;</li>
                  <li>until deleted by the Customer;</li>
                  <li>
                    for up to six years from the record’s creation, last update or relevant
                    employment end date where the Customer requires that retention.
                  </li>
                </ul>

                <SubHeading>Timesheets</SubHeading>
                <p>
                  Timesheet and approval records may be retained for up to six years from the
                  relevant working period, unless the Customer deletes them sooner or a different
                  legal requirement applies.
                </p>

                <SubHeading>Holiday and leave records</SubHeading>
                <p>
                  Holiday request, entitlement and approval records may be retained for up to six
                  years from the relevant leave year or record date, unless deleted sooner.
                </p>

                <SubHeading>Vehicle Checks</SubHeading>
                <p>
                  Vehicle Check records, checklist answers, defect information, photographs,
                  signatures and audit information may be retained for up to six years from
                  completion, where required by the Customer.
                </p>
                <Callout title="Current Vehicle Check retention status">
                  <p>
                    Automated six-year deletion is not yet implemented. The Vehicle Checks module
                    currently documents an intended operational retention target of 24 months and
                    does not yet enforce automated deletion at either 24 months or six years.
                  </p>
                </Callout>

                <SubHeading>Driver Reports</SubHeading>
                <p>
                  Driver Report and incident records may be retained for up to six years from
                  closure or last update, unless the Customer deletes them sooner or chooses a
                  shorter period.
                </p>

                <SubHeading>Consumables</SubHeading>
                <p>
                  Consumables records may be retained for up to six years from the record date,
                  unless deleted sooner.
                </p>

                <SubHeading>Documents</SubHeading>
                <p>Ordinary company, Worker and vehicle documents may be retained:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>until deleted by the Customer;</li>
                  <li>until no longer required;</li>
                  <li>
                    for up to six years where a legitimate business, legal or contractual purpose
                    continues.
                  </li>
                </ul>
                <p>Expired documents should not automatically be kept longer than necessary.</p>

                <SubHeading>Medical documents</SubHeading>
                <p>
                  Medical files must be retained only for the period determined necessary by the
                  Customer.
                </p>
                <p>
                  They should be deleted sooner where the Customer no longer has a lawful and
                  necessary reason to retain them.
                </p>

                <SubHeading>Support communications</SubHeading>
                <p>
                  Support messages may be retained for a reasonable period after the request is
                  closed, and for longer where required for security, contractual or legal reasons.
                </p>

                <SubHeading>Security and technical logs</SubHeading>
                <p>
                  Security, authentication and technical logs are retained for a limited period
                  appropriate to their purpose. Specific durations depend on the active system and
                  provider settings and are not fixed in this policy.
                </p>

                <SubHeading>Backups</SubHeading>
                <p>
                  Deleted information may remain temporarily in encrypted or protected
                  infrastructure backups until the relevant backup cycle expires. Specific backup
                  durations depend on the infrastructure provider and are not fixed in this policy.
                </p>
                <p>
                  After the applicable period, information will be deleted, anonymised or made
                  inaccessible, unless retention is required by law, a legal hold, fraud
                  investigation, security incident or active dispute.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="exports">
                <SectionHeading id="exports">14. Customer Export and Deletion</SectionHeading>
                <Callout title="Customer exports">
                  <p>
                    Where export functionality is available, Customers may export data and store it
                    in their own private storage. Export features and available formats vary between
                    modules.
                  </p>
                </Callout>
                <p>
                  Customers should maintain independent copies of information important to their
                  legal, operational or regulatory obligations.
                </p>
                <p>
                  Where export functionality is available, Customers may export data and store it in
                  their own private storage.
                </p>
                <p>Export features and available formats vary between modules.</p>
                <p>
                  A Customer may delete records through available application functions or contact
                  DREVORA for assistance.
                </p>
                <p>
                  Before closing an account, the Customer should export records it wishes to retain.
                </p>
                <p>After account closure:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>access may continue until the paid subscription period ends;</li>
                  <li>a limited export period may be provided where technically available;</li>
                  <li>
                    information may later be deleted or anonymised according to the retention
                    schedule;
                  </li>
                  <li>some information may remain temporarily in protected backups.</li>
                </ul>
              </section>

              <section className="space-y-3" aria-labelledby="rights">
                <SectionHeading id="rights">15. Individual Rights</SectionHeading>
                <Callout title="Individual rights">
                  <p>
                    Depending on the circumstances, individuals may have rights of access,
                    correction, deletion, restriction, objection, portability, consent withdrawal
                    where consent is used, and the right to complain to the Information
                    Commissioner’s Office.
                  </p>
                  <p>
                    Workers should normally contact their employer or organisation first regarding
                    information entered into DREVORA by that organisation.
                  </p>
                </Callout>
                <p>Depending on the circumstances, individuals may have rights to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>request access to personal information;</li>
                  <li>correct inaccurate information;</li>
                  <li>request deletion;</li>
                  <li>restrict processing;</li>
                  <li>object to processing;</li>
                  <li>receive portable information;</li>
                  <li>withdraw consent where consent is used;</li>
                  <li>complain to the Information Commissioner’s Office.</li>
                </ul>
                <p>
                  These rights may be limited where retention or processing is required by law or
                  where another lawful exception applies.
                </p>

                <SubHeading>Workers</SubHeading>
                <p>
                  Workers should normally contact their employer or organisation first regarding
                  information entered into DREVORA by that organisation.
                </p>
                <p>The Customer normally acts as controller for that Worker Data.</p>
                <p>
                  DREVORA will reasonably assist Customers with rights requests where required under
                  the applicable Data Processing Agreement.
                </p>

                <SubHeading>Customer account contacts</SubHeading>
                <p>Customer account owners and other individuals may contact:</p>
                <p>admin@drevora.uk</p>
              </section>

              <section className="space-y-3" aria-labelledby="cookies">
                <SectionHeading id="cookies">16. Cookies and Local Storage</SectionHeading>
                <p>
                  DREVORA uses essential cookies, session storage or local storage where necessary
                  for:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>authentication;</li>
                  <li>security;</li>
                  <li>session management;</li>
                  <li>preferences;</li>
                  <li>essential application functionality.</li>
                </ul>
                <p>
                  DREVORA does not use advertising cookies or behavioural advertising trackers
                  unless this policy and the applicable consent mechanism are updated first.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="children">
                <SectionHeading id="children">17. Children</SectionHeading>
                <p>DREVORA is a business platform and is not directed at children.</p>
                <p>
                  Customer organisations must not create Worker accounts for individuals who are not
                  legally permitted to perform the relevant work.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="automated">
                <SectionHeading id="automated">18. Automated Decisions</SectionHeading>
                <p>
                  DREVORA does not make solely automated employment, dismissal, payroll, medical,
                  disciplinary or regulatory decisions that produce legal or similarly significant
                  effects.
                </p>
                <p>
                  Dashboard indicators, reminders, status calculations and expiry warnings are
                  management tools.
                </p>
                <p>The Customer remains responsible for reviewing information and making decisions.</p>
              </section>

              <section className="space-y-3" aria-labelledby="incidents">
                <SectionHeading id="incidents">19. Data Incidents</SectionHeading>
                <p>
                  DREVORA investigates suspected personal-data incidents and takes reasonable steps
                  to contain and resolve them.
                </p>
                <p>
                  Where DREVORA acts as processor, it will notify the affected Customer without undue
                  delay after becoming aware of a relevant personal-data breach.
                </p>
                <p>
                  Where DREVORA acts as controller, it will notify the appropriate authority and
                  affected individuals where legally required.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="complaints">
                <SectionHeading id="complaints">20. Complaints</SectionHeading>
                <p>Questions or complaints should first be sent to:</p>
                <p>admin@drevora.uk</p>
                <p>
                  Individuals also have the right to complain to the{' '}
                  <a
                    href="https://ico.org.uk"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#0B68BE] underline-offset-2 hover:underline dark:text-sky-400"
                  >
                    Information Commissioner’s Office
                  </a>
                  .
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="changes">
                <SectionHeading id="changes">21. Changes to this Privacy Policy</SectionHeading>
                <p>DREVORA may update this Privacy Policy to reflect:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>changes to the Service;</li>
                  <li>changes in providers;</li>
                  <li>legal or regulatory requirements;</li>
                  <li>new functionality;</li>
                  <li>security or operational changes.</li>
                </ul>
                <p>
                  Material changes may be notified by email, in-app notice or another reasonable
                  method before taking effect.
                </p>
              </section>

              <section className="space-y-3" aria-labelledby="contact">
                <SectionHeading id="contact">22. Contact Details</SectionHeading>
                <SubHeading>DREVORA</SubHeading>
                <p>Operated by Aurimas Jokubaitis, trading as DREVORA</p>
                <p>Business structure: Sole trader</p>
                <p>
                  Business address: <Placeholder>[BUSINESS ADDRESS]</Placeholder>
                </p>
                <p>England, United Kingdom</p>
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
