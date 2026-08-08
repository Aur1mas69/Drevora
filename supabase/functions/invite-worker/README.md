# invite-worker Edge Function

Office-created Worker invitations: Auth invite email + `company_members` (`Driver`) + `drivers` profile.

## Auth

| Requirement | Detail |
|-------------|--------|
| Caller JWT | `Authorization: Bearer <user access token>` |
| Membership | Exactly one **active** `company_members` row |
| Role allowlist | Admin, Transport Manager, Supervisor, Planner, Office Staff |
| Company ID | Resolved from membership only — browser `companyId` is ignored |

Workers (`company_members.role = Driver`) cannot invite.

## Flows

### New Auth user
1. Plan/allowance pre-check
2. `inviteUserByEmail(email, { redirectTo })` — **this sends the invite email**; sets `createdAuthUserThisRequest = true`
3. Atomic RPC `drevora_link_invited_worker`
4. On RPC success: `inviteSent: true` only when Supabase accepted the invite email API
5. On RPC failure: best-effort Auth cleanup (see below), then return the **original** linking error

### Existing Auth user
1. Plan/allowance pre-check (skipped for idempotent same-email active profile when at limit)
2. Resolve Auth user id via `generateLink` (**lookup only — never counted as email sent**; `createdAuthUserThisRequest = false`)
3. Reject if active membership exists in **another** company → `USER_ALREADY_LINKED_TO_ANOTHER_COMPANY` (no writes)
4. Atomic RPC link (same-company idempotent path allowed)
5. Send password email with anon client: `resetPasswordForEmail(email, { redirectTo })`
6. If link succeeded but recovery email failed → `ok: true`, `linkingSucceeded: true`, `inviteSent: false`, `emailDeliveryFailed: true`, code `*_email_failed`

### New Auth user cleanup after RPC failure

When `createdAuthUserThisRequest === true` and linking fails:

1. Re-query `company_members` for the Auth user (active + any)
2. Re-query active `drivers` rows for the invite email
3. Treat membership + same-company active profile as linked-profile evidence
4. Call `auth.admin.deleteUser(authUserId)` only when safe (no memberships, no linked evidence, queries succeeded)
5. `deleteUser` not-found → cleanup success (idempotent)
6. Always return the original linking `code` / `message` with cleanup metadata:

```json
{
  "ok": false,
  "code": "plan_limit_reached",
  "message": "...",
  "authCleanupAttempted": true,
  "authCleanupSucceeded": true,
  "authCleanupSkipped": false,
  "authCleanupError": null,
  "authCleanupSkipReason": null
}
```

Cleanup is **skipped** (no delete) when:
- Auth user was not created by this request
- Active or any membership exists
- Linked profile evidence exists
- Membership/profile safety queries fail

Never expose service-role keys or raw Auth internals in cleanup errors.

## Request

`POST /functions/v1/invite-worker`

```json
{
  "email": "worker@example.com",
  "firstName": "Sam",
  "lastName": "Worker",
  "operationalRole": "Driver",
  "status": "Off Duty",
  "phone": "",
  "employmentType": "Full-time"
}
```

`operationalRole` is stored on `public.drivers.role` (job role only:
Driver, Mechanic, Warehouse, Yardman, Cleaner, Other).  
Membership role is always `Driver` — this field never grants Office access.

## Success response

```json
{
  "ok": true,
  "code": "linked",
  "linkingSucceeded": true,
  "emailDeliveryFailed": false,
  "companyId": "...",
  "membershipRole": "Driver",
  "membershipId": "...",
  "driverId": "...",
  "workerCode": "A2B3C",
  "authUserId": "...",
  "inviteSent": true,
  "alreadyExisted": false,
  "redirectTo": "https://app.drevora.app/reset-password"
}
```

Linked but email failed (existing user):

```json
{
  "ok": true,
  "code": "linked_email_failed",
  "linkingSucceeded": true,
  "emailDeliveryFailed": true,
  "inviteSent": false,
  "alreadyExisted": true,
  "message": "Worker linking succeeded, but the password email could not be sent..."
}
```

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `unauthenticated` | 401 | Missing/invalid JWT |
| `forbidden` | 403 | Not Office / no membership |
| `invalid_email` | 400 | Email missing/invalid |
| `invalid_argument` | 400 | Names/status/fields invalid |
| `invalid_role` | 400 | Unknown operational role |
| `duplicate_worker` | 409 | Active Worker email already in company |
| `USER_ALREADY_LINKED_TO_ANOTHER_COMPANY` | 409 | Auth user active in another company |
| `email_conflict` | 409 | Auth user has non-Worker membership here |
| `plan_limit_reached` | 403 | Active Worker allowance full |
| `plan_allowance_unavailable` | 403 | No trusted plan limit |
| `subscription_expired` | 403 | Trial/subscription expired |
| `invite_send_failed` | 500 | Auth invite/lookup failed |
| `partial_link_failed` | 500 | Inconsistent link state |
| `server_misconfigured` | 500 | Missing env/keys |
| `server_failure` | 500 | Unexpected failure |

## Redirect URL

Uses `DREVORA_APP_ORIGIN` / `APP_ORIGIN` / `SITE_URL` when set, otherwise **`https://app.drevora.app`**.  
Path is always `/reset-password`. Localhost is **not** the default.

Recovery email uses anon-key `resetPasswordForEmail` (never service-role in the Auth email client).

## RPC guarantees

`drevora_link_invited_worker`:
- Verifies Office actor membership for the company
- Takes `pg_advisory_xact_lock(872014551, hashtext(auth_user_id))` before membership checks/writes
- Raises `USER_ALREADY_LINKED_TO_ANOTHER_COMPANY` if the Auth user is active elsewhere
- Atomically ensures `company_members.role = Driver` + active `drivers` row

## Deploy (manual)

1. Apply migration `20260805210000_worker_invitation_foundation.sql` on the Supabase project.
2. Set Edge secrets if needed: `DREVORA_APP_ORIGIN=https://app.drevora.app`
3. Deploy:

```bash
supabase functions deploy invite-worker
```

Keep JWT verification enabled.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- `company_members` writes remain service-role / RPC only.
- Plan allowance is enforced by `drevora_assert_company_can_add_worker` and the existing `drivers` insert trigger.
- Worker ID (`worker_code`) is generated by the existing `drivers_set_worker_code` trigger.
