export function formatCompanyDisplayLocation(
  city: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const cityValue = city?.trim()
  const countryValue = country?.trim()

  if (!cityValue || !countryValue) return null
  return `${cityValue}, ${countryValue}`
}
