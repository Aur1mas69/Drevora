export const COMPANY_UPDATED_EVENT = 'drevora:company-updated'

export function dispatchCompanyUpdated(): void {
  window.dispatchEvent(new Event(COMPANY_UPDATED_EVENT))
}
