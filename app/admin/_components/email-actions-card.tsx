'use client'

import { useState } from 'react'

import {
  sendCustomEmailAction,
  sendSmsBlastAction,
  sendUpdateAction,
  type SendCustomEmailState,
  type SendSmsBlastState,
  type SendUpdateState,
} from '@/app/admin/email-actions'

type RecipientType = 'all' | 'company' | 'selected'

type CompanyOption = {
  id: string
  name: string | null
  domain: string
}

type RepresentativeOption = {
  id: string
  company_id: string | null
  full_name: string | null
  email: string
  phone_number: string | null
}

type Audience = {
  type: RecipientType
  companyId: string
  representativeIds: string[]
}

const initialAudience: Audience = {
  type: 'all',
  companyId: '',
  representativeIds: [],
}

export default function AdminEmailActionsCard({
  companies,
  representatives,
  smsConfigured,
  smsConfigurationHint,
}: {
  companies: CompanyOption[]
  representatives: RepresentativeOption[]
  smsConfigured: boolean
  smsConfigurationHint: string
}) {
  const [customEmailState, setCustomEmailState] = useState<SendCustomEmailState>()
  const [updateState, setUpdateState] = useState<SendUpdateState>()
  const [smsState, setSmsState] = useState<SendSmsBlastState>()
  const [customEmailLoading, setCustomEmailLoading] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [emailAudience, setEmailAudience] = useState<Audience>(initialAudience)
  const [updateAudience, setUpdateAudience] = useState<Audience>(initialAudience)
  const [smsAudience, setSmsAudience] = useState<Audience>(initialAudience)

  async function handleCustomEmail(formData: FormData) {
    setCustomEmailLoading(true)
    try {
      setCustomEmailState(await sendCustomEmailAction(customEmailState, formData))
    } finally {
      setCustomEmailLoading(false)
    }
  }

  async function handleUpdate(formData: FormData) {
    setUpdateLoading(true)
    try {
      setUpdateState(await sendUpdateAction(updateState, formData))
    } finally {
      setUpdateLoading(false)
    }
  }

  async function handleSms(formData: FormData) {
    setSmsLoading(true)
    try {
      setSmsState(await sendSmsBlastAction(smsState, formData))
    } finally {
      setSmsLoading(false)
    }
  }

  return (
    <section className="admin-comms" aria-labelledby="communications-heading">
      <header className="admin-comms-header">
        <div>
          <h2 id="communications-heading">Communications</h2>
          <p>Send targeted email updates or SMS to company representatives.</p>
        </div>
        <span className={`admin-comms-status ${smsConfigured ? 'is-ready' : 'is-unavailable'}`}>
          SMS {smsConfigured ? 'ready' : 'not configured'}
        </span>
      </header>

      <div className="admin-comms-grid">
        <section className="admin-comms-panel" aria-labelledby="custom-email-heading">
          <div className="admin-comms-panel-heading">
            <h3 id="custom-email-heading">Send an email</h3>
            <p>Write a direct message to one or more representatives.</p>
          </div>
          <form action={handleCustomEmail} className="admin-comms-form">
            <div className="admin-comms-fields">
              <Field label="Subject" htmlFor="custom-email-subject">
                <input id="custom-email-subject" name="subject" type="text" required />
              </Field>
              <RecipientFields
                idPrefix="custom-email"
                audience={emailAudience}
                onChange={setEmailAudience}
                companies={companies}
                representatives={representatives}
              />
            </div>
            <Field label="Message" htmlFor="custom-email-body">
              <textarea id="custom-email-body" name="body" rows={5} required />
            </Field>
            <button className="admin-comms-submit" type="submit" disabled={customEmailLoading}>
              {customEmailLoading ? 'Sending…' : 'Send email'}
            </button>
            <ActionMessage state={customEmailState} />
          </form>
        </section>

        <section className="admin-comms-panel" aria-labelledby="update-heading">
          <div className="admin-comms-panel-heading">
            <h3 id="update-heading">Send an update</h3>
            <p>Share a service announcement by email.</p>
          </div>
          <form action={handleUpdate} className="admin-comms-form">
            <div className="admin-comms-fields">
              <Field label="Title" htmlFor="update-title">
                <input id="update-title" name="title" type="text" required />
              </Field>
              <RecipientFields
                idPrefix="update"
                audience={updateAudience}
                onChange={setUpdateAudience}
                companies={companies}
                representatives={representatives}
              />
            </div>
            <Field label="Update message" htmlFor="update-content">
              <textarea id="update-content" name="content" rows={5} required />
            </Field>
            <label className="admin-comms-checkbox">
              <input id="update-is-important" name="isImportant" type="checkbox" />
              <span>
                <strong>Mark as important</strong>
                <span>Highlights the announcement in the email.</span>
              </span>
            </label>
            <button className="admin-comms-submit" type="submit" disabled={updateLoading}>
              {updateLoading ? 'Sending…' : 'Send update'}
            </button>
            <ActionMessage state={updateState} />
          </form>
        </section>

        <section className="admin-comms-panel admin-comms-sms" aria-labelledby="sms-heading">
          <div className="admin-comms-panel-heading">
            <h3 id="sms-heading">Send an SMS</h3>
            <p>Messages go to valid Kenyan numbers saved on representative profiles.</p>
          </div>
          {!smsConfigured ? (
            <p className="admin-comms-notice" role="status">{smsConfigurationHint}</p>
          ) : (
            <form action={handleSms} className="admin-comms-form">
              <RecipientFields
                idPrefix="sms"
                audience={smsAudience}
                onChange={setSmsAudience}
                companies={companies}
                representatives={representatives}
              />
              <Field label="SMS message" htmlFor="admin-sms-message">
                <textarea
                  id="admin-sms-message"
                  name="message"
                  rows={4}
                  maxLength={160}
                  required
                  aria-describedby="admin-sms-length"
                />
              </Field>
              <p id="admin-sms-length" className="admin-comms-help">
                Keep the message to 160 characters or fewer. SMS sending may incur provider charges.
              </p>
              <label className="admin-comms-checkbox admin-comms-confirm">
                <input name="confirmSend" type="checkbox" required />
                <span>
                  <strong>Confirm SMS send</strong>
                  <span>
                    I have checked the selected audience and confirm this message should be sent.
                  </span>
                </span>
              </label>
              <button className="admin-comms-submit" type="submit" disabled={smsLoading}>
                {smsLoading ? 'Sending…' : 'Send SMS'}
              </button>
              <ActionMessage state={smsState} />
            </form>
          )}
        </section>
      </div>
    </section>
  )
}

