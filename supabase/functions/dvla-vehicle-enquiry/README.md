# dvla-vehicle-enquiry

Office Add/Edit Vehicle → DVLA Vehicle Enquiry Service (VES) lookup.

## Security

- Authenticated Supabase user (Bearer JWT)
- Active Office membership (Admin / Manager / Office / Supervisor + legacy Office roles)
- AAL2 via `requireCallerAal2` (after Office role check)
- Drivers/Workers rejected
- Never trusts `companyId`, `role`, `aal`, `mode`, `endpoint`, or API key from the request body

## Server secrets (Supabase Edge Function secrets)

| Name | Purpose |
|------|---------|
| `DVLA_VES_MODE` | `disabled` \| `uat` \| `production` |
| `DVLA_VES_UAT_API_KEY` | Used when mode is `uat` |
| `DVLA_VES_API_KEY` | Used when mode is `production` |

Also requires standard Supabase function env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and service-role / secret key.

## Endpoints

- UAT: `https://uat.driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`
- Production: `https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`

## Frontend UX flag (not security)

`VITE_DVLA_LOOKUP_ENABLED=true` shows **Check DVLA**. When false/missing, UI shows **DVLA Soon**.

Even if the UI is bypassed, `DVLA_VES_MODE=disabled` blocks upstream calls.

## Request

```json
{ "registrationNumber": "AA19 AAA" }
```

## Success response

```json
{
  "ok": true,
  "vehicle": {
    "registrationNumber": "AA19AAA",
    "make": "…",
    "yearOfManufacture": 2019,
    "motStatus": "…",
    "motExpiryDate": "YYYY-MM-DD",
    "taxStatus": "…",
    "taxDueDate": "YYYY-MM-DD",
    "colour": "…",
    "fuelType": "…",
    "revenueWeight": 0,
    "wheelplan": "…",
    "typeApproval": "…",
    "euroStatus": "…",
    "engineCapacity": 0
  }
}
```

## Deploy later (manual)

```bash
supabase secrets set DVLA_VES_MODE=uat
supabase secrets set DVLA_VES_UAT_API_KEY=<uat-key>
supabase functions deploy dvla-vehicle-enquiry
```

Lock after UAT testing:

```bash
supabase secrets set DVLA_VES_MODE=disabled
```

Production activation (when production key arrives — no code change):

```bash
supabase secrets set DVLA_VES_API_KEY=<production-key>
supabase secrets set DVLA_VES_MODE=production
```

Also set host env `VITE_DVLA_LOOKUP_ENABLED=true` for the UI button.
