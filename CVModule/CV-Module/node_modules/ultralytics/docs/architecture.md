# Ultralytics Architecture

This document provides an overview of the Ultralytics architecture for developers who want to understand or contribute to the project.

## System Overview

Ultralytics is a self-hosted analytics platform that consists of two main components:

1. **Server**: A Node.js/Express API server that receives, stores, and queries analytics data
2. **Client SDK**: A lightweight JavaScript library that runs in browsers and sends analytics events to the server

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Browser/App   │────▶│    API Server   │────▶│   PostgreSQL    │
│  (Client SDK)   │     │   (Express.js)  │     │    Database     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Prometheus    │
                        │    (Metrics)    │
                        └─────────────────┘
```

## Client SDK

### Overview

The client SDK (`src/client.ts`) is a lightweight (~3kb gzipped) JavaScript library that:

- Tracks page views and custom events
- Manages user sessions automatically
- Supports user identification
- Batches events for efficient network usage
- Works with React, Vue, and vanilla JavaScript

### Key Features

**Session Management**: Sessions are automatically created and expire after 30 minutes of inactivity. Session IDs are stored in localStorage for persistence across page loads.

**User Identification**: Users can be identified with a unique ID and traits. The user ID persists across sessions.

**Automatic Page View Tracking**: When enabled, the SDK automatically tracks page views for SPAs by intercepting `history.pushState` and `history.replaceState`.

### Client Architecture

```typescript
// Singleton pattern for global access
const Ultralytics = new UltralyticsClient();

// Available via window.Ultralytics in browsers
// Or imported as ES module
import { Ultralytics } from 'ultralytics';
```

## Server Architecture

### Overview

The server is built with Express.js and TypeScript. It provides REST APIs for:

- Receiving analytics events
- Querying analytics data
- Dashboard summaries
- Data export
- User privacy controls

### Directory Structure

```
src/
├── server.ts           # Express app setup and configuration
├── db.ts               # Database connection pool and query helpers
├── config.ts           # Environment-based configuration
├── types.ts            # Shared TypeScript interfaces
├── validation.ts       # Request validation using JSON Schema
├── errors.ts           # Custom error classes
├── metrics.ts          # Prometheus metrics collection
├── middleware/
│   ├── auth.ts         # API key authentication
│   └── errorHandler.ts # Global error handling
├── routes/
│   ├── dashboard.ts    # Dashboard query endpoints
│   ├── analytics.ts    # Funnel and cohort analysis
│   ├── export.ts       # Data export endpoints
│   ├── privacy.ts      # User data privacy controls
│   └── replay.ts       # Event replay functionality
└── services/
    ├── funnel.ts       # Funnel analysis logic
    ├── cohort.ts       # Cohort analysis logic
    ├── anonymize.ts    # Data anonymization
    └── replay.ts       # Event replay logic
```

### Request Flow

1. Request arrives at Express server
2. Global middleware runs (logging, rate limiting, CORS)
3. Authentication middleware validates API key
4. Route handler processes request
5. Validation middleware checks request body
6. Service layer performs business logic
7. Database queries are executed
8. Response is sent back to client

### Database Schema

The primary table for event storage:

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  properties JSONB,
  session_id VARCHAR(36),
  user_id VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_name ON events(name);
```

### Authentication

API requests are authenticated using API keys passed in the `X-API-Key` header. Keys are stored in the `api_keys` table:

```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Deployment Architecture

### Docker Compose (Development/Small Scale)

```yaml
services:
  server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://...
    
  postgres:
    image: postgres:14
    volumes:
      - pgdata:/var/lib/postgresql/data
```

### Kubernetes (Production)

For production deployments, Kubernetes manifests are provided:

- `deployment.yaml` - Server pods with replicas
- `service.yaml` - ClusterIP service for internal access
- `configmap.yaml` - Non-sensitive configuration
- `secret.yaml` - Database credentials and API keys
- `servicemonitor.yaml` - Prometheus scrape configuration

### Nginx Reverse Proxy

For SSL termination and load balancing:

```
                     ┌─────────────┐
    HTTPS            │             │        HTTP
─────────────────────▶    Nginx    ├───────────────▶ Ultralytics Server
                     │             │        :3000
                     └─────────────┘
```

## Observability

### Metrics

Prometheus metrics are exposed at `/metrics`:

- `ultralytics_events_total` - Total events received
- `ultralytics_events_batch_size` - Histogram of batch sizes
- `ultralytics_http_request_duration_seconds` - Request latency
- `ultralytics_db_query_duration_seconds` - Database query latency

### Health Checks

- `GET /health` - Basic health check
- `GET /healthz` - Liveness probe (Kubernetes)
- `GET /readyz` - Readiness probe (Kubernetes)

## Security Considerations

### Input Validation

All input is validated using JSON Schema (via ajv). Event properties are sanitized to prevent XSS attacks.

### Rate Limiting

The API implements rate limiting to prevent abuse:

- 100 requests per minute per API key for event ingestion
- 1000 requests per minute per API key for queries

### Data Privacy

Users can request data deletion via the privacy API:

```
DELETE /api/users/:userId/data
```

This anonymizes all events associated with the user.

## Performance Considerations

### Database Optimization

- Connection pooling (configurable pool size)
- Prepared statements for common queries
- Indexes on frequently queried columns
- Query performance logging for slow queries

### Client SDK

- Minimal footprint (~3kb gzipped)
- No external dependencies
- Event batching reduces network requests
- Async operations don't block UI

## Future Considerations

- Real-time event streaming (WebSocket support)
- Materialized views for dashboard queries
- Event sampling for high-volume applications
- Multi-tenancy support
