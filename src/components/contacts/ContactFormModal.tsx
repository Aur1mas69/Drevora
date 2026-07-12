import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { Contact, ContactFormValues } from '@/lib/contactTypes'
import { CONTACT_CATEGORIES } from '@/lib/contactTypes'
import {
  buildEmptyContactFormValues,
  contactFormValuesToInput,
  contactToFormValues,
  validateContactForm,
} from '@/lib/contactUtils'
import type { Driver } from '@/services/driversService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { contactFieldClass, contactTextareaClass } from './contactUiStyles'

type ContactFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  contact: Contact | null
  workers: Driver[]
  isSaving?: boolean
  onClose: () => void
  onSubmit: (values: ReturnType<typeof contactFormValuesToInput>) => Promise<void>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>
}

function workerDisplayEmail(worker: Driver): string {
  const email = worker.email?.trim() ?? ''
  if (!email || email.toLowerCase().endsWith('@workers.internal')) return ''
  return email
}

function workerLabel(worker: Driver): string {
  const name = `${worker.firstName} ${worker.lastName}`.trim() || 'Unnamed worker'
  const code = worker.workerCode?.trim()
  return code ? `${name} (${code})` : name
}

export function ContactFormModal({
  isOpen,
  mode,
  contact,
  workers,
  isSaving = false,
  onClose,
  onSubmit,
}: ContactFormModalProps) {
  useBodyScrollLock(isOpen)
  const [values, setValues] = useState<ContactFormValues>(buildEmptyContactFormValues())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const selectableWorkers = useMemo(
    () =>
      [...workers]
        .filter((worker) => worker.status !== 'Suspended')
        .sort((left, right) =>
          `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`),
        ),
    [workers],
  )

  useEffect(() => {
    if (!isOpen) return
    setValues(contact ? contactToFormValues(contact) : buildEmptyContactFormValues())
    setErrors({})
    setSubmitError(null)
  }, [contact, isOpen])

  function updateField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  function handleLinkedWorkerChange(workerId: string) {
    if (!workerId) {
      setValues((current) => ({ ...current, workerId: '' }))
      return
    }

    const worker = workers.find((item) => item.id === workerId)
    if (!worker) {
      updateField('workerId', workerId)
      return
    }

    setValues((current) => ({
      ...current,
      workerId,
      category: 'worker',
      name: `${worker.firstName} ${worker.lastName}`.trim() || current.name,
      phone: worker.phone?.trim() || current.phone,
      email: workerDisplayEmail(worker) || current.email,
      roleTitle: worker.role || current.roleTitle,
    }))
    setErrors((current) => ({ ...current, name: '', organisation: '' }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = validateContactForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitError(null)
    try {
      await onSubmit(contactFormValuesToInput(values))
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save contact.')
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#218EE7]">
              {mode === 'create' ? 'New contact' : 'Edit contact'}
            </p>
            <h2 id="contact-form-title" className="mt-1 text-xl font-semibold text-[#113C69]">
              {mode === 'create' ? 'Add Contact' : 'Edit Contact'}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <label className="block text-sm font-medium text-slate-700">
              Linked Worker
              <select
                value={values.workerId}
                onChange={(event) => handleLinkedWorkerChange(event.target.value)}
                className={contactFieldClass}
                aria-label="Linked Worker"
              >
                <option value="">None</option>
                {selectableWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {workerLabel(worker)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs font-medium text-[#5499BF]">
                Optional. Prefills name, phone and email from the Worker profile.
              </p>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Contact name
                <input
                  value={values.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className={contactFieldClass}
                />
                <FieldError message={errors.name} />
              </label>
              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Company / Organisation
                <input
                  value={values.organisation}
                  onChange={(event) => updateField('organisation', event.target.value)}
                  className={contactFieldClass}
                />
                <FieldError message={errors.organisation} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Category
                <select
                  value={values.category}
                  onChange={(event) =>
                    updateField('category', event.target.value as ContactFormValues['category'])
                  }
                  className={contactFieldClass}
                >
                  {CONTACT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Status
                <select
                  value={values.status}
                  onChange={(event) =>
                    updateField('status', event.target.value as ContactFormValues['status'])
                  }
                  className={contactFieldClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Phone
                <input
                  value={values.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  value={values.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className={contactFieldClass}
                />
                <FieldError message={errors.email} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Website
                <input
                  value={values.website}
                  onChange={(event) => updateField('website', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Role / Position
                <input
                  value={values.roleTitle}
                  onChange={(event) => updateField('roleTitle', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                VAT number
                <input
                  value={values.vatNumber}
                  onChange={(event) => updateField('vatNumber', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Account reference
                <input
                  value={values.accountReference}
                  onChange={(event) => updateField('accountReference', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Address line 1
                <input
                  value={values.addressLine1}
                  onChange={(event) => updateField('addressLine1', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Address line 2
                <input
                  value={values.addressLine2}
                  onChange={(event) => updateField('addressLine2', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Town / City
                <input
                  value={values.townCity}
                  onChange={(event) => updateField('townCity', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                County
                <input
                  value={values.county}
                  onChange={(event) => updateField('county', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Postcode
                <input
                  value={values.postcode}
                  onChange={(event) => updateField('postcode', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Country
                <input
                  value={values.country}
                  onChange={(event) => updateField('country', event.target.value)}
                  className={contactFieldClass}
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Notes
              <textarea
                value={values.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                className={contactTextareaClass}
              />
            </label>

            {submitError ? (
              <p className="rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-[12px] bg-[#218EE7] px-4 text-sm font-semibold text-white hover:bg-[#0B68BE]"
            >
              {isSaving ? 'Saving…' : mode === 'create' ? 'Add Contact' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
