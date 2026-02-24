# API and Data Access
[Back: Auth and Security](./06-Auth-and-Security.md) | [Next: Inventory Logic](./08-Inventory-Logic.md)

## Data Access Layers
## Frontend service modules
- `src/api/itemsDataClient.js`
- `src/api/usageLogsDataClient.js`
- `src/api/profilesDataClient.js`
- `src/api/msdsService.ts`

## Edge function caller
- `src/lib/edgeClient.js` (`invokeEdgeFunction`)
- Adds `apikey`, optional bearer token, and JSON payload.

## Edge Functions (`supabase/functions/*`)

## `verify-pin`
- Purpose: validate student Lab PIN.
- Input JSON:
```json
{ "pin": "123456" }
```
- Output (success):
```json
{ "valid": true, "expires_at": null }
```
- Used by: `src/pages/StudentUse.jsx`.

## `student-use-item`
- Purpose: record student usage with PIN validation.
- Input JSON:
```json
{
  "pin": "123456",
  "item_id": "uuid",
  "quantity": 1,
  "deduct_mode": "CONTENT",
  "student_name": "Juan Dela Cruz",
  "student_id": "2026-001",
  "experiment": "PCR Lab",
  "notes": "Optional"
}
```
- Output (success):
```json
{ "success": true, "idempotency_key": "key", "result": { } }
```
- Used by: `src/pages/StudentUse.jsx`.

## `student-items`
- Purpose: return active items for student mode (with pack stats).
- Input JSON:
```json
{ "query": "ethanol", "item_id": "optional-uuid" }
```
- Output:
```json
{ "items": [ ... ] }
```
- Used by: `src/pages/StudentUse.jsx`.

## `get-lab-settings`
- Purpose: load PIN settings for authorised admins.
- Input JSON: `{}`.
- Output:
```json
{
  "settings": {
    "id": "uuid",
    "pin_expires_at": null,
    "pin_updated_by": "uuid",
    "updated_at": "...",
    "has_pin": true,
    "current_pin": "******"
  }
}
```
- Used by: `src/pages/Settings.jsx`.

## `set-lab-pin`
- Purpose: update lab PIN and expiry.
- Input JSON:
```json
{
  "pin": "123456",
  "pin_expires_at": "2026-12-31T23:59:59.000Z",
  "pin_updated_by": "uuid"
}
```
- Output:
```json
{ "success": true, "settings": { ... } }
```
- Used by: `src/pages/Settings.jsx`.

## `invite-admin`
- Purpose: super-admin invite flow for admin users.
- Input JSON: `{ "email": "name@example.com" }`
- Output: `{ "success": true, "message": "Invitation sent successfully" }`
- Used by: `src/pages/AdminManagement.jsx`.

## `invite-user`
- Purpose: generic invite function (present in repo).
- Input JSON: `{ "email": "name@example.com" }`
- Output: `{ "success": true, "user": { ... } }`
- Frontend call: **Not found in current pages; may be planned/legacy.**

## `msds-signed-url`
- Purpose: create short-lived signed URL for MSDS view/download and log audit action.
- Input JSON:
```json
{ "msds_id": "uuid", "mode": "view" }
```
- Output:
```json
{
  "msds_id": "uuid",
  "mode": "view",
  "signed_url": "https://...",
  "expires_in": 180
}
```
- Used by: `src/api/msdsService.ts` in Chemicals MSDS actions.

## RPC Functions Used
- `rpc_safe_use_item`
- `rpc_restock_item`
- `rpc_adjust_item_stock`
- `rpc_dispose_item`
- `use_deduct_item` (tracking-aware deduct for current model)

Invoked from:
- `src/components/inventory/inventoryHelpers.jsx`

## Data Contracts (Key Objects)

## `Item`
Key fields:
- identity: `id`, `name`, `category`
- stock canonical: `quantity`, `unit`
- tracking: `tracking_type`, `quantity_value`, `quantity_unit`, `unit_type`, `total_units`, `content_per_unit`, `content_label`, `total_content`
- location: `room_area`, `storage_type`, `storage_number`, `position`
- state: `status`, `minimum_stock`, `expiration_date`, `opened_date`
- compliance: `lot_number`, `supplier`, `project_fund_source`
- MSDS: `msds_current_id`, `msds_current`

## `UsageLog`
Key fields:
- `id`, `item_id`, `item_name`, `item_type`
- `action`, `quantity_used`, `unit`
- `before_quantity`, `after_quantity`
- `used_by_name`, `used_by_id`
- `source`, `notes`, `created_at`

## `Profile`
Key fields:
- `id`, `email`, `full_name`
- `role`, `is_active`
- `avatar_url`

## `StockLot/Batch` Equivalent (`item_containers`)
Key fields:
- `id`, `item_id`
- `status` (`SEALED` / `OPENED`)
- `sealed_count`
- `opened_content_remaining`
- `created_at`

## `Transaction` (`inventory_transactions`)
Key fields:
- `id`, `item_id`, `action`
- `delta_measure`, `measure_unit`
- `delta_units`, `delta_content`
- `notes`, `user_id`, `created_at`

## `MSDSDocument`
Key fields:
- `id`, `chemical_id`, `version`
- `title`, `supplier`, `revision_date`, `language`
- `file_path`, `file_name`, `file_size`, `file_hash`
- `uploaded_by`, `uploaded_at`, `is_active`
