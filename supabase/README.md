# Supabase Step 1 (Dashboard-Only Guide)

Use this guide if you want to do everything directly in Supabase Dashboard (no CLI required).

Project URL:

- `https://nmpuiaigqxkqypxqxkvg.supabase.co`

---

## 1) Run migration SQL in Dashboard

1. Open Supabase Dashboard for your project.
2. Go to `SQL Editor`.
3. Open local file:
   - `supabase/migrations/20260217130000_inventory_foundation.sql`
4. Copy all SQL.
5. Paste into SQL Editor and click `Run`.

If your project already ran this migration before February 18, 2026, also run:

6. Open local file:
   - `supabase/migrations/20260218100000_allow_delete_items_preserve_usage_logs.sql`
7. Copy all SQL.
8. Paste into SQL Editor and click `Run`.

This creates:

- tables: `profiles`, `items`, `usage_logs`, `lab_settings`
- indexes + constraints (including unique `usage_logs.idempotency_key`)
- RLS policies
- triggers:
  - `updated_at` triggers
  - auto-create profile on `auth.users` insert (`first user => super_admin`)
- RPCs:
  - `rpc_safe_use_item`
  - `rpc_restock_item`
  - `rpc_adjust_item_stock`
  - `rpc_dispose_item`

---

## 2) Set Edge Function secrets in Dashboard

1. Go to `Project Settings` -> `Edge Functions` -> `Secrets`.
2. Add:
   - `SUPABASE_URL = https://nmpuiaigqxkqypxqxkvg.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY = <your service_role key>`

Important:

- `service_role` key is from `Project Settings` -> `API`.
- Do not use anon key for `SUPABASE_SERVICE_ROLE_KEY`.

---

## 3) Deploy Edge Functions from Dashboard

For each function below, go to `Edge Functions` -> `Create function` (or edit existing), paste the full `index.ts`, then deploy.

1. `verify-pin`
   - source: `supabase/functions/verify-pin/index.ts`

2. `student-use-item`
   - source: `supabase/functions/student-use-item/index.ts`

Important:

- These files are now **self-contained** (no `../_shared/*` imports), so Dashboard deploy will bundle correctly.

---

## 4) Create/update lab PIN hash (SQL Editor)

Run this in `SQL Editor` to set PIN `123456` (change value):

```sql
with up as (
  update public.lab_settings
  set
    lab_pin_hash = crypt('123456', gen_salt('bf')),
    pin_expires_at = null
  where singleton = true
  returning id
)
insert into public.lab_settings (singleton, lab_name, lab_pin_hash, pin_expires_at)
select true, 'Lab', crypt('123456', gen_salt('bf')), null
where not exists (select 1 from up);
```

---

## 5) Test RPCs (curl)

Use service role key for testing:

```bash
export SUPABASE_URL="https://nmpuiaigqxkqypxqxkvg.supabase.co"
export SERVICE_KEY="<service-role-key>"
```

### rpc_safe_use_item

```bash
curl -i "$SUPABASE_URL/rest/v1/rpc/rpc_safe_use_item" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_item_id": "00000000-0000-0000-0000-000000000000",
    "p_quantity_to_use": 1,
    "p_used_by_name": "Test User",
    "p_source": "manual",
    "p_idempotency_key": "test-safe-use-1"
  }'
```

### rpc_restock_item

```bash
curl -i "$SUPABASE_URL/rest/v1/rpc/rpc_restock_item" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_item_id": "00000000-0000-0000-0000-000000000000",
    "p_quantity_to_add": 5,
    "p_used_by_name": "Test User",
    "p_idempotency_key": "test-restock-1"
  }'
```

### rpc_adjust_item_stock

```bash
curl -i "$SUPABASE_URL/rest/v1/rpc/rpc_adjust_item_stock" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_item_id": "00000000-0000-0000-0000-000000000000",
    "p_new_quantity": 10,
    "p_used_by_name": "Test User",
    "p_idempotency_key": "test-adjust-1"
  }'
```

### rpc_dispose_item

```bash
curl -i "$SUPABASE_URL/rest/v1/rpc/rpc_dispose_item" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_item_id": "00000000-0000-0000-0000-000000000000",
    "p_used_by_name": "Test User",
    "p_reason": "Expired",
    "p_notes": "Test disposal",
    "p_idempotency_key": "test-dispose-1"
  }'
```

---

## 6) Test Edge Functions (curl)

### verify-pin

```bash
curl -i "https://nmpuiaigqxkqypxqxkvg.supabase.co/functions/v1/verify-pin" \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456"}'
```

### student-use-item

