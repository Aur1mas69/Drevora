import { useCallback, useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SettingsSection,
  settingsInnerCardClassName,
  settingsStatusTextClassName,
} from '@/components/settings/SettingsControls'
import { InviteOfficeUserModal } from '@/components/settings/InviteOfficeUserModal'
import { formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import { filterOfficeUsersListRows, type OfficeUserListRow } from '@/lib/officeInvitation'
import { cn } from '@/lib/utils'
import {
  isOfficeInvitationServiceError,
  listOfficeUsers,
} from '@/services/officeInvitationService'

type OfficeUsersPanelProps = {
  onToast: (message: string) => void
}

function statusLabel(isActive: boolean): string {
  return isActive ? 'Active' : 'Inactive'
}

/**
 * Settings → Office Users list + invite entry point.
 * Company-scoped Office memberships only — never Driver/Worker rows.
 */
export function OfficeUsersPanel({ onToast }: OfficeUsersPanelProps) {
  const [rows, setRows] = useState<OfficeUserListRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const listed = await listOfficeUsers()
      setRows(filterOfficeUsersListRows(listed))
    } catch (error) {
      setRows([])
      setLoadError(
        isOfficeInvitationServiceError(error)
          ? error.message
          : 'Unable to load Office users right now. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  return (
    <SettingsSection
      title="Office Users"
      description="People with Office access for your company. Workers are managed separately."
    >
      <div className="space-y-4 sm:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={settingsStatusTextClassName}>
            System roles: Admin, Manager, Office, Supervisor.
          </p>
          <Button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="h-10 w-full shrink-0 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] sm:w-auto"
          >
            <UserPlus className="mr-2 size-4" aria-hidden />
            Invite user
          </Button>
        </div>

        {loadError ? (
          <div
            className={cn(settingsInnerCardClassName, 'border-rose-200/80 dark:border-rose-500/35')}
            role="alert"
          >
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-9 rounded-xl"
              onClick={() => void loadUsers()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <div className={settingsInnerCardClassName}>
            <p className={settingsStatusTextClassName}>Loading Office users…</p>
          </div>
        ) : null}

        {!isLoading && !loadError && rows.length === 0 ? (
          <div className={settingsInnerCardClassName}>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No Office users yet
            </p>
            <p className={`mt-1 ${settingsStatusTextClassName}`}>
              Invite an Admin, Manager, Office, or Supervisor to get started.
            </p>
          </div>
        ) : null}

        {!isLoading && rows.length > 0 ? (
          <div className="overflow-hidden rounded-[16px] border border-[rgba(75,120,220,0.12)] dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#F8FBFF] text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">System role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(75,120,220,0.08)] bg-white dark:divide-slate-700 dark:bg-slate-900/40">
                  {rows.map((row) => (
                    <tr key={row.membershipId}>
                      <td className="px-4 py-3 font-medium text-[#2A376F] dark:text-slate-100">
                        {row.fullName || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {row.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {row.role}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            row.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                          )}
                        >
                          {statusLabel(row.isActive)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {row.createdAt
                          ? formatDateTimeFromIso(row.createdAt)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <InviteOfficeUserModal
        open={inviteOpen}
        onCancel={() => setInviteOpen(false)}
        onInvited={(toastMessage) => {
          setInviteOpen(false)
          onToast(toastMessage)
          void loadUsers()
        }}
      />
    </SettingsSection>
  )
}
