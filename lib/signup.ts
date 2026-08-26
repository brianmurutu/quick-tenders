/**
 * Signup field definitions and validation, shared by the client form and the
 * server action so both enforce the same rules. The client copy is for fast
 * feedback; the server copy is the one that counts.
 */

export const INDUSTRIES = [
  'Construction',
  'Civil engineering',
  'Facilities management',
  'IT and software',
  'Professional services',
  'Healthcare',
  'Logistics and transport',
  'Manufacturing',
  'Security services',
  'Other',
] as const

export const REGIONS = [
  'Local',
  'Regional',
  'National',
  'International',
] as const

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
] as const

export const MIN_PASSWORD_LENGTH = 10

export type SignUpInput = {
  fullName: string
  email: string
  password: string
  companyName: string
  industry: string
  region: string
  companySize: string
}

export type SignUpField = keyof SignUpInput

export type SignUpFieldErrors = Partial<Record<SignUpField, string>>

export const EMPTY_SIGN_UP: SignUpInput = {
  fullName: '',
  email: '',
  password: '',
  companyName: '',
  industry: '',
  region: '',
  companySize: '',
}

/** Lowercased domain part of an email address, mirroring the SQL helper. */
export function emailDomain(email: string): string | null {
  const parts = email.trim().toLowerCase().split('@')

  if (parts.length !== 2) return null

  const domain = parts[1]

  return domain.includes('.') ? domain : null
}

export function validateSignUp(input: SignUpInput): SignUpFieldErrors {
  const errors: SignUpFieldErrors = {}

  if (!input.fullName.trim()) {
    errors.fullName = 'Enter your name.'
  }

  if (!input.email.trim()) {
    errors.email = 'Enter your company email address.'
  } else if (!emailDomain(input.email)) {
    errors.email = 'That does not look like an email address.'
  }

  if (!input.password) {
    errors.password = 'Choose a password.'
  } else if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }

  if (!input.companyName.trim()) {
    errors.companyName = 'Enter your company name.'
  }

  if (!INDUSTRIES.includes(input.industry as (typeof INDUSTRIES)[number])) {
    errors.industry = 'Pick an industry.'
  }

  if (!REGIONS.includes(input.region as (typeof REGIONS)[number])) {
    errors.region = 'Pick where you bid.'
  }

  if (!COMPANY_SIZES.includes(input.companySize as (typeof COMPANY_SIZES)[number])) {
    errors.companySize = 'Pick a company size.'
  }

  return errors
}

/** Messages for the ?error= values the auth callback can redirect back with. */
export const CALLBACK_ERRORS: Record<string, string> = {
  missing_code:
    'That confirmation link was incomplete. Request a new one by signing up again.',
  confirmation_failed:
    'That confirmation link has expired or has already been used. Sign up again to get a new one.',
  domain_taken:
    'An account already exists for your company domain. Ask the colleague who set it up for access.',
  not_company_domain:
    'That email provider cannot be used to register a company. Sign up with your company email address.',
  onboarding_failed:
    'Your email was confirmed, but we could not finish setting up the account. Get in touch and we will sort it out.',
}
