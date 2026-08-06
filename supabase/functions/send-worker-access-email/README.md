# send-worker-access-email Edge Function

Office-only secure send of a Worker **account access** (password reset) email for the **same Auth-linked person**.

## Guarantees

| Rule | Detail |
|------|--------|
| Same Worker | `drivers.id` unchanged |
| Same Auth user | `drivers.auth_user_id` unchanged — never create/rebind Auth |
| Send target | Server-resolved Auth email only — browser `expectedEmail` is confirmation |
| Company | Resolved from caller `company_members` only — browser `companyId` / `authUserId` ignored |
| Probe APIs | Never uses `generateLink`, `inviteUserByEmail`, `signUp`, or OTP |
| Concurrency | Atomic pending dispatch reservation under advisory lock |

## Auth

| Requirement | Detail |
|-------------|--------|
| Caller JWT | `Authorization: Bearer <user access token>` |
| Membership | Exactly one **active** `company_members` row |
| Role allowlist | Admin, Transport Manager, Supervisor, Planner, Office Staff |
| Target Worker | Same company, `archived_at is null`, `auth_user_id` set |
| Email sync | `drivers.email` must equal Auth user email |

## Request

`POST /functions/v1/send-worker-access-email`

```json
{
  "workerId": "uuid",
  "expectedEmail": "worker@example.com",
  "emailConfirmed": true
}
```

- `emailConfirmed` must be boolean `true`
- `expectedEmail` must match the **server** Auth/login email (confirmation only)
- Never send `companyId` or `authUserId`

## Reservation / send order

1. Resolve caller company + Office role; load target Worker
2. Load Auth user by `drivers.auth_user_id`
3. Require profile email == Auth email; require `expectedEmail` == Auth email
4. RPC `drevora_begin_worker_access_email_send`:
   - `pg_advisory_xact_lock` keyed by `driver_id`
   - expire pending rows older than **5 minutes**
   - reject live pending
   - reject successful send within **900 seconds**
   - insert one `pending` row in `worker_access_email_dispatches`
5. Anon client: `resetPasswordForEmail(authEmail, { redirectTo: 'https://app.drevora.app/reset-password' })`
6. On **accepted** send: RPC `drevora_finalize_worker_access_email_send`
   - `pending` → `sent`
   - write one `worker_identity_events` row (`access_email_sent`)
   - duplicate finalize is idempotent
7. On send failure: RPC `drevora_fail_worker_access_email_send`
   - `pending` → `failed`
   - **no** success audit
   - failed rows do **not** start the 900s cooldown

If the Edge Function crashes after begin, the pending reservation expires after 5 minutes and another send may proceed.

## Success

```json
{
  "ok": true,
  "code": "access_email_sent",
  "workerId": "uuid",
  "email": "worker@example.com",
  "cooldownSeconds": 900,
  "auditRecorded": true,
  "dispatchId": "uuid",
  "message": "Account access email sent."
}
```

## Errors

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHENTICATED` | 401 | Missing/invalid JWT |
| `FORBIDDEN` | 403 | Not Office / membership issue |
| `WORKER_NOT_FOUND` | 404 | Worker missing / wrong company |
| `WORKER_ARCHIVED` | 409 | Archived Worker |
| `WORKER_AUTH_NOT_LINKED` | 409 | No `drivers.auth_user_id` / Auth missing |
| `WORKER_LOGIN_EMAIL_OUT_OF_SYNC` | 409 | Profile email ≠ Auth email |
| `EMAIL_CONFIRMATION_MISMATCH` | 400 | `expectedEmail` / `emailConfirmed` mismatch |
| `ACCESS_EMAIL_RATE_LIMITED` | 429 | Cooldown active or pending reservation |
| `server_failure` | 500 | Unexpected / send rejected |

Never exposes service-role keys, SQL, stack traces, or raw internals.

`worker_access_email_dispatches` has **no** browser SELECT/INSERT/UPDATE/DELETE.

## Deploy (manual)

1. Apply `20260806240000_worker_access_email.sql`.
2. Deploy:

```bash
supabase functions deploy send-worker-access-email
```

Keep JWT verification enabled.

## Timings

| Setting | Value |
|---------|-------|
| Success cooldown | **900 seconds** (from `status=sent` only) |
| Pending TTL | **300 seconds** (stale pending → `expired`) |
