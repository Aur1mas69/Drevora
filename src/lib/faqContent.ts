export type FaqItem = {
  id: string
  question: string
  answer: string
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
          'Each vehicle needs a vehicle type assigned so DREVORA can load the correct checklist. Open Vehicles, edit the vehicle, and select a vehicle type, then save. When you create a check from Vehicle Checks → New Check, the checklist for that type loads automatically. You can also add extra checks for a vehicle type from the vehicle edit screen.',
      },
    ],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    description: 'Capture working hours and move them through approval.',
    items: [
      {
        id: 'approve-timesheets',
        question: 'How to approve timesheets',
        answer:
          'Open Timesheets, filter or search for submitted weeks, then open a timesheet and choose Approve. You can also select multiple submitted timesheets and use bulk approve from the toolbar. Approved timesheets are locked for further review.',
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
          'Workers sign in to the worker portal and open My Holidays. Under Book holiday, choose a start date and end date, optionally add a reason, then select Submit request. The request appears under My Requests and can be reviewed by office staff on Holiday Requests.',
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
          'Open Holiday Requests and scroll to Holiday Calendar below the requests table. Switch between Month and Week, then use the arrows to move through dates. Select a day to see who is on leave. Workers can also see their own leave on the calendar in My Holidays.',
      },
    ],
  },
  {
    id: 'vehicle-checks',
    title: 'Vehicle Checks',
    description: 'Daily inspections, templates, and defect tracking.',
    items: [
      {
        id: 'defect-reports',
        question: 'How to view defect reports',
        answer:
          'Open Vehicle Checks and use status filters or summary cards to find failed inspections and open defects. Open a check from the table to review individual checklist items, notes, and overall result in the detail drawer.',
      },
    ],
  },
]
