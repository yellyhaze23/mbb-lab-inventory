{
  "name": "LabSettings",
  "type": "object",
  "properties": {
    "lab_name": {
      "type": "string",
      "description": "Laboratory name"
    },
    "lab_description": {
      "type": "string",
      "description": "Laboratory description"
    },
    "address": {
      "type": "string",
      "description": "Laboratory address"
    },
    "contact_email": {
      "type": "string",
      "description": "Contact email"
    },
    "contact_phone": {
      "type": "string",
      "description": "Contact phone"
    },
    "lab_pin": {
      "type": "string",
      "description": "PIN code for student access"
    },
    "pin_expires_at": {
      "type": "string",
      "format": "date-time",
      "description": "When the PIN expires (optional)"
    },
    "pin_updated_by": {
      "type": "string",
      "description": "Who last updated the PIN"
    }
  },
  "required": [
    "lab_name"
  ]
}