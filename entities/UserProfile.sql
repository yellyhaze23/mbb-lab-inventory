{
  "name": "UserProfile",
  "type": "object",
  "properties": {
    "full_name": {
      "type": "string",
      "description": "User's full name"
    },
    "role": {
      "type": "string",
      "enum": [
        "admin",
        "super_admin"
      ],
      "default": "admin",
      "description": "User role in the system"
    },
    "is_active": {
      "type": "boolean",
      "default": true,
      "description": "Whether the user account is active"
    },
    "avatar_url": {
      "type": "string",
      "description": "URL to user's profile picture"
    }
  },
  "required": [
    "full_name",
    "role"
  ]
}