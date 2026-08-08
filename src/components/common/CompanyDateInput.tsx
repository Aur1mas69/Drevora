/**
 * Shared company-aware date input for Admin filters and forms.
 *
 * Native `<input type="date">` follows the browser/OS locale and cannot honor
 * Regional → Date Format (DD/MM/YYYY vs MM/DD/YYYY). This component displays
 * dates via formatDateFromIso / company settings while keeping values as
 * ISO YYYY-MM-DD for filters and storage.
 */
export {
  HolidayDateInput as CompanyDateInput,
} from '@/components/holidays/HolidayDateInput'
export {
  HolidayDatePickerGroup as CompanyDatePickerGroup,
} from '@/components/holidays/HolidayDatePickerGroup'
