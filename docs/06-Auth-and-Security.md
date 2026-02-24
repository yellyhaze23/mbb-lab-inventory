# Auth and Security
[Back: Database Schema](./05-Database-Schema.md) | [Next: API and Data Access](./07-API-and-Data-Access.md)

## Authentication Flow
- Primary auth uses **Supabase Auth**.
- Admin users sign in through `supabase.auth.signInWithPassword`.
- Invite + password setup flow:
  - invite functions send email invite links
  - invited users complete `/set-password`
- Session handling:
  - `AuthContext` checks current session
  - layout redirects unauthenticated users from protected pages

Student mode is separate:
- Students use a **Lab PIN** via edge functions (`verify-pin`, `student-use-item`) rather than normal admin session login.

## Password Rules
- `SetPassword` enforces minimum length of **8 characters**.
- `Settings` password update also enforces minimum 8 characters.

## RLS Overview
RLS is enabled on key tables:
- `profiles`
- `items`
- `usage_logs`
- `lab_settings`
- `item_containers`
- `inventory_transactions`
- `msds_documents`
- `msds_audit_logs`

Policy patterns:
- active authenticated users can read operational tables.
- admin/super_admin can mutate inventory and MSDS-related tables.
- super_admin has elevated actions in selected areas (e.g., admin management operations, some log mutation policies).

## Storage Security
- `avatars` bucket:
  - public read
  - user-owned write/update/delete based on folder path and `auth.uid()`
- `msds` bucket:
  - private
  - authenticated read
  - admin-only write/update/delete
  - MIME/type and size limits configured in migration

## Edge Function Security
- Functions use `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Protected functions parse and validate bearer JWTs.
- Role checks are performed against `profiles` where required.
- Student PIN functions implement brute-force throttling and delayed failure responses.

## Security Checklist (Current + Recommended)
## Implemented
- RLS on business tables.
- Role checks in edge functions.
- Signed URLs for private MSDS file access.
- PIN hashing (`bcrypt`) for verification.
- Idempotency support in stock operations (`usage_logs.idempotency_key`).

## Recommended hardening
- Remove plaintext-equivalent PIN persistence (`lab_pin_salt/current_pin` exposure path in current code).
- Restrict CORS origins from `*` to known frontend domains for production.
- Add centralised security logging and alerting for repeated PIN failures.
- Rotate service-role secrets and enforce strict secret management.

## Threat Notes
- SQL Injection: low risk in current query-builder/RPC usage (no raw SQL from untrusted input in frontend).
- XSS: React rendering protects by default; still validate/escape any future raw HTML features.
- Auth leakage: avoid exposing tokens in logs or local storage beyond intended scope.
- Insecure file access: mitigated by private bucket + short-lived signed URLs.

