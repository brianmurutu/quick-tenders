/**
 * Company matching profile: the reference lists and validation behind the
 * onboarding form.
 *
 * Field names deliberately match the `companies` columns exactly
 * (`industry`, `sectors_of_interest`, `region`, `company_size`) rather than
 * being camel cased, because this object is what the tender matching agent will
 * read back out of the table. One name for one thing, from form to column.
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
  'Agriculture and agribusiness',
  'Security services',
  'Energy and utilities',
  'Education and training',
  'Other',
] as const

/**
 * Tender categories, kept close to how public procurement notices are worded so
 * that matching has something concrete to work against.
 */
export const SECTORS = [
  'Agriculture and agribusiness',
  'Building and construction',
  'Roads and civil works',
  'Water and sanitation',
  'Energy and power',
  'ICT and software',
  'Telecommunications',
  'Healthcare and medical supplies',
  'Pharmaceuticals',
  'Education and training',
  'Transport and logistics',
  'Security services',
  'Cleaning and fumigation',
  'Catering and food supply',
  'Office supplies and stationery',
  'Furniture and fittings',
  'Motor vehicles and spare parts',
  'Machinery and equipment',
  'Consultancy and professional services',
  'Financial and insurance services',
  'Printing and branding',
  'Environmental and waste management',
  'Textiles and uniforms',
  'Real estate and property management',
] as const

/**
 * The 47 counties, in the order of the First Schedule to the Constitution of
 * Kenya. Official names are used, since tender notices are published against
 * them: "Nairobi City" rather than "Nairobi", "Taita-Taveta" rather than
 * "Taita Taveta".
 */
export const COUNTIES = [
  'Mombasa',
  'Kwale',
  'Kilifi',
  'Tana River',
  'Lamu',
  'Taita-Taveta',
  'Garissa',
  'Wajir',
  'Mandera',
  'Marsabit',
  'Isiolo',
  'Meru',
  'Tharaka-Nithi',
  'Embu',
  'Kitui',
  'Machakos',
  'Makueni',
  'Nyandarua',
  'Nyeri',
  'Kirinyaga',
  "Murang'a",
  'Kiambu',
  'Turkana',
  'West Pokot',
  'Samburu',
  'Trans Nzoia',
  'Uasin Gishu',
  'Elgeyo-Marakwet',
  'Nandi',
  'Baringo',
  'Laikipia',
  'Nakuru',
  'Narok',
  'Kajiado',
  'Kericho',
  'Bomet',
  'Kakamega',
  'Vihiga',
  'Bungoma',
  'Busia',
  'Siaya',
  'Kisumu',
  'Homa Bay',
  'Migori',
  'Kisii',
  'Nyamira',
  'Nairobi City',
] as const

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
] as const

export const MAX_SECTORS = 8

/** Keys match the companies columns one for one. */
export type CompanyProfile = {
  industry: string
  sectors_of_interest: string[]
  region: string
  company_size: string
}

export type CompanyProfileField = keyof CompanyProfile

export type CompanyProfileErrors = Partial<Record<CompanyProfileField, string>>

export const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  industry: '',
  sectors_of_interest: [],
  region: '',
  company_size: '',
}

function isOneOf(list: readonly string[], value: string): boolean {
  return list.includes(value)
}

export function validateCompanyProfile(profile: CompanyProfile): CompanyProfileErrors {
  const errors: CompanyProfileErrors = {}

  if (!isOneOf(INDUSTRIES, profile.industry)) {
    errors.industry = 'Pick the industry that describes your company.'
  }

  if (profile.sectors_of_interest.length === 0) {
    errors.sectors_of_interest = 'Pick at least one sector you want tenders for.'
  } else if (profile.sectors_of_interest.length > MAX_SECTORS) {
    errors.sectors_of_interest = `Pick at most ${MAX_SECTORS} sectors, so matching stays sharp.`
  } else if (
    profile.sectors_of_interest.some((sector) => !isOneOf(SECTORS, sector))
  ) {
    errors.sectors_of_interest = 'One of those sectors is not on the list.'
  } else if (
    new Set(profile.sectors_of_interest).size !== profile.sectors_of_interest.length
  ) {
    errors.sectors_of_interest = 'That list has a sector in it twice.'
  }

  if (!isOneOf(COUNTIES, profile.region)) {
    errors.region = 'Pick the county you are based in.'
  }

  if (!isOneOf(COMPANY_SIZES, profile.company_size)) {
    errors.company_size = 'Pick a company size.'
  }

  return errors
}
