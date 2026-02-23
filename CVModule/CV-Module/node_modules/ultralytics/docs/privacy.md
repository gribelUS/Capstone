# Privacy and Data Management

Ultralytics provides comprehensive privacy controls to help you comply with data protection regulations like GDPR, CCPA, and other privacy laws.

## Overview

The privacy API allows you to:

- **View user data summary** - See what data has been collected for a user
- **Export user data** - Download all data for a user (data portability)
- **Anonymize user data** - Pseudonymize data while retaining analytics value
- **Delete user data** - Permanently remove all data for a user (right to erasure)

## API Endpoints

All privacy endpoints require API key authentication.

### Get User Data Summary

```
GET /api/privacy/users/:userId/summary
```

Returns a summary of data collected for a specific user.

**Response:**
```json
{
  "userId": "user_123",
  "summary": {
    "eventCount": 142,
    "firstEvent": "2022-01-15T10:30:00.000Z",
    "lastEvent": "2022-09-14T14:22:00.000Z",
    "eventTypes": ["page_view", "button_click", "purchase"],
    "sessionCount": 24
  }
}
```

### Export User Data

```
GET /api/privacy/users/:userId/export
```

Exports all data for a user in JSON format. This supports the GDPR right to data portability.

**Query Parameters:**
- `format` - Output format (currently only `json` is supported)

**Response:**
```json
{
  "userId": "user_123",
  "exportDate": "2022-09-15T10:00:00.000Z",
  "events": [
    {
      "id": 1001,
      "name": "page_view",
      "properties": {"path": "/home"},
      "sessionId": "sess_abc123",
      "timestamp": "2022-01-15T10:30:00.000Z"
    }
  ]
}
```

### Anonymize User Data

```
POST /api/privacy/users/:userId/anonymize
```

Anonymizes all events for a user by:
- Replacing the user ID with a hashed pseudonym
- Removing email addresses from event properties
- Removing IP addresses from event properties

This allows you to retain analytics data while removing personally identifiable information.

**Response:**
```json
{
  "success": true,
  "message": "Anonymized 142 events for user",
  "userId": "user_123",
  "eventsAnonymized": 142
}
```

### Delete User Data

```
DELETE /api/privacy/users/:userId/data
```

Permanently deletes all events for a user. This supports the GDPR right to erasure ("right to be forgotten").

**Warning:** This action is irreversible.

**Response:**
```json
{
  "success": true,
  "message": "Deleted 142 events for user",
  "userId": "user_123",
  "eventsDeleted": 142
}
```

## Implementation Recommendations

### Handling User Requests

1. **Verify Identity** - Before processing any privacy request, verify the requester's identity to prevent unauthorized access or deletion.

2. **Log Requests** - Keep an audit log of privacy requests for compliance purposes.

3. **Timely Response** - GDPR requires responding to requests within 30 days.

### Data Retention

Configure automatic data cleanup using the cleanup script:

```bash
# Delete events older than 90 days
RETENTION_DAYS=90 npm run cleanup
```

### Consent Management

We recommend implementing consent management in your application:

```javascript
// Only track if user has consented
if (userHasConsented) {
  ultralytics.init({
    projectId: 'YOUR_PROJECT_ID'
  });
}
```

### Anonymization vs Deletion

- Use **anonymization** when you want to retain aggregate analytics data while removing PII
- Use **deletion** when the user wants complete removal of their data

## Compliance Notes

This API helps support compliance with:

- **GDPR** (EU General Data Protection Regulation)
- **CCPA** (California Consumer Privacy Act)
- **LGPD** (Brazil's Lei Geral de Proteção de Dados)

However, implementing these APIs alone does not guarantee compliance. Consult with legal counsel to ensure your overall data practices meet regulatory requirements.
