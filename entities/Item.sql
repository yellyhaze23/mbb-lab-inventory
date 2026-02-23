{
  "name": "Item",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Item name"
    },
    "category": {
      "type": "string",
      "enum": [
        "chemical",
        "consumable"
      ],
      "description": "Item category"
    },
    "quantity": {
      "type": "number",
      "default": 0,
      "description": "Current quantity in stock"
    },
    "unit": {
      "type": "string",
      "description": "Unit of measurement (e.g., mL, g, pcs)"
    },
    "room_area": {
      "type": "string",
      "description": "Room or area where item is stored"
    },
    "storage_type": {
      "type": "string",
      "description": "Type of storage (Shelf, Cabinet, etc.)"
    },
    "storage_number": {
      "type": "string",
      "description": "Storage unit number"
    },
    "position": {
      "type": "string",
      "description": "Position within storage (Top, Middle, Bottom)"
    },
    "project_fund_source": {
      "type": "string",
      "description": "Project or fund source for the item"
    },
    "expiration_date": {
      "type": "string",
      "format": "date",
      "description": "Expiration date (optional)"
    },
    "minimum_stock": {
      "type": "number",
      "default": 0,
      "description": "Minimum stock level for alerts"
    },
    "qr_code_value": {
      "type": "string",
      "description": "Unique QR code identifier (legacy)"
    },
    "description": {
      "type": "string",
      "description": "Additional notes about the item"
    },
    "supplier": {
      "type": "string",
      "description": "Supplier name"
    },
    "status": {
      "type": "string",
      "enum": [
        "active",
        "archived",
        "disposed"
      ],
      "default": "active",
      "description": "Item status"
    },
    "date_received": {
      "type": "string",
      "format": "date",
      "description": "Date the item was received"
    },
    "lot_number": {
      "type": "string",
      "description": "Lot/batch number"
    },
    "opened_date": {
      "type": "string",
      "format": "date",
      "description": "Date the item was first opened"
    },
    "disposed_at": {
      "type": "string",
      "format": "date-time",
      "description": "Date and time when item was disposed"
    },
    "disposed_reason": {
      "type": "string",
      "description": "Reason for disposal"
    },
    "disposed_by_id": {
      "type": "string",
      "description": "ID of user who disposed the item"
    }
  },
  "required": [
    "name",
    "category",
    "quantity",
    "unit",
    "room_area",
    "storage_type",
    "status"
  ]
}