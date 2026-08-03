# delete-account Edge Function

Worker and Office/Admin account deletion with a **30-day** delayed anonymisation / Auth delete.

## Actions

| Action | Auth | Purpose |
|--------|------|---------|
| `request` | Caller JWT (`Authorization: Bearer …`) | Schedule deletion, deactivate membership, send email |
| `process_due` | Header `x-drevora-account-deletion-cron-secret` **only** | Process pending rows where `scheduled_for <= now()` |
| `cancel` | Header `x-drevora-account-deletion-cron-secret` **only** | Support-assisted cancel of a **pending** request |

A normal authenticated Worker/Admin JWT **cannot** call `process_due` or `cancel`. Those actions reject requests that lack a valid cron secret (401), even if a user Bearer token is also present.

### Worker `request`
- Requires a single Driver membership linked by email to a Worker profile
- Deactivates membership, archives the Worker profile, `role_context = worker`

### Office/Admin `request`
- Requires a single office membership (Admin, Transport Manager, Supervisor, Planner, Office Staff)
- **Sole-Admin protection:** if the caller is the only active Admin in the company, reject with `sole_admin`
- Deactivates **only** the caller’s membership
- Does **not** archive Workers, close the company, or change billing/operational records
- `role_context = office`, `driver_id = null`

## Deploy (later — do not run automatically from this task)

```bash
supabase functions deploy delete-account
```

Ensure JWT verification remains enabled for normal `request` calls.
`process_due` and `cancel` authenticate via the cron secret header (not a user JWT).
When JWT verify is on, cron callers must also send a Bearer token (e.g. anon key) **plus** the cron secret.

## Secrets / env

| Name | Required | Notes |
|------|----------|-------|
| `SUPABASE_URL` | yes | Usually provided by platform |
| `SUPABASE_ANON_KEY` | yes | User JWT verification for `request` |
| `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS.default` | yes | Privileged DB + Auth admin |
| `RESEND_API_KEY` | yes (for email) | Never expose to frontend |
| `DREVORA_ACCOUNT_EMAIL_FROM` | recommended | e.g. `DREVORA <no-reply@notify.drevora.uk>` |
| `DREVORA_SUPPORT_EMAIL_FROM` | fallback from | Used if account-from unset |
| `DREVORA_ACCOUNT_DELETION_CRON_SECRET` | yes for `process_due` / `cancel` | Long random secret |

## Scheduled invocation (later)

Run hourly or daily — **not configured in this task**.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/delete-account" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-drevora-account-deletion-cron-secret: $DREVORA_ACCOUNT_DELETION_CRON_SECRET" \
  -d '{"action":"process_due"}'
```

`process_due` handles both `worker` and `office` pending rows. Worker rows anonymise the linked profile; office rows only complete membership revoke + Auth delete. Company and operational data are preserved. Auth user is deleted last.

## Support cancellation (secure)

DREVORA support (or another organisation Admin via support) cancels a pending deletion **only** with the cron secret (never from the self-serve app).

1. Look up the row in `account_deletion_requests` (status must be `pending`).
2. Invoke:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/delete-account" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "x-drevora-account-deletion-cron-secret: $DREVORA_ACCOUNT_DELETION_CRON_SECRET" \
  -d '{"action":"cancel","requestId":"<uuid>"}'
```

3. Behaviour:
   - marks request `cancelled` + `cancelled_at`
   - reactivates the same `company_members` row
   - unarchives the Worker profile **only** for `role_context = worker`
   - does **not** restore deleted avatar/support files
   - sends cancellation confirmation email when Auth email is available
   - idempotent if already `cancelled`

## Safety

- No hard-delete of Vehicle Checks, Timesheets, Holidays, Reports, Consumables, or legal acceptances.
- No “Close company” in this flow.
- Client cannot INSERT/UPDATE/DELETE `account_deletion_requests` (SELECT own only).
- Pending/processing deletion is a dedicated app access state (not onboarding/unlinked).
