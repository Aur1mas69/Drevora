import {
  companySettingsToFormValues,
  fetchCompanySettings,
  saveCompanySettings,
  updateCompanySettings,
} from '@/services/companySettingsService'
import type { CompanySettings, CompanySettingsInput } from '@/lib/companySettingsTypes'

/** @deprecated Use CompanySettings from companySettingsService */
export type Company = CompanySettings

/** @deprecated Use CompanySettingsInput */
export type CompanyInput = CompanySettingsInput

export const companiesService = {
  fetchCompany: fetchCompanySettings,
  saveCompany: saveCompanySettings,
  updateCompany: updateCompanySettings,
}

export { companySettingsToFormValues as companyToFormValues }
