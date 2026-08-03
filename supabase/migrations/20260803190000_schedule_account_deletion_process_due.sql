-- Schedule hourly processing of due account-deletion requests via Edge Function.
--
-- Idempotent. Secrets are NOT stored here — they must already exist in Vault:
--   drevora_project_url
--   drevora_anon_jwt
--   drevora_account_deletion_cron_secret
--
-- Enable pg_cron if needed; pg_net + supabase_vault are expected to already be installed.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema net;
create extension if not exists supabase_vault with schema vault;

-- Replace any prior job with the same name (idempotent re-apply).
do $$
declare
  existing_jobid bigint;
begin
  select j.jobid
    into existing_jobid
  from cron.job j
  where j.jobname = 'drevora-process-account-deletions'
  limit 1;

  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end
$$;

select cron.schedule(
  'drevora-process-account-deletions',
  '17 * * * *',
  $cron$
  select
    net.http_post(
      url := (
        select trimmed
        from (
          select nullif(btrim(decrypted_secret), '') as trimmed
          from vault.decrypted_secrets
          where name = 'drevora_project_url'
          limit 1
        ) s
      ) || '/functions/v1/delete-account',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization',
          'Bearer ' || (
            select trimmed
            from (
              select nullif(btrim(decrypted_secret), '') as trimmed
              from vault.decrypted_secrets
              where name = 'drevora_anon_jwt'
              limit 1
            ) s
          ),
        'apikey',
          (
            select trimmed
            from (
              select nullif(btrim(decrypted_secret), '') as trimmed
              from vault.decrypted_secrets
              where name = 'drevora_anon_jwt'
              limit 1
            ) s
          ),
        'x-drevora-account-deletion-cron-secret',
          (
            select trimmed
            from (
              select nullif(btrim(decrypted_secret), '') as trimmed
              from vault.decrypted_secrets
              where name = 'drevora_account_deletion_cron_secret'
              limit 1
            ) s
          )
      ),
      body := '{"action":"process_due"}'::jsonb
    ) as request_id;
  $cron$
);