function RecipientFields({
  idPrefix,
  audience,
  onChange,
  companies,
  representatives,
}: {
  idPrefix: string
  audience: Audience
  onChange: (audience: Audience) => void
  companies: CompanyOption[]
  representatives: RepresentativeOption[]
}) {
  const visibleRepresentatives =
    audience.type === 'company' && audience.companyId
      ? representatives.filter((rep) => rep.company_id === audience.companyId)
      : representatives
  const selectedCount =
    audience.type === 'all'
      ? representatives.length
      : audience.type === 'company'
        ? visibleRepresentatives.length
        : audience.representativeIds.length

  function update(patch: Partial<Audience>) {
    onChange({ ...audience, ...patch })
  }

  return (
    <div className="admin-comms-recipient">
      <Field label="Recipients" htmlFor={`${idPrefix}-recipient-type`}>
        <select
          id={`${idPrefix}-recipient-type`}
          name="recipientType"
          value={audience.type}
          onChange={(event) =>
            update({
              type: event.currentTarget.value as RecipientType,
              representativeIds: [],
            })
          }
        >
          <option value="all">All representatives ({representatives.length})</option>
          <option value="company">One company</option>
          <option value="selected">Selected representatives</option>
        </select>
      </Field>

      {audience.type === 'company' ? (
        <Field label="Company" htmlFor={`${idPrefix}-company`}>
          <select
            id={`${idPrefix}-company`}
            name="companyId"
            value={audience.companyId}
            onChange={(event) =>
              update({ companyId: event.currentTarget.value, representativeIds: [] })
            }
            required
          >
            <option value="">Choose a company</option>
            {companies.map((company) => (
              <option value={company.id} key={company.id}>
                {company.name || company.domain} ({company.domain})
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {audience.type === 'selected' ? (
        <fieldset className="admin-recipient-list">
          <legend>Select representatives</legend>
          {visibleRepresentatives.length ? (
            visibleRepresentatives.map((representative) => (
              <label className="admin-recipient-option" key={representative.id}>
                <input
                  type="checkbox"
                  name="representativeIds"
                  value={representative.id}
                  checked={audience.representativeIds.includes(representative.id)}
                  onChange={(event) => {
                    const selected = new Set(audience.representativeIds)
                    if (event.currentTarget.checked) selected.add(representative.id)
                    else selected.delete(representative.id)
                    update({ representativeIds: Array.from(selected) })
                  }}
                />
                <span>
                  <strong>{representative.full_name || representative.email}</strong>
                  <span>{representative.email}</span>
                </span>
              </label>
            ))
          ) : (
            <p className="admin-comms-help">No representatives are available.</p>
          )}
        </fieldset>
      ) : null}

      <p className="admin-comms-help" aria-live="polite">
        {selectedCount} representative{selectedCount === 1 ? '' : 's'} in this audience.
      </p>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="admin-comms-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

function ActionMessage({
  state,
}: {
  state: { ok: boolean; message: string; sentCount?: number } | undefined
}) {
  if (!state) return null

  return (
    <p
      className={`admin-comms-result ${state.ok ? 'is-success' : 'is-error'}`}
      role={state.ok ? 'status' : 'alert'}
    >
      {state.message}
      {state.sentCount ? ` Sent to ${state.sentCount} recipient${state.sentCount === 1 ? '' : 's'}.` : ''}
    </p>
  )
}
