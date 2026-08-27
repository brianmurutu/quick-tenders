'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

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

export function OnboardingForm({ initial }: { initial: CompanyProfile }) {
  const formId = useId()
  const router = useRouter()
  const [values, setValues] = useState<CompanyProfile>(initial)
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
      const result = await saveCompanyProfile(values, phoneNumber.trim() || null)

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
    <form onSubmit={handleSubmit} noValidate className="space-y-10">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
        >
          {formError}
        </div>
      ) : null}

      <Field id={`${formId}-industry`} label="Industry" error={fieldErrors.industry}>
        {(props) => (
          <select
            {...props}
            name="industry"
            value={values.industry}
            onChange={(event) => setField('industry', event.target.value)}
          >
            <option value="">Select an industry</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset
        aria-describedby={`${
          fieldErrors.sectors_of_interest ? `${sectorsErrorId} ` : ''
        }${sectorsHintId}`}
        aria-invalid={fieldErrors.sectors_of_interest ? true : undefined}
      >
        <legend className="text-sm font-semibold text-slate-900">
          Sectors you want tenders for
        </legend>

        {fieldErrors.sectors_of_interest ? (
          <p id={sectorsErrorId} className="mt-2 text-sm font-medium text-red-700">
            {fieldErrors.sectors_of_interest}
          </p>
        ) : null}

        <p id={sectorsHintId} className="mt-2 text-sm leading-relaxed text-slate-500">
          Pick between 1 and {MAX_SECTORS}. Narrower profiles match better than
          broad ones. Selected {selectedCount} of {MAX_SECTORS}.
        </p>

        <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {SECTORS.map((sector) => {
            const checked = values.sectors_of_interest.includes(sector)
            const atLimit = !checked && selectedCount >= MAX_SECTORS

            return (
              <label
                key={sector}
                className={`flex cursor-pointer items-start gap-3 text-sm ${
                  atLimit ? 'cursor-not-allowed text-slate-400' : 'text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  name="sectors_of_interest"
                  value={sector}
                  checked={checked}
                  disabled={atLimit}
                  onChange={() => toggleSector(sector)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed"
                />
                <span>{sector}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field
          id={`${formId}-region`}
          label="County"
          hint="Where the company is based. It weights local tenders higher."
          error={fieldErrors.region}
        >
          {(props) => (
            <select
              {...props}
              name="region"
              value={values.region}
              onChange={(event) => setField('region', event.target.value)}
            >
              <option value="">Select a county</option>
              {COUNTIES.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          id={`${formId}-company-size`}
          label="Company size"
          hint="Used to skip tenders whose capacity requirements you could not meet."
          error={fieldErrors.company_size}
        >
          {(props) => (
            <select
              {...props}
              name="company_size"
              value={values.company_size}
              onChange={(event) => setField('company_size', event.target.value)}
            >
              <option value="">Select a size</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} people
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div>
        <label
          htmlFor={`${formId}-phone`}
          className="block text-sm font-semibold text-slate-900"
        >
          Phone number{' '}
          <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Kenyan number (07XX or +2547XX). Used to send you an SMS when a new tender
          is matched. You can skip this and add it later.
        </p>
        <div className="mt-2">
          <input
            id={`${formId}-phone`}
            type="tel"
            name="phone_number"
            autoComplete="tel"
            placeholder="0712 345 678"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors focus:border-blue-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
        >
          {saving ? 'Saving...' : 'Save and continue'}
        </button>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          You can change any of this later. Nothing here is locked in.
        </p>
      </div>
    </form>
  )
}

const controlClasses =
  'w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors focus:border-blue-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700'

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: (props: {
    id: string
    className: string
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
  }) => React.ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>

      <div className="mt-2">
        {children({
          id,
          className: error
            ? `${controlClasses} border-red-400 focus:border-red-500 focus:outline-red-500`
            : controlClasses,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
        })}
      </div>

      {error ? (
        <p id={errorId} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {hint ? (
        <p id={hintId} className="mt-2 text-sm leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
