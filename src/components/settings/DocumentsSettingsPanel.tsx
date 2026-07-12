import {
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/SettingsControls'
import type { CompanySettingsInput } from '@/lib/companySettingsTypes'

type DocumentsSettingsPanelProps = {
  form: CompanySettingsInput
  onChange: (patch: Partial<CompanySettingsInput>) => void
}

export function DocumentsSettingsPanel({ form, onChange }: DocumentsSettingsPanelProps) {
  return (
    <SettingsSection
      title="Worker Compliance"
      description="Controls for optional worker document retention and compliance tracking."
    >
      <SettingsToggle
        label="Allow medical document uploads"
        description="Medical documents may contain special-category personal data. Enable this only when your company has a lawful reason to retain copies."
        checked={form.allowMedicalDocumentUploads}
        onChange={(checked) => onChange({ allowMedicalDocumentUploads: checked })}
      />
    </SettingsSection>
  )
}
