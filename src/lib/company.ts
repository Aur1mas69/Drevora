export function formatCompanyDisplayLocation(
  city: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const cityValue = city?.trim()
  const countryValue = country?.trim()

  if (!cityValue || !countryValue) return null
  return `${cityValue}, ${countryValue}`
}

const COMPANY_NAME_FALLBACK = 'Company profile incomplete'

type CompanyNameSource = {
  name?: string | null
  company_name?: string | null
  organisation_name?: string | null
}

/** Resolve company name from the real DB column(s), preferring `name`. */
export function resolveCompanyName(source: CompanyNameSource): string | null {
  for (const value of [source.name, source.company_name, source.organisation_name]) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

export function getCompanyDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed || COMPANY_NAME_FALLBACK
}

export function hasCompanyDisplayName(name: string | null | undefined): boolean {
  return Boolean(name?.trim())
}
