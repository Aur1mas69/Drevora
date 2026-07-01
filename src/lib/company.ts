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

export function getCompanyDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed || COMPANY_NAME_FALLBACK
}

export function hasCompanyDisplayName(name: string | null | undefined): boolean {
  return Boolean(name?.trim())
}
