# User Roles and Permissions
[Back: Features](./01-Features.md) | [Next: System Flow](./03-System-Flow.md)

## Roles Found in Codebase
From `profiles.role` constraints and UI checks:
- `super_admin`
- `admin`

Student access is implemented as a **PIN-based operational mode** (`/StudentUse`) and not as a persisted `profiles.role`.

`Staff` role: **Not found in codebase; may be planned.**

## Permissions Matrix
| Module / Action | Super Admin | Admin | Student (PIN mode) |
|---|---|---|---|
| View items | Yes | Yes | Limited (active items via edge function) |
| Create/Edit items | Yes | Yes | No |
| Archive/Restore/Dispose items | Yes | Yes | No |
| Delete item permanently | Yes (through UI flow) | Yes (current UI allows delete action) | No |
| Use/Restock/Adjust via admin dialogs | Yes | Yes | No |
| Record usage in Student mode | N/A | N/A | Yes |
| View usage logs | Yes | Yes | No |
| Update PIN settings | Yes | Yes | No |
| Invite users (basic invite-user function) | Function exists | Function exists | No |
| Invite admin (restricted invite-admin function) | Yes | No | No |
| Admin Management page | Yes | No |
| MSDS upload/replace/remove | Yes | Yes | No |
| MSDS view/download | Yes | Yes | Yes (active authenticated users; app flow focuses admin/student mode) |
| View MSDS audit logs | Yes | Yes (policy allows select for admin/super_admin) | No |

## How Permissions Are Enforced
## Frontend Enforcement
- `Layout.jsx` shows/hides pages based on session and role checks.
- `AdminManagement` nav entry appears only for `super_admin`.
- Student mode is isolated in `StudentUse` page and uses PIN verification.
- MSDS management buttons are shown only for admin/super_admin profiles.

## Backend Enforcement (Primary)
- Supabase RLS policies restrict table access (`items`, `usage_logs`, `profiles`, `lab_settings`, `item_containers`, `inventory_transactions`, `msds_documents`, `msds_audit_logs`).
- Supabase edge functions check:
  - User JWT validity where required.
  - Role (`admin` / `super_admin`) for protected operations.
  - PIN validity for student usage flow.

## Notes
- Security-critical rules should always be treated as backend-owned (RLS + edge function checks), not frontend-only.
