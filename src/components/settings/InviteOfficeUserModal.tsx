import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  settingsFieldClassName,
  settingsSelectClassName,
} from '@/components/settings/SettingsControls'
import {
  OFFICE_USERS_INVITE_ROLE_OPTIONS,
  type OfficeInvitationTargetRole,
  validateOfficeInvitationInput,
} from '@/lib/officeInvitation'
import {
  inviteOfficeUser,
  isOfficeInvitationServiceError,
} from '@/services/officeInvitationService'

type InviteOfficeUserModalProps = {
  open: boolean
  onCancel: () => void
  onInvited: (toastMessage: string) => void
}

const DEFAULT_ROLE: OfficeInvitationTargetRole = 'Office'

/**
 * Invite Office user modal — System roles only (Admin/Manager/Office/Supervisor).
 * Never offers Driver. Submits email / role / fullName only.
 */
export function InviteOfficeUserModal({
  open,
  onCancel,
  onInvited,
}: InviteOfficeUserModalProps) {
  const titleId = useId()
  const fullNameId = useId()
  const emailId = useId()
  const roleId = useId()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OfficeInvitationTargetRole>(DEFAULT_ROLE)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFullName('')
    setEmail('')
    setRole(DEFAULT_ROLE)
    setErrorMessage(null)
    setIsSubmitting(false)
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, onCancel, open])

  if (!open) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSubmitting) return

    const validated = validateOfficeInvitationInput({
      email,
      role,
      fullName,
    })
    if (!validated.ok) {
      setErrorMessage(validated.message)
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await inviteOfficeUser({
        email: validated.email,
        role: validated.role,
        fullName: validated.fullName,
      })
      onInvited(result.toastMessage)
    } catch (error) {
      setErrorMessage(
        isOfficeInvitationServiceError(error)
          ? error.message
          : 'Unable to invite Office user right now. Please try again.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        aria-label="Cancel invite"
        disabled={isSubmitting}
        onClick={() => {
          if (!isSubmitting) onCancel()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100 sm:text-xl"
          >
            Invite user
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Invite an Office user to your company. Driver access is not available
            here.
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-4">
          <div>
            <label
              htmlFor={fullNameId}
              className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Full name
            </label>
            <Input
              id={fullNameId}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Sam Office"
              disabled={isSubmitting}
              className={settingsFieldClassName}
              autoComplete="name"
            />
          </div>

          <div>
            <label
              htmlFor={emailId}
              className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Email
            </label>
            <Input
              id={emailId}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="office@example.com"
              disabled={isSubmitting}
              className={settingsFieldClassName}
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor={roleId}
              className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              System role
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(event) =>
                setRole(event.target.value as OfficeInvitationTargetRole)
              }
              disabled={isSubmitting}
              className={settingsSelectClassName}
            >
              {OFFICE_USERS_INVITE_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {errorMessage ? (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-300" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
              className="h-10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-[#2563EB] px-4 font-semibold text-white hover:bg-[#1d4ed8]"
            >
              {isSubmitting ? 'Inviting…' : 'Send invite'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
