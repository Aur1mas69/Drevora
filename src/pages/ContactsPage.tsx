import { ContactDrawer } from '@/components/contacts/ContactDrawer'
import { ContactFormModal } from '@/components/contacts/ContactFormModal'
import { ContactsDataTable } from '@/components/contacts/ContactsDataTable'
import { ContactsEmptyState } from '@/components/contacts/ContactsEmptyState'
import { ContactsPagination } from '@/components/contacts/ContactsPagination'
import { ContactsToolbar } from '@/components/contacts/ContactsToolbar'
import { DeleteContactModal } from '@/components/contacts/DeleteContactModal'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  Contact,
  ContactCategoryFilter,
  ContactStatusFilter,
} from '@/lib/contactTypes'
import { DEFAULT_CONTACT_PAGE_SIZE } from '@/lib/contactTypes'
import { contactPageCardClass } from '@/components/contacts/contactUiStyles'
import {
  ContactsServiceError,
  createContact,
  deleteContact,
  fetchContacts,
  updateContact,
} from '@/services/contactsService'
import { useCallback, useEffect, useState } from 'react'

export default function ContactsPage() {
  const [items, setItems] = useState<Contact[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ContactCategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<ContactStatusFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_CONTACT_PAGE_SIZE)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [viewContact, setViewContact] = useState<Contact | null>(null)
  const [deleteContactRecord, setDeleteContactRecord] = useState<Contact | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 || categoryFilter !== 'all' || statusFilter !== 'all'

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryFilter, statusFilter, pageSize])

  const loadContacts = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const result = await fetchContacts({
        search: debouncedSearch,
        category: categoryFilter,
        status: statusFilter,
        page,
        pageSize,
      })
      setItems(result.items)
      setTotalCount(result.totalCount)
    } catch (error) {
      const message =
        error instanceof ContactsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load contacts'
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, debouncedSearch, page, pageSize, statusFilter])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  function openCreateModal() {
    setFormMode('create')
    setEditContact(null)
    setIsFormOpen(true)
  }

  function openEditModal(contact: Contact) {
    setFormMode('edit')
    setEditContact(contact)
    setViewContact(null)
    setIsFormOpen(true)
  }

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setCategoryFilter('all')
    setStatusFilter('all')
  }

  async function handleSave(input: Parameters<typeof createContact>[0]) {
    setIsSaving(true)
    try {
      if (formMode === 'create') {
        await createContact(input)
        showToast('Contact added')
      } else if (editContact) {
        await updateContact(editContact.id, input)
        showToast('Contact updated')
      }
      await loadContacts()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteContactRecord) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteContact(deleteContactRecord.id)
      showToast('Contact deleted')
      setDeleteContactRecord(null)
      await loadContacts()
    } catch (error) {
      setDeleteError(
        error instanceof ContactsServiceError
          ? error.message
          : 'Unable to delete contact.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const showEmptyState = !isLoading && !loadError && totalCount === 0 && !hasActiveFilters

  return (
    <AdminLayout premiumBackground>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#218EE7]">
              Company directory
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#113C69]">
              Contacts
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#5499BF]">
              Manage customers, suppliers, garages and important business contacts.
            </p>
          </div>
        </header>

        <ContactsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onClearFilters={clearFilters}
          onAddContact={openCreateModal}
        />

        {loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className={`px-6 py-10 text-center text-sm text-[#5499BF] ${contactPageCardClass}`}>
            Loading contacts…
          </div>
        ) : showEmptyState ? (
          <ContactsEmptyState onAddFirst={openCreateModal} />
        ) : items.length === 0 ? (
          <div className={`px-6 py-10 text-center ${contactPageCardClass}`}>
            <h2 className="text-lg font-semibold text-[#113C69]">No contacts found.</h2>
            <p className="mt-2 text-sm text-[#5499BF]">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div>
            <ContactsDataTable
              contacts={items}
              onView={setViewContact}
              onEdit={openEditModal}
              onDelete={setDeleteContactRecord}
            />
            <ContactsPagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <ContactFormModal
        isOpen={isFormOpen}
        mode={formMode}
        contact={editContact}
        isSaving={isSaving}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSave}
      />

      <ContactDrawer
        contact={viewContact}
        isOpen={viewContact !== null}
        onClose={() => setViewContact(null)}
        onEdit={openEditModal}
      />

      {deleteContactRecord ? (
        <DeleteContactModal
          contact={deleteContactRecord}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            setDeleteContactRecord(null)
            setDeleteError(null)
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[140] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}
