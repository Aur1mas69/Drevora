alter table public.drivers
  add column if not exists driver_card_expiry date,
  add column if not exists medical_expiry date,
  add column if not exists adr_expiry date,
  add column if not exists hiab_expiry date;
