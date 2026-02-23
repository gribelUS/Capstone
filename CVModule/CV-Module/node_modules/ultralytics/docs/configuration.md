# Configuration Reference

This document covers all configuration options for Ultralytics server and client.

## Server Configuration

All server configuration is done through environment variables. Copy `.env.example` to `.env` and customize as needed.

### Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `DB_POOL_MIN` | Minimum pool connections | `2` | No |
| `DB_POOL_MAX` | Maximum pool connections | `10` | No |
| `DB_IDLE_TIMEOUT` | Idle connection timeout (ms) | `30000` | No |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (ms) | `5000` | No |
| `DB_RETRY_ATTEMPTS` | Connection retry attempts | `5` | No |
| `DB_RETRY_DELAY` | Delay between retries (ms) | `1000` | No |

Example:
```bash
DATABASE_URL=postgres://user:password@localhost:5432/ultralytics
DB_POOL_MAX=20
```

### Server Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP server port | `3000` | No |
| `NODE_ENV` | Environment (development/production) | `development` | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | No |
| `SLOW_QUERY_THRESHOLD` | Log queries slower than this (ms) | `1000` | No |

### Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window duration | `900000` (15 min) | No |
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |

### Data Retention

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RETENTION_DAYS` | Days to keep event data | `365` | No |
| `CLEANUP_ENABLED` | Enable automatic cleanup | `true` | No |
| `CLEANUP_SCHEDULE` | Cron schedule for cleanup | `0 2 * * *` | No |

### Batch Processing

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MAX_BATCH_SIZE` | Maximum events per batch request | `100` | No |

## Client Configuration

### JavaScript/Browser

```javascript
Ultralytics.init({
  // Required: Your Ultralytics server URL
  endpoint: 'https://analytics.yoursite.com',
  
  // Required: API key for authentication
  apiKey: 'your-api-key',
  
  // Optional: Auto-track page views (SPAs)
  autoTrack: true,
  
  // Optional: Track initial page load
  trackInitialPageView: true,
  
  // Optional: Enable debug logging
  debug: false,
  
  // Optional: Session timeout in milliseconds
  sessionTimeout: 1800000, // 30 minutes
});
```

### TypeScript/ES Modules

```typescript
import { Ultralytics } from 'ultralytics';

const analytics = new Ultralytics({
  endpoint: 'https://analytics.yoursite.com',
  apiKey: 'your-api-key',
  debug: process.env.NODE_ENV === 'development',
});
```

### React Hook

```tsx
import { useUltralytics } from 'ultralytics/react';

function App() {
  const analytics = useUltralytics({
    endpoint: 'https://analytics.yoursite.com',
    apiKey: 'your-api-key',
    autoTrackPageViews: true,
  });
  
  // Use analytics.track(), analytics.identify(), etc.
}
```

### Vue Composable

```vue
<script setup>
import { useUltralytics } from 'ultralytics/vue';

const analytics = useUltralytics({
  endpoint: 'https://analytics.yoursite.com',
  apiKey: 'your-api-key',
  autoTrackPageViews: true,
});
</script>
```

### Svelte Store

```svelte
<script>
import { createUltralytics } from 'ultralytics/svelte';

const analytics = createUltralytics({
  endpoint: 'https://analytics.yoursite.com',
  apiKey: 'your-api-key',
  autoTrackPageViews: true,
});
</script>
```

## Docker Configuration

### Environment Variables

When using Docker Compose, environment variables can be set in the `docker-compose.yml` file or in a `.env` file.

```yaml
services:
  ultralytics:
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/ultralytics
      - PORT=3000
      - LOG_LEVEL=info
```

### Volume Mounts

For persistent data:

```yaml
volumes:
  postgres_data:

services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

## Kubernetes Configuration

### ConfigMap

Non-sensitive configuration should go in a ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ultralytics-config
data:
  PORT: "3000"
  LOG_LEVEL: "info"
  RATE_LIMIT_MAX: "100"
  RETENTION_DAYS: "365"
```

### Secret

Sensitive configuration should go in a Secret:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ultralytics-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgres://user:password@db:5432/ultralytics"
```

## Production Recommendations

For production deployments, we recommend:

1. **Database pooling**: Set `DB_POOL_MAX` based on your expected load
2. **Rate limiting**: Adjust `RATE_LIMIT_MAX` for your traffic patterns
3. **Logging**: Set `LOG_LEVEL=warn` to reduce log volume
4. **Data retention**: Configure `RETENTION_DAYS` based on your needs
5. **SSL/TLS**: Always use HTTPS in production (see [SSL Setup](./ssl-setup.md))
