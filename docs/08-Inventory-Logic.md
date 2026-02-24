# Inventory Logic
[Back: API and Data Access](./07-API-and-Data-Access.md) | [Next: Deployment](./09-Deployment.md)

This section documents the actual stock logic implemented in migrations, RPCs, and frontend helpers.

## Item Categories
- `chemical`
- `consumable`

Both categories use the same `items` table and tracking model.

## Tracking Types
## 1) `SIMPLE_MEASURE`
- Example units: `g`, `mg`, `mL`, `L`.
- Main fields: `quantity_value`, `quantity_unit`.
- `quantity`/`unit` are synchronised for compatibility.

## 2) `UNIT_ONLY`
- Example units: `box`, `pack`, `bag`, `bottle`.
- Main fields: `total_units`, `unit_type`.
- Requires whole-number unit operations.

## 3) `PACK_WITH_CONTENT`
- Supports “container with content” scenarios (e.g., **12 bags x 100 pcs**).
- Main fields:
  - `total_units` (number of containers)
  - `content_per_unit` (content per container)
  - `content_label` (e.g., pcs, tubes)
  - `total_content` (aggregate usable content)
- Container state is persisted in `item_containers`:
  - one `SEALED` row with `sealed_count`
  - zero or more `OPENED` rows with `opened_content_remaining`

## Per-Bag / Per-Container Concept
Example:
- `total_units = 12` bags
- `content_per_unit = 100` pcs
- `total_content = 1200` pcs

If user deducts by content, the system may open a sealed bag and convert part of stock to opened state.

## Deduct Logic
Implemented mainly in `use_deduct_item` RPC.

## For `SIMPLE_MEASURE`
- Deducts numeric amount from `quantity_value`.
- Prevents negative stock.
- Updates usage logs and inventory transactions.

## For `UNIT_ONLY`
- Deduct amount must be integer.
- Deducts from `total_units`.
- Prevents negative stock.

## For `PACK_WITH_CONTENT`
Two modes:
- `UNITS`: deduct full sealed packs only.
- `CONTENT`: deduct partial/full content units.

### `CONTENT` mode behaviour
- Consume from existing opened containers first.
- If insufficient, open a sealed container (decrement sealed count).
- Track remaining content in opened container rows.
- If opened container reaches zero, it is removed and unit counters are adjusted.
- Prevents overspending beyond `total_content`.

## Status Handling
Item-level status:
- `active`
- `archived`
- `disposed`

Additional operational flags:
- `opened_date` for non-pack items (set on first manual use when previously unopened).
- Pack state handled via `item_containers` (sealed/opened split).

`empty` status flag: **Not found as a dedicated status value in codebase**. Zero stock is inferred from quantity values.

## Expiry and FEFO/FIFO
- Expiry date is stored and used for filtering, warnings, and badges.
- FEFO/FIFO consumption ordering by expiry/batch:
  - **Not found as an explicit deduct algorithm in current RPCs**.
  - Pack `CONTENT` mode processes opened containers by creation order.

## Negative Stock Prevention
- All deduct RPC paths validate available stock before update.
- DB check constraints enforce non-negative and shape-valid values for core fields.

## Edge Cases Covered
- Reject non-integer unit deductions in `UNIT_ONLY` and pack unit mode.
- Reject invalid `deduct_mode`.
- Reject use of `archived` or `disposed` items.
- Support items without expiry dates.
- Validate pack items must have positive `content_per_unit`.

## Worked Examples
## Example A: Unit-only
- Item: gloves box (`UNIT_ONLY`)
- `total_units = 10`
- Deduct `3` units
- Result: `total_units = 7`

## Example B: Pack with content
- Item: microtubes (`PACK_WITH_CONTENT`)
- `sealed_count = 5`, opened rows: one row with `20 pcs remaining`
- `content_per_unit = 100`
- Deduct `40 pcs` in `CONTENT` mode:
  - consume 20 from opened row (row emptied, removed)
  - open 1 sealed pack (sealed becomes 4)
  - consume 20 from newly opened pack (80 remains opened)
  - total content decreases by 40

