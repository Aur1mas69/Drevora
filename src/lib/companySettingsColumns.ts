/**
 * public.companies columns used by Company Settings.
 * Kept in sync with supabase/migrations and schema.sql — do not guess names.
 */
export const COMPANY_SETTINGS_COLUMNS = [
  'id',
  'created_at',
  'name',
  'logo_url',
  'address',
  'city',
  'country',
  'postcode',
  'timezone',
  'weather_location',
  'date_format',
  'time_format',
  'week_starts_on',
  'fleet_number_prefix',
  'default_vehicle_status',
  'default_driver_role',
  'default_break_minutes',
  'paid_breaks',
  'allow_medical_document_uploads',
  'overtime_after_hours',
  'overtime_mode',
  'overtime_calculation_method',
  'overtime_multiplier',
  'weekly_overtime_after_hours',
  'currency',
  'round_time_minutes',
  'require_manager_approval',
  'holiday_year_start',
  'annual_leave_allowance',
  'theme',
  'compact_tables',
  'email_notifications',
  'push_notifications',
  'session_timeout_minutes',
  'require_mfa',
  'saturday_overtime_enabled',
  'saturday_overtime_after_hours',
  'saturday_overtime_multiplier',
  'saturday_use_company_default_break',
  'sunday_overtime_enabled',
  'sunday_overtime_after_hours',
  'sunday_overtime_multiplier',
  'sunday_use_company_default_break',
  'timesheet_week_start_day',
  'timesheet_week_reset_month',
  'timesheet_week_reset_day',
  'holiday_counting_method',
  'holiday_working_days',
  'holiday_entitlement_rules',
  'consumable_default_prices',
] as const

export type CompanySettingsColumn = (typeof COMPANY_SETTINGS_COLUMNS)[number]

/** Core settings columns — safe to select even when weekend overtime migration is pending. */
export const COMPANY_SETTINGS_CORE_COLUMNS = [
  'id',
  'created_at',
  'name',
  'logo_url',
  'address',
  'city',
  'country',
  'postcode',
  'timezone',
  'weather_location',
  'date_format',
  'time_format',
  'week_starts_on',
  'fleet_number_prefix',
  'default_vehicle_status',
  'default_driver_role',
  'default_break_minutes',
  'paid_breaks',
  'overtime_after_hours',
  'overtime_mode',
  'overtime_multiplier',
  'currency',
  'round_time_minutes',
  'require_manager_approval',
  'holiday_year_start',
  'annual_leave_allowance',
  'theme',
  'compact_tables',
  'email_notifications',
  'push_notifications',
  'session_timeout_minutes',
  'require_mfa',
] as const

/** Weekend overtime columns — optional until migration is applied. */
export const COMPANY_SETTINGS_WEEKEND_COLUMNS = [
  'saturday_overtime_enabled',
  'saturday_overtime_after_hours',
  'saturday_overtime_multiplier',
  'saturday_guaranteed_paid_hours',
  'saturday_use_company_default_break',
  'sunday_overtime_enabled',
  'sunday_overtime_after_hours',
  'sunday_overtime_multiplier',
  'sunday_guaranteed_paid_hours',
  'sunday_use_company_default_break',
] as const

/** Timesheet week numbering columns — optional until migration is applied. */
export const COMPANY_SETTINGS_WEEK_NUMBERING_COLUMNS = [
  'timesheet_week_start_day',
  'timesheet_week_reset_month',
  'timesheet_week_reset_day',
] as const

/** Medical document upload toggle — optional until migration is applied. */
export const COMPANY_SETTINGS_MEDICAL_UPLOAD_COLUMNS = [
  'allow_medical_document_uploads',
] as const

/** Holiday counting columns — optional until migration is applied. */
export const COMPANY_SETTINGS_HOLIDAY_COUNTING_COLUMNS = [
  'holiday_counting_method',
  'holiday_working_days',
  'holiday_entitlement_rules',
] as const

/** PostgREST select list — must stay a string literal for Supabase client typing. */
export const companySettingsCoreSelect = `
  id,
  created_at,
  name,
  logo_url,
  address,
  city,
  country,
  postcode,
  timezone,
  weather_location,
  date_format,
  time_format,
  week_starts_on,
  fleet_number_prefix,
  default_vehicle_status,
  default_driver_role,
  default_break_minutes,
  paid_breaks,
  overtime_after_hours,
  overtime_mode,
  overtime_multiplier,
  currency,
  round_time_minutes,
  require_manager_approval,
  holiday_year_start,
  annual_leave_allowance,
  theme,
  compact_tables,
  email_notifications,
  push_notifications,
  session_timeout_minutes,
  require_mfa
` as const

export const companySettingsWeekendSelect = `
  saturday_overtime_enabled,
  saturday_overtime_after_hours,
  saturday_overtime_multiplier,
  saturday_guaranteed_paid_hours,
  saturday_use_company_default_break,
  sunday_overtime_enabled,
  sunday_overtime_after_hours,
  sunday_overtime_multiplier,
  sunday_guaranteed_paid_hours,
  sunday_use_company_default_break
` as const

export const companySettingsWeekNumberingSelect = `
  timesheet_week_start_day,
  timesheet_week_reset_month,
  timesheet_week_reset_day
` as const

export const companySettingsHolidayCountingSelect = `
  holiday_counting_method,
  holiday_working_days,
  holiday_entitlement_rules
` as const

export const companySettingsMedicalUploadSelect = `
  allow_medical_document_uploads
` as const

export const companySettingsConsumablePricesSelect = `
  consumable_default_prices
` as const

/** OT calculation method + weekly threshold — optional until migration is applied. */
export const COMPANY_SETTINGS_OVERTIME_CALCULATION_COLUMNS = [
  'overtime_calculation_method',
  'weekly_overtime_after_hours',
] as const

export const companySettingsOvertimeCalculationSelect = `
  overtime_calculation_method,
  weekly_overtime_after_hours
` as const

/**
 * Full Company Settings select.
 * Newer optional columns (weekend default-break toggles, consumable prices,
 * overtime calculation method) are merged via dedicated optional selects so a
 * missing column does not 400 this query.
 * Subscription plan columns are loaded separately by companyPlanService.
 */
export const companySettingsSelect = `
  id,
  created_at,
  name,
  logo_url,
  address,
  city,
  country,
  postcode,
  timezone,
  weather_location,
  date_format,
  time_format,
  week_starts_on,
  fleet_number_prefix,
  default_vehicle_status,
  default_driver_role,
  default_break_minutes,
  paid_breaks,
  allow_medical_document_uploads,
  overtime_after_hours,
  overtime_mode,
  overtime_multiplier,
  currency,
  round_time_minutes,
  require_manager_approval,
  holiday_year_start,
  annual_leave_allowance,
  theme,
  compact_tables,
  email_notifications,
  push_notifications,
  session_timeout_minutes,
  require_mfa,
  saturday_overtime_enabled,
  saturday_overtime_after_hours,
  saturday_overtime_multiplier,
  saturday_guaranteed_paid_hours,
  sunday_overtime_enabled,
  sunday_overtime_after_hours,
  sunday_overtime_multiplier,
  sunday_guaranteed_paid_hours,
  timesheet_week_start_day,
  timesheet_week_reset_month,
  timesheet_week_reset_day,
  holiday_counting_method,
  holiday_working_days,
  holiday_entitlement_rules
` as const
