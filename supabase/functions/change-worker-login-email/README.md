# change-worker-login-email Edge Function

Office-only secure change of an existing Worker's **login email** for the **same person**.

## Guarantees

| Rule | Detail |
|------|--------|
| Same Worker | `drivers.id` unchanged |
| Same Auth user | `drivers.auth_user_id` unchanged — never create/rebind Auth |
| History | Timesheets, holidays, checks, documents keep the same Worker id |
| Company | Resolved from caller `company_members` only — browser `companyId` / `authUserId` ignored |

## Auth

| Requirement | Detail |
|-------------|--------|
| Caller JWT | `Authorization: Bearer <user access token>` |
| Membership | Exactly one **active** `company_members` row |
| Role allowlist | Admin, Transport Manager, Supervisor, Planner, Office Staff |
| Target Worker | Same company, `archived_at is null`, `auth_user_id` set |

## Request

`POST /functions/v1/change-worker-login-email`

```json
{
  "workerId": "uuid",
  "newEmail": "new.worker@example.com",
  "reason": "Corrected typo in company email",
  "samePersonConfirmed": true
}
```

- `samePersonConfirmed` must be boolean `true`
- `reason` must be non-empty after trim
- `newEmail` is trimmed + lowercased

## Update order

1. Resolve caller company + Office role; load target Worker
2. Validate email / uniqueness (active Worker + other Auth users)
3. `auth.admin.updateUserById(auth_user_id, { email, email_confirm: true })` — **same Auth UUID**
4. RPC `drevora_finalize_worker_login_email_change` — atomic `drivers.email` + `worker_identity_events` (`login_email_changed`)
5. If step 4 fails after step 3: restore old Auth email; return original mapped error + rollback metadata

## Success

```json
{
  "ok": true,
  "code": "login_email_changed",
  "changed": true,
  "workerId": "...",
  "authUserId": "...",
  "email": "new.worker@example.com",
  "oldEmail": "old.worker@example.com",
  "authEmailUpdated": true,
  "authRollbackAttempted": false,
  "authRollbackSucceeded": false,
  "authRollbackSkipped": true,
  "authRollbackError": null
}
```

Idempotent same email:

```json
{
  "ok": true,
  "code": "already_same_email",
  "changed": false
}
```

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHENTICATED` | 401 | Missing/invalid JWT |
| `FORBIDDEN` | 403 | Not Office / membership issue |
| `WORKER_NOT_FOUND` | 404 | Worker missing / wrong company |
| `WORKER_ARCHIVED` | 409 | Archived Worker |
| `WORKER_AUTH_NOT_LINKED` | 409 | No `drivers.auth_user_id` |
| `EMAIL_ALREADY_IN_USE` | 409 | Active Worker or other Auth user owns email |
| `SAME_PERSON_CONFIRMATION_REQUIRED` | 400 | `samePersonConfirmed` not true |
| `INVALID_EMAIL` | 400 | Invalid email |
| `WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED` | 409 | Auth UUID mismatch / rebind attempt |
| `WORKER_LOGIN_EMAIL_CHANGE_REQUIRED` | 409 | Direct client email edit blocked (DB) |
| `server_failure` | 500 | Unexpected / misconfigured |

Never exposes service-role keys, SQL, stack traces, or raw internals.

## Direct email edit protection

Linked Workers (`auth_user_id` set): trigger `drivers_login_email_guard` raises `WORKER_LOGIN_EMAIL_CHANGE_REQUIRED` when `email` changes without transaction flag `drevora.allow_worker_login_email_change=on` (set only by the finalize RPC).

Unchanged email on ordinary Worker profile edits does not fail.

## Deploy (manual)

1. Preflight: confirm `drivers.auth_user_id` + `worker_identity_events` exist (identity foundation applied).
2. Apply `20260806220000_worker_login_email_change.sql`.
3. Deploy:

```bash
supabase functions deploy change-worker-login-email
```

Keep JWT verification enabled.
