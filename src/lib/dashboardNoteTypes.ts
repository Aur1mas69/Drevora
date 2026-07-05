export type DashboardNoteStatus = 'open' | 'done'

export type DashboardNote = {
  id: string
  companyId: string
  createdBy: string | null
  note: string
  status: DashboardNoteStatus
  priority: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export type CreateDashboardNoteInput = {
  companyId: string
  createdBy?: string | null
  note: string
  dueDate?: string | null
}

export type UpdateDashboardNoteInput = {
  note?: string
  status?: DashboardNoteStatus
  dueDate?: string | null
  priority?: string | null
}
