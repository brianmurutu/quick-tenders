/**
 * Signup field definitions and validation, shared by the client form and the
 * server action so both enforce the same rules. The client copy is for fast
 * feedback; the server copy is the one that counts.
 *
 * Signup collects only what is needed to create the account. The matching
 * profile (industry, sectors, county, size) is collected at /onboarding, which
 * owns those columns; see lib/company-profile.ts.
 */

export const MIN_PASSWORD_LENGTH = 10

export type SignUpInput = {
  fullName: string
  email: string
  password: string
  companyName: string
}

export type SignUpField = keyof SignUpInput

export type SignUpFieldErrors = Partial<Record<SignUpField, string>>

export const EMPTY_SIGN_UP: SignUpInput = {
  fullName: '',
  email: '',
  password: '',
  companyName: '',
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

  return errors
}

/** Messages for the ?error= values the auth callback can redirect back with. */
export const CALLBACK_ERRORS: Record<string, string> = {
  missing_code:
    'That confirmation link was incomplete. Request a new one by signing up again.',
  confirmation_failed:
    'That confirmation link has expired or has already been used. Sign up again to get a new one.',
  domain_taken:
    'Somebody else registered your company domain while you were confirming. Ask them for access rather than signing up again.',
  not_company_domain:
    'That email provider cannot be used to register a company. Sign up with your company email address.',
  onboarding_failed:
    'Your email was confirmed, but we could not finish setting up the account. Get in touch and we will sort it out.',
}

/**
 * Parsed form of the jsonb returned by public.company_signup_status().
 *
 * The RPC returns loose json, so the keys are validated at runtime here rather
 * than being trusted from the type signature.
 */
export type SignupDomainStatus =
  | { status: 'available' }
  | { status: 'invalid' }
  | { status: 'not_company_domain' }
  | { status: 'join_existing'; companyName: string | null }
  | {
      status: 'representative_exists'
      companyName: string | null
      representativeName: string | null
      representativeEmail: string
    }

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/** Returns null when the payload is not a shape we recognise. */
export function parseSignupStatus(raw: unknown): SignupDomainStatus | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const object = raw as Record<string, unknown>

  switch (object.status) {
    case 'available':
    case 'invalid':
    case 'not_company_domain':
      return { status: object.status }

    case 'join_existing':
      return {
        status: 'join_existing',
        companyName: nonEmptyString(object.company_name),
      }

    case 'representative_exists': {
      const representativeEmail = nonEmptyString(object.representative_email)

      // Without somebody to name, the block message would be useless, so treat
      // this as unrecognised rather than rendering a dangling sentence.
      if (!representativeEmail) return null

      return {
        status: 'representative_exists',
        companyName: nonEmptyString(object.company_name),
        representativeName: nonEmptyString(object.representative_name),
        representativeEmail,
      }
    }

    default:
      return null
  }
}

/** The message shown when a colleague already holds the company account. */
export function companyExistsMessage(
  blocked: Extract<SignupDomainStatus, { status: 'representative_exists' }>,
): string {
  const who = blocked.representativeName
    ? `${blocked.representativeName} (${blocked.representativeEmail})`
    : blocked.representativeEmail

  return `Your company already has an account. Ask ${who} for access.`
}
