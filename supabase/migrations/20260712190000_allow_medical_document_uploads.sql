-- Optional medical document uploads (D4 / Medical Certificate).
-- Default OFF for all companies. Does not change drivers.medical_expiry.

alter table public.companies
  add column if not exists allow_medical_document_uploads boolean not null default false;

notify pgrst, 'reload schema';
