# invite-office-user

Office-created Office-user invitations: Auth invite email + `company_members` (Admin / Manager / Office / Supervisor).

**Never creates a `drivers` row.** Worker invite (`invite-worker`) is unchanged.

## Auth & tenancy

| Check | Rule |
|-------|------|
| Caller | Authenticated JWT |
| Company | Exactly one **active** `company_members` row for caller (server-side) |
| Actor role | Office access: Admin / Manager / Office / Supervisor (+ legacy Transport Manager / Planner / Office Staff) |
| Browser IDs | `companyId` / `userId` ignored if sent |
| Target role | **Only** Admin / Manager / Office / Supervisor — never Driver |

## Request

```json
{
  "email": "office.user@example.com",
  "role": "Manager",
  "fullName": "Sam Office"
}
```

`role` is stored distinctly on `company_members.role` (never collapsed to Admin).

## Auth invitation flow

1. Always try `inviteUserByEmail` first (with `redirectTo = {appOrigin}/reset-password`).
2. **New user:** invite succeeds → use returned Auth user id; mark `createdAuthUserThisRequest = true` for orphan cleanup if membership linking later fails.
3. **Existing user:** invite returns a genuine already-registered error → resolve Auth user id with **read-only** `admin.auth.admin.listUsers` pagination (normalized email match). Never uses `generateLink`, magiclink, recovery link generation, OTP, or `signUp` as an existence probe.
4. RPC `drevora_link_invited_office_user` creates/reactivates `company_members` only.
5. For existing Auth users, after successful link: `resetPasswordForEmail` for account access.
6. Audit row written to `office_user_invitation_events`.

## Duplicate / conflict

| Case | Result |
|------|--------|
| Active membership in another company | `409 USER_ALREADY_LINKED_TO_ANOTHER_COMPANY` |
| Active Driver / non-Office membership in same company | `409 email_conflict` |
| Active Office membership in same company | `200 already_linked` (existing role kept) |
| Inactive membership in same company | Reactivate with invited role |
| Unique violation | `409 duplicate_membership` |

## Audit

Table `office_user_invitation_events`: company, invited email, invited role, actor, auth user, membership, status, created_at.

Statuses: `linked`, `already_linked`, `link_failed`, `invite_send_failed`, `email_failed`.

## Deploy

1. Apply migrations:
   - `20260808140000_mvp_system_membership_roles.sql`
   - `20260808150000_office_user_invitation_foundation.sql`
2. `supabase functions deploy invite-office-user`

Required secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEYS.default`).
Optional: `DREVORA_APP_ORIGIN` / `APP_ORIGIN` / `SITE_URL` (default `https://app.drevora.app`).