```bash
curl -i "https://nmpuiaigqxkqypxqxkvg.supabase.co/functions/v1/student-use-item" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: student-use-test-1" \
  -d '{
    "pin": "123456",
    "item_id": "00000000-0000-0000-0000-000000000000",
    "quantity": 1,
    "student_name": "Student Tester",
    "student_id": "2026001",
    "experiment": "Lab A",
    "notes": "Test usage"
  }'
```

---

## 7) Frontend env (for later wiring)

When you start frontend integration, set:

- `VITE_SUPABASE_URL=https://nmpuiaigqxkqypxqxkvg.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<your anon key>`

---

## Security notes

- PIN validation is server-side only via Edge Functions.
- `lab_pin_hash` / `lab_pin_salt` are protected from normal client reads.
- `usage_logs.idempotency_key` is unique to prevent duplicate writes.
---

## 8) Additional Edge Functions for full migration

Deploy these additional functions from local files (same process as Step 3):

- `student-items`
  - source: `supabase/functions/student-items/index.ts`
- `get-lab-settings`
  - source: `supabase/functions/get-lab-settings/index.ts`
- `set-lab-pin`
  - source: `supabase/functions/set-lab-pin/index.ts`
- `invite-user`
  - source: `supabase/functions/invite-user/index.ts`

### Quick test: get-lab-settings

```bash
curl -i "https://nmpuiaigqxkqypxqxkvg.supabase.co/functions/v1/get-lab-settings" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Quick test: set-lab-pin

```bash
curl -i "https://nmpuiaigqxkqypxqxkvg.supabase.co/functions/v1/set-lab-pin" \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "123456",
    "pin_expires_at": null,
    "pin_updated_by": null
  }'
```

### Quick test: student-items

```bash
curl -i "https://nmpuiaigqxkqypxqxkvg.supabase.co/functions/v1/student-items" \
  -H "Content-Type: application/json" \
  -d '{"query":"ethanol"}'
```

### Quick test: invite-user

```bash
curl -i "https://nmpuiaigqxkqypxqxkvg.supabase.co/functions/v1/invite-user" \
  -H "Content-Type: application/json" \
  -d '{"email":"new-admin@example.com"}'
```

Notes:

- These functions require `SUPABASE_SERVICE_ROLE_KEY` secret set in Edge Functions settings.
- `set-lab-pin` stores only hash in DB, never plaintext PIN.
- `student-items` is now the student page item source (no direct Base44 reads).

---

## 9) PowerShell Edge Function Tests (copy-paste ready)

Set variables first:

```powershell
$PROJECT_URL = "https://nmpuiaigqxkqypxqxkvg.supabase.co"
$ANON_KEY = "<your-anon-key>"
```

Use `curl.exe` (not `curl`) and include both auth headers for every Edge Function:

### get-lab-settings

```powershell
curl.exe -i "$PROJECT_URL/functions/v1/get-lab-settings" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $ANON_KEY" `
  -d "{}"
```

### set-lab-pin

```powershell
curl.exe -i "$PROJECT_URL/functions/v1/set-lab-pin" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $ANON_KEY" `
  -d '{"pin":"123456","pin_expires_at":null,"pin_updated_by":null}'
```

### student-items

```powershell
curl.exe -i "$PROJECT_URL/functions/v1/student-items" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $ANON_KEY" `
  -d '{"query":"ethanol"}'
```

### invite-user

```powershell
curl.exe -i "$PROJECT_URL/functions/v1/invite-user" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $ANON_KEY" `
  -d '{"email":"new-admin@example.com"}'
```

### verify-pin

```powershell
curl.exe -i "$PROJECT_URL/functions/v1/verify-pin" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $ANON_KEY" `
  -d '{"pin":"123456"}'
```

### student-use-item

```powershell
curl.exe -i "$PROJECT_URL/functions/v1/student-use-item" `
  -H "Content-Type: application/json" `
  -H "apikey: $ANON_KEY" `
  -H "Authorization: Bearer $ANON_KEY" `
  -H "x-idempotency-key: student-use-test-1" `
  -d '{"pin":"123456","item_id":"00000000-0000-0000-0000-000000000000","quantity":1,"student_name":"Student Tester","student_id":"2026001","experiment":"Lab A","notes":"Test usage"}'
```

## Edge Auth Header Rules

- Always send `apikey: <VITE_SUPABASE_ANON_KEY>` when calling Edge Functions from the frontend.
- Send `Authorization: Bearer <access_token>` only when there is an authenticated user session token.
- Do not send anon/service keys as Bearer tokens.

Why:
- Anon and service_role values are API keys, not user JWTs. Passing them as Bearer can cause `401 Invalid JWT`.
- Public functions (`verify-pin`, `student-use-item`, optional `public-search-items`) can run without user Authorization.
- Admin functions (`get-lab-settings`, `set-lab-pin`) require a valid logged-in user JWT.
