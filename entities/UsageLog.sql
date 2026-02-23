{
  "name": "UsageLog",
  "type": "object",
  "properties": {
    "item_id": {
      "type": "string",
      "description": "Reference to the item"
    },
    "item_name": {
      "type": "string",
      "description": "Item name at time of usage"
    },
    "item_type": {
      "type": "string",
      "enum": [
        "chemical",
        "consumable"
      ],
      "description": "Type of item used"
    },
    "quantity_used": {
      "type": "number",
      "description": "Amount used (positive for use/adjust down, negative for restock)"
    },
    "unit": {
      "type": "string",
      "description": "Unit of measurement"
    },
    "used_by_name": {
      "type": "string",
      "description": "Name of user who performed the action"
    },
    "used_by_id": {
      "type": "string",
      "description": "Stable user identifier"
    },
    "notes": {
      "type": "string",
      "description": "Additional notes"
    },
    "before_quantity": {
      "type": "number",
      "description": "Quantity before the action"
    },
    "after_quantity": {
      "type": "number",
      "description": "Quantity after the action"
    },
    "action": {
      "type": "string",
      "enum": [
        "use",
        "restock",
        "adjust",
        "dispose"
      ],
      "default": "use",
      "description": "Type of inventory action"
    },
    "source": {
      "type": "string",
      "enum": [
        "scan",
        "manual",
        "student_mode"
      ],
      "default": "manual",
      "description": "How the action was initiated"
    },
    "idempotency_key": {
      "type": "string",
      "description": "Unique key to prevent duplicate logs"
    },
    "student_id": {
      "type": "string",
      "description": "Student ID if applicable"
    },
    "experiment": {
      "type": "string",
      "description": "Experiment name/number if applicable"
    }
  },
  "required": [
    "item_id",
    "item_name",
    "item_type",
    "quantity_used",
    "before_quantity",
    "after_quantity",
    "action",
    "source",
    "idempotency_key"
  ]
}