'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { Button, CheckboxChip, Input, Select } from '@/components/ui'
import {
  COMPANY_SIZES,
  COUNTIES,
  INDUSTRIES,
  MAX_SECTORS,
  SECTORS,
  validateCompanyProfile,
  type CompanyProfile,
  type CompanyProfileErrors,
} from '@/lib/company-profile'

import { saveCompanyProfile } from './actions'

export function OnboardingForm({
  initial,
  initialCompanyName,
}: {
  initial: CompanyProfile
  initialCompanyName: string
}) {
  const formId = useId()
  const router = useRouter()
  const [values, setValues] = useState<CompanyProfile>(initial)
  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [fieldErrors, setFieldErrors] = useState<CompanyProfileErrors>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function clearError(field: keyof CompanyProfile) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function setField<K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) {
    setValues((current) => ({ ...current, [field]: value }))
    clearError(field)
  }

  function toggleSector(sector: string) {
    setValues((current) => {
      const selected = current.sectors_of_interest
      const next = selected.includes(sector)
        ? selected.filter((item) => item !== sector)
        : [...selected, sector]

      return { ...current, sectors_of_interest: next }
    })
    clearError('sectors_of_interest')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(undefined)

    const localErrors = validateCompanyProfile(values)

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      return
    }

    setFieldErrors({})
    setSaving(true)

    try {
      const result = await saveCompanyProfile(
        values,
        phoneNumber.trim() || null,
        companyName,
      )

      if (result.status === 'invalid') {
        setFieldErrors(result.fieldErrors)
        setSaving(false)
        return
      }

      if (result.status === 'error') {
        setFormError(result.message)
        setSaving(false)
        return
      }

      // Stay disabled through the navigation so the form cannot be sent twice.
      router.push('/dashboard')
    } catch {
      setFormError('Something went wrong saving that. Try again in a moment.')
      setSaving(false)
    }
  }

  const selectedCount = values.sectors_of_interest.length
  const sectorsHintId = `${formId}-sectors-hint`
  const sectorsErrorId = `${formId}-sectors-error`

  return (
    <form onSubmit={handleSubmit} noValidate className="auth-form">
      {formError ? (
        <div role="alert" className="form-message form-message-error">
          {formError}
        </div>
      ) : null}

      <Input
        id={`${formId}-company-name`}
        label="Company name"
        helperText="The name shown on your tender dashboard and bid documents."
        type="text"
        name="company_name"
        autoComplete="organization"
        value={companyName}
        onChange={(event) => setCompanyName(event.target.value)}
      />

      <Select
        id={`${formId}-industry`}
        label="Industry"
        name="industry"
        value={values.industry}
        onChange={(event) => setField('industry', event.target.value)}
        error={fieldErrors.industry}
      >
        <option value="">Select an industry</option>
        {INDUSTRIES.map((industry) => (
          <option key={industry} value={industry}>
            {industry}
          </option>
        ))}
      </Select>

      <fieldset
        aria-describedby={`${
          fieldErrors.sectors_of_interest ? `${sectorsErrorId} ` : ''
        }${sectorsHintId}`}
        aria-invalid={fieldErrors.sectors_of_interest ? true : undefined}
      >
        <legend className="ui-label">Sectors you want tenders for</legend>

        {fieldErrors.sectors_of_interest ? (
          <p id={sectorsErrorId} className="ui-error">
            {fieldErrors.sectors_of_interest}
          </p>
        ) : null}

        <p id={sectorsHintId} className="ui-helper">
          Pick between 1 and {MAX_SECTORS}. Narrower profiles match better than
          broad ones. Selected {selectedCount} of {MAX_SECTORS}.
        </p>

        <div className="checkbox-chip-grid">
          {SECTORS.map((sector) => {
            const checked = values.sectors_of_interest.includes(sector)
            const atLimit = !checked && selectedCount >= MAX_SECTORS

            return (
              <CheckboxChip
                key={sector}
                name="sectors_of_interest"
                value={sector}
                checked={checked}
                disabled={atLimit}
                onChange={() => toggleSector(sector)}
              >
                {sector}
              </CheckboxChip>
            )
          })}
        </div>
      </fieldset>

      <div className="form-two-column">
        <Select
          id={`${formId}-region`}
          label="County"
          helperText="Where the company is based. It weights local tenders higher."
          name="region"
          value={values.region}
          onChange={(event) => setField('region', event.target.value)}
          error={fieldErrors.region}
        >
          <option value="">Select a county</option>
          {COUNTIES.map((county) => (
            <option key={county} value={county}>
              {county}
            </option>
          ))}
        </Select>

        <Select
          id={`${formId}-company-size`}
          label="Company size"
          helperText="Used to skip tenders whose capacity requirements you could not meet."
          name="company_size"
          value={values.company_size}
          onChange={(event) => setField('company_size', event.target.value)}
          error={fieldErrors.company_size}
        >
          <option value="">Select a size</option>
          {COMPANY_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} people
            </option>
          ))}
        </Select>
      </div>

      <Input
        id={`${formId}-phone`}
        type="tel"
        name="phone_number"
        label="Phone number (optional)"
        helperText="Kenyan number (07XX or +2547XX). Used to send you an SMS when a new tender is matched. You can skip this and add it later."
        autoComplete="tel"
        placeholder="0712 345 678"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />

      <div>
        <Button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? 'Saving...' : 'Save and continue'}
        </Button>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          You can change any of this later. Nothing here is locked in.
        </p>
      </div>
    </form>
  )
}
