'use client'

import { useState } from 'react'

import { sendCustomEmailAction, sendUpdateAction } from '@/app/admin/email-actions'

export default function AdminEmailActionsCard() {
  const [customEmailState, setCustomEmailState] = useState<{
    ok?: boolean
    message?: string
    sentCount?: number
  }>()
  const [updateState, setUpdateState] = useState<{
    ok?: boolean
    message?: string
    sentCount?: number
  }>()
  const [customEmailLoading, setCustomEmailLoading] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [customEmailRecipientType, setCustomEmailRecipientType] = useState<'all' | 'company' | 'selected'>('all')
  const [updateRecipientType, setUpdateRecipientType] = useState<'all' | 'company' | 'selected'>('all')

  async function handleCustomEmail(
    prevState: { ok?: boolean; message?: string; sentCount?: number } | undefined,
    formData: FormData
  ) {
    setCustomEmailLoading(true)
    const result = await sendCustomEmailAction(prevState, formData)
    setCustomEmailState(result)
    setCustomEmailLoading(false)
  }

  async function handleUpdate(
    prevState: { ok?: boolean; message?: string; sentCount?: number } | undefined,
    formData: FormData
  ) {
    setUpdateLoading(true)
    const result = await sendUpdateAction(prevState, formData)
    setUpdateState(result)
    setUpdateLoading(false)
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Email Communications
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Send custom emails or updates to representatives.
        </p>
      </div>

      {/* Custom Email Form */}
      <section aria-labelledby="custom-email-heading">
        <h3 id="custom-email-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Send Custom Email
        </h3>
        <form
          action={handleCustomEmail}
          className="space-y-4"
          data-state={customEmailState?.ok ? 'success' : customEmailState?.ok === false ? 'error' : 'idle'}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="custom-email-subject" className="block text-sm font-medium text-slate-700 mb-1">
                Subject
              </label>
              <input
                id="custom-email-subject"
                name="subject"
                type="text"
                required
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="custom-email-recipient-type" className="block text-sm font-medium text-slate-700 mb-1">
                Recipient Type
              </label>
              <select
                id="custom-email-recipient-type"
                name="recipientType"
                required
                value={customEmailRecipientType}
                onChange={(e) => setCustomEmailRecipientType(e.target.value as 'all' | 'company' | 'selected')}
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
              >
                <option value="all">All Representatives</option>
                <option value="company">Specific Company</option>
                <option value="selected">Selected Representatives</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="custom-email-body" className="block text-sm font-medium text-slate-700 mb-1">
              Email Body (plain text)
            </label>
            <textarea
              id="custom-email-body"
              name="body"
              rows={4}
              required
              className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
            />
          </div>

          {customEmailRecipientType === 'company' && (
            <div className="mt-4">
              <label htmlFor="custom-email-company-id" className="block text-sm font-medium text-slate-700 mb-1">
                Company ID
              </label>
              <input
                id="custom-email-company-id"
                name="companyId"
                type="text"
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
              />
            </div>
          )}
          {customEmailRecipientType === 'selected' && (
            <div className="mt-4">
              <label htmlFor="custom-email-representative-ids" className="block text-sm font-medium text-slate-700 mb-1">
                Representative IDs (comma-separated)
              </label>
              <input
                id="custom-email-representative-ids"
                name="representativeIds"
                type="text"
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000,456e7890-e89b-12d3-a456-426614174001"
              />
            </div>
          )}

          <div className="mt-6">
            <button
              type="submit"
              disabled={customEmailLoading}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 ${
                customEmailLoading ? 'bg-slate-400' : ''
              }`}
            >
              {customEmailLoading ? 'Sending...' : 'Send Email'}
            </button>
          </div>

          {customEmailState && (
            <p className={`mt-4 text-sm font-medium ${
              customEmailState.ok ? 'text-green-600' : 'text-red-600'
            }`}>
              {customEmailState.message}
              {customEmailState.sentCount && ` (Sent to ${customEmailState.sentCount} recipient${customEmailState.sentCount === 1 ? '' : 's'})`}
            </p>
          )}
        </form>
      </section>

      {/* Update/Newsletter Form */}
      <section aria-labelledby="update-heading">
        <h3 id="update-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Send Update / Newsletter
        </h3>
        <form
          action={handleUpdate}
          className="space-y-4"
          data-state={updateState?.ok ? 'success' : updateState?.ok === false ? 'error' : 'idle'}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="update-title" className="block text-sm font-medium text-slate-700 mb-1">
                Title
              </label>
              <input
                id="update-title"
                name="title"
                type="text"
                required
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="update-recipient-type" className="block text-sm font-medium text-slate-700 mb-1">
                Recipient Type
              </label>
              <select
                id="update-recipient-type"
                name="recipientType"
                required
                value={updateRecipientType}
                onChange={(e) => setUpdateRecipientType(e.target.value as 'all' | 'company' | 'selected')}
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
              >
                <option value="all">All Representatives</option>
                <option value="company">Specific Company</option>
                <option value="selected">Selected Representatives</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="update-content" className="block text-sm font-medium text-slate-700 mb-1">
              Update Content (plain text)
            </label>
            <textarea
              id="update-content"
              name="content"
              rows={4}
              required
              className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
            />
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex items-start h-5">
              <input
                id="update-is-important"
                name="isImportant"
                type="checkbox"
                className="h-4 w-4 text-slate-600 focus:ring-slate-500"
              />
            </div>
            <div className="ml-3 text-base">
              <label htmlFor="update-is-important" className="font-medium text-slate-900">
                Mark as important
              </label>
              <p className="text-sm text-slate-500 mt-1">
                Prepends &#x26A0;&#xFE0F; to the title and highlights in email.
              </p>
            </div>
          </div>

          {updateRecipientType === 'company' && (
            <div className="mt-4">
              <label htmlFor="update-company-id" className="block text-sm font-medium text-slate-700 mb-1">
                Company ID
              </label>
              <input
                id="update-company-id"
                name="companyId"
                type="text"
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
              />
            </div>
          )}
          {updateRecipientType === 'selected' && (
            <div className="mt-4">
              <label htmlFor="update-representative-ids" className="block text-sm font-medium text-slate-700 mb-1">
                Representative IDs (comma-separated)
              </label>
              <input
                id="update-representative-ids"
                name="representativeIds"
                type="text"
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-inset placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 sm:text-sm"
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000,456e7890-e89b-12d3-a456-426614174001"
              />
            </div>
          )}

          <div className="mt-6">
            <button
              type="submit"
              disabled={updateLoading}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 ${
                updateLoading ? 'bg-slate-400' : ''
              }`}
            >
              {updateLoading ? 'Sending...' : 'Send Update'}
            </button>
          </div>

          {updateState && (
            <p className={`mt-4 text-sm font-medium ${
              updateState.ok ? 'text-green-600' : 'text-red-600'
            }`}>
              {updateState.message}
              {updateState.sentCount && ` (Sent to ${updateState.sentCount} recipient${updateState.sentCount === 1 ? '' : 's'})`}
            </p>
          )}
        </form>
      </section>
    </div>
  )
}