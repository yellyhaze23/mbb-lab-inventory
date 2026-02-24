# Features
[Back: Overview](./00-Overview.md) | [Next: User Roles and Permissions](./02-User-Roles-and-Permissions.md)

## Inventory Management
- Create, update, archive, restore, dispose, and permanently delete items.
- Separate modules for **Chemicals** and **Consumables**.
- Structured storage location fields: room, storage type, number, position.
- Multi-mode tracking:
  - `SIMPLE_MEASURE` (e.g., g, mL)
  - `UNIT_ONLY` (e.g., box, bottle)
  - `PACK_WITH_CONTENT` (e.g., packs with per-pack content)
- Low-stock threshold management (`minimum_stock`).
- Expiry date, lot/batch, supplier, project/fund source, and notes support.

## Stock Operations
- Use/Deduct
- Restock
- Adjust stock
- Dispose flow with reason/notes
- Automatic logs for stock-changing actions.

## Sealed/Opened Tracking
- For pack-based items:
  - Tracks sealed container count
  - Tracks opened containers and remaining content
  - Supports deduction by full units or by content

## Usage Logs and Auditing
- Usage logs page with filters, sorting, and pagination.
- Action types include use, restock, adjust, and dispose.
- Metadata includes before/after quantities, actor info, notes, and source.

## MSDS (Chemical Safety Document) Support
- Optional MSDS per chemical.
- Versioned MSDS records with current pointer.
- In-app view/download via short-lived signed URLs.
- MSDS history modal with set-current/archive actions.
- MSDS audit logs for upload, replace, remove, view, and download.

## User and Access Management
- Admin account login.
- Invite admin users by email.
- Set-password flow for invited users.
- Super Admin-only admin management page.

## Student Mode
- PIN-gated Student Use page.
- Search and select active items.
- Record usage without full admin login.
- PIN verification with brute-force protection in edge functions.

## Reports and Dashboard
- Dashboard cards and latest activity panels.
- Reports module for top-used, low-stock, expired/expiring items.
- CSV export support in inventory/report contexts.

## UX and Performance Features
- Debounced search on inventory and student pages.
- Loading skeletons and fetch indicators.
- Responsive layout with sidebar + mobile patterns.
- Client-side pagination UI for large tables.

