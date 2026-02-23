# API Reference

This document provides a complete reference for the Ultralytics REST API.

## Authentication

All API endpoints (except health checks) require authentication using an API key. Include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" https://your-server.com/api/events
```

## Health Endpoints

These endpoints do not require authentication.

### GET /health

Returns detailed server health status including database connectivity.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-04-15T10:30:00.000Z",
  "uptime": 86400,
  "database": {
    "status": "connected",
    "latencyMs": 5,
    "pool": {
      "total": 10,
      "idle": 8,
      "waiting": 0
    }
  }
}
```

### GET /healthz

Kubernetes liveness probe. Returns 200 if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-04-15T10:30:00.000Z"
}
```

### GET /readyz

Kubernetes readiness probe. Returns 200 only if the database is available.

**Response (Ready):**
```json
{
  "status": "ready",
  "timestamp": "2024-04-15T10:30:00.000Z",
  "checks": {
    "database": "ok"
  }
}
```

**Response (Not Ready - 503):**
```json
{
  "status": "not ready",
  "timestamp": "2024-04-15T10:30:00.000Z",
  "checks": {
    "database": "failed"
  },
  "error": "Connection refused"
}
```

## Event Tracking

### POST /api/events

Track a single event.

**Request Body:**
```json
{
  "name": "page_view",
  "properties": {
    "page": "/home",
    "referrer": "https://google.com"
  },
  "sessionId": "abc-123",
  "userId": "user-456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Event name |
| `properties` | object | No | Event properties |
| `sessionId` | string | No | Session identifier |
| `userId` | string | No | User identifier |

**Response (201 Created):**
```json
{
  "success": true,
  "eventId": 12345
}
```

### POST /api/events/batch

Track multiple events in a single request.

**Request Body:**
```json
{
  "events": [
    {
      "name": "page_view",
      "properties": { "page": "/home" },
      "sessionId": "abc-123"
    },
    {
      "name": "button_click",
      "properties": { "buttonId": "signup" },
      "sessionId": "abc-123"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "eventIds": [12345, 12346],
  "count": 2
}
```

### GET /api/events

Query tracked events with filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO 8601 | Filter events after this date |
| `endDate` | ISO 8601 | Filter events before this date |
| `name` | string | Filter by event name |
| `sessionId` | string | Filter by session ID |
| `userId` | string | Filter by user ID |
| `limit` | integer | Max results (default: 100, max: 1000) |
| `offset` | integer | Pagination offset |

**Example:**
```bash
curl "https://your-server.com/api/events?startDate=2024-01-01&name=page_view&limit=50" \
  -H "X-API-Key: your-api-key"
```

**Response:**
```json
{
  "events": [
    {
      "id": 12345,
      "name": "page_view",
      "properties": { "page": "/home" },
      "session_id": "abc-123",
      "user_id": null,
      "timestamp": "2024-04-15T10:30:00.000Z"
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 50
}
```

## Dashboard

### GET /api/dashboard/summary

Get a summary of analytics data.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO 8601 | Start of date range |
| `endDate` | ISO 8601 | End of date range |

**Response:**
```json
{
  "totalEvents": 10000,
  "uniqueSessions": 500,
  "uniqueUsers": 300,
  "topEvents": [
    { "name": "page_view", "count": 5000 },
    { "name": "button_click", "count": 2000 }
  ]
}
```

### GET /api/dashboard/events-over-time

Get event counts grouped by time period.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO 8601 | Start of date range |
| `endDate` | ISO 8601 | End of date range |
| `granularity` | string | `hour`, `day`, or `week` |

**Response:**
```json
{
  "data": [
    { "period": "2024-04-15", "count": 1000 },
    { "period": "2024-04-16", "count": 1200 }
  ]
}
```

## Analytics

### POST /api/analytics/funnel

Analyze conversion funnels.

**Request Body:**
```json
{
  "steps": ["page_view", "signup_started", "signup_completed"],
  "startDate": "2024-04-01",
  "endDate": "2024-04-15"
}
```

**Response:**
```json
{
  "funnel": [
    { "step": "page_view", "count": 1000, "percentage": 100 },
    { "step": "signup_started", "count": 200, "percentage": 20 },
    { "step": "signup_completed", "count": 50, "percentage": 5 }
  ],
  "overallConversion": 0.05
}
```

### POST /api/analytics/cohort

Analyze user cohorts.

**Request Body:**
```json
{
  "cohortEvent": "signup_completed",
  "returnEvent": "purchase",
  "startDate": "2024-01-01",
  "endDate": "2024-04-15",
  "granularity": "week"
}
```

**Response:**
```json
{
  "cohorts": [
    {
      "cohort": "2024-W01",
      "size": 100,
      "retention": [100, 80, 60, 50]
    }
  ]
}
```

## Export

### GET /api/export

Export event data in CSV or JSON format.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `csv` or `json` |
| `startDate` | ISO 8601 | Start of date range |
| `endDate` | ISO 8601 | End of date range |
| `eventName` | string | Filter by event name |

**Example:**
```bash
curl "https://your-server.com/api/export?format=csv&startDate=2024-04-01" \
  -H "X-API-Key: your-api-key" \
  -o events.csv
```

## Privacy

### DELETE /api/privacy/users/:userId/data

Delete all data for a specific user (GDPR compliance).

**Response:**
```json
{
  "success": true,
  "deletedCount": 150
}
```

### POST /api/privacy/anonymize

Anonymize historical data.

**Request Body:**
```json
{
  "beforeDate": "2024-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "anonymizedCount": 5000
}
```

## Metrics

### GET /metrics

Prometheus metrics endpoint.

**Response:**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/events",status="200"} 1000
...
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
