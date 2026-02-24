# System Flow
[Back: Roles and Permissions](./02-User-Roles-and-Permissions.md) | [Next: Architecture](./04-Architecture.md)

## 1) Admin Login to Inventory Operations
1. Admin opens Login page and signs in using email + password.
2. App checks Supabase session and loads profile.
3. Admin navigates to Dashboard/Chemicals/Consumables.
4. Admin adds a new item using `ItemForm`.
5. Stock lifecycle actions are performed through dialogs:
   - Use/Deduct
   - Restock
   - Adjust
   - Dispose
6. Each action updates stock via RPC/database calls and writes usage logs/transactions.
7. Changes are reflected in inventory tables, usage logs, and reports.

## 2) Invite Admin User to Set Password
1. Super Admin opens Admin Management.
2. Super Admin submits invite email.
3. `invite-admin` edge function validates requester role (`super_admin` only).
4. Supabase sends invite link to email.
5. Invitee opens `/set-password`.
6. Invitee sets password (minimum 8 characters).
7. Account metadata is updated with `password_set: true`.

## 3) Student PIN Journey
1. Student opens `/StudentUse`.
2. Student enters lab PIN.
3. `verify-pin` edge function validates PIN and brute-force limits.
4. If valid, session-like local state is created (temporary local session).
5. Student searches active items via `student-items` edge function.
6. Student selects item and records usage.
7. `student-use-item` validates PIN again and executes stock deduction logic.
8. Usage result is returned and reflected in subsequent queries.

## 4) MSDS Journey (Chemical)
1. Admin opens Chemicals page.
2. Admin uploads or replaces MSDS (PDF) for a chemical.
3. System creates new `msds_documents` version.
4. PDF is uploaded to private `msds` bucket path.
5. Chemical `msds_current_id` is updated to newest version.
6. Audit log entry is stored (`UPLOAD` or `REPLACE`).
7. View/Download requests call `msds-signed-url` edge function, which:
   - validates user and role/access
   - generates short-lived signed URL
   - logs `VIEW` or `DOWNLOAD`

## Sequence Snapshot (Admin Deduct)
```text
Admin UI -> Supabase RPC (use_deduct_item / rpc_safe_use_item)
        -> DB row lock on item
        -> quantity/container updates
        -> usage_logs + inventory_transactions inserts
        -> response to UI
```

