export type FaqItem = {
  id: string
  question: string
  answer: string
  /** When true, a “Coming later” badge is shown on the question. */
  comingLater?: boolean
}

export type FaqSection = {
  id: string
  title: string
  description: string
  items: FaqItem[]
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Set up workers, vehicles, and inspections for your fleet.',
    items: [
      {
        id: 'add-workers',
        question: 'How to add workers',
        answer:
          'Open Workers from the sidebar, then use Add Worker. Enter the worker’s name, role, contact details, and status, then save. New workers appear in the list and can be linked to vehicles, timesheets, and holiday requests.',
      },
      {
        id: 'add-vehicles',
        question: 'How to add vehicles',
        answer:
          'Go to Vehicles and choose Add Vehicle. Enter the registration, assign a vehicle type and status, then save optional details such as MOT and insurance dates. Vehicles are available for timesheets, compliance, and vehicle checks once added.',
      },
      {
        id: 'vehicle-checks-setup',
        question: 'How to set up vehicle checks',
        answer:
          'Each vehicle needs a vehicle type assigned so DREVORA can load the correct checklist template. Edit the vehicle record and select a type before recording checks. Checklists are created automatically from templates stored for that type. A visual template editor in the admin UI is planned for a future release.',
      },
    ],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    description: 'Capture working hours and move them through approval.',
    items: [
      {
        id: 'driver-submit-hours',
        question: 'How drivers submit hours',
        answer:
          'In the current MVP, office staff create timesheets under Timesheets, enter daily start, break, and finish times in the timesheet drawer, then submit the week when ready. A dedicated self-service flow for drivers to submit their own hours from the driver portal is not available yet.',
        comingLater: true,
      },
      {
        id: 'approve-timesheets',
        question: 'How to approve timesheets',
        answer:
          'Open Timesheets, filter or search for submitted weeks, then open a timesheet and choose Approve. You can also select multiple submitted timesheets and use bulk approve from the toolbar. Approved timesheets are locked for payroll review.',
      },
      {
        id: 'export-payroll',
        question: 'How to export to payroll',
        answer:
          'Payroll export files and integrations are not available in the MVP. Overtime multiplier and currency can be configured under Settings → Timesheets → Timesheet Rules for when export is released.',
        comingLater: true,
      },
    ],
  },
  {
    id: 'holiday-requests',
    title: 'Holiday Requests',
    description: 'Manage leave requests and approvals.',
    items: [
      {
        id: 'driver-request-holiday',
        question: 'How drivers request holidays',
        answer:
          'Office staff can create a holiday request from Holiday Requests using New Request, selecting the worker, dates, and reason. Worker self-service holiday requests from the driver portal are planned for a future release.',
        comingLater: true,
      },
      {
        id: 'approve-decline-holiday',
        question: 'How to approve/decline',
        answer:
          'Open Holiday Requests, locate a pending request, and use Approve or Reject from the row actions menu. You can also open the request drawer to review details before deciding. Approved requests update the worker’s leave record in the list.',
      },
      {
        id: 'holiday-calendar',
        question: 'Holiday calendar view',
        answer:
          'A dedicated calendar view for team leave is not available yet. Use the Holiday Requests table with date filters and summary cards to see pending, approved, and upcoming leave.',
        comingLater: true,
      },
    ],
  },
  {
    id: 'vehicle-checks',
    title: 'Vehicle Checks',
    description: 'Daily inspections, templates, and defect tracking.',
    items: [
      {
        id: 'check-templates',
        question: 'How to set up templates',
        answer:
          'Checklist templates are linked to vehicle types in the database and load automatically when you start a new check. Ensure each vehicle has the correct type assigned. An in-app template builder for office admins is planned for a future release.',
        comingLater: true,
      },
      {
        id: 'driver-complete-checks',
        question: 'How drivers complete checks',
        answer:
          'In the MVP, office staff record vehicle checks from Vehicle Checks → New Check, select the vehicle and worker, then complete the generated checklist. A mobile driver workflow for completing checks independently is planned for a future release.',
        comingLater: true,
      },
      {
        id: 'defect-reports',
        question: 'How to view defect reports',
        answer:
          'Open Vehicle Checks and use status filters or summary cards to find failed inspections and open defects. Open a check from the table to review individual checklist items, notes, and overall result in the detail drawer.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Plans, subscriptions, and invoices.',
    items: [
      {
        id: 'upgrade-plan',
        question: 'How to upgrade plan',
        answer:
          'In-app plan upgrades and subscription management are not available in the MVP. Contact support@drevora.app if you need to discuss your account.',
        comingLater: true,
      },
      {
        id: 'cancel-plan',
        question: 'How to cancel',
        answer:
          'Self-service cancellation is not available yet. Email support@drevora.app to discuss account changes.',
        comingLater: true,
      },
      {
        id: 'invoice-downloads',
        question: 'Invoice downloads',
        answer:
          'Invoice history and PDF downloads are not available in the MVP and will be added with billing in a future release.',
        comingLater: true,
      },
    ],
  },
]
