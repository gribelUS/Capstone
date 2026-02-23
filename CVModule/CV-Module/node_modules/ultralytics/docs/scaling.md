# Scaling Ultralytics

This guide covers strategies for scaling Ultralytics to handle high traffic loads.

## Capacity Planning

### Baseline Requirements

For a typical deployment handling ~1M events/day:

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| API Servers | 2 | 4 |
| CPU per server | 2 cores | 4 cores |
| RAM per server | 2 GB | 4 GB |
| Database CPU | 2 cores | 4 cores |
| Database RAM | 4 GB | 8 GB |
| Database Storage | 50 GB | 100 GB |

### Growth Estimates

Event storage requirements (approximate):

- 1M events/day ≈ 1 GB/day ≈ 365 GB/year
- 10M events/day ≈ 10 GB/day ≈ 3.6 TB/year

Plan storage with data retention in mind.

## Horizontal Scaling

### API Server Scaling

Ultralytics API servers are stateless and can be horizontally scaled behind a load balancer.

#### Docker Compose

```yaml
services:
  api:
    image: ultralytics:latest
    deploy:
      replicas: 4
```

#### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 4
  # ... rest of deployment config
```

Use Horizontal Pod Autoscaler for automatic scaling:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ultralytics-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ultralytics
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Load Balancing

Use a load balancer to distribute traffic across API servers:

- **Nginx** - Simple, efficient
- **HAProxy** - Feature-rich, highly configurable
- **AWS ALB** - Managed, integrates with AWS services
- **Google Cloud Load Balancing** - Managed, global

Health check configuration for load balancer:

```
GET /healthz
Expected: 200 OK
Interval: 10s
Timeout: 5s
Unhealthy threshold: 3
```

## Database Scaling

### Connection Pooling

Use PgBouncer for connection pooling:

```ini
[databases]
ultralytics = host=postgres port=5432 dbname=ultralytics

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

### Read Replicas

For read-heavy workloads, use PostgreSQL read replicas:

1. Set up streaming replication
2. Configure application to route reads to replicas
3. Keep writes on the primary

Update your configuration:

```env
DATABASE_URL=postgresql://user:pass@primary:5432/ultralytics
DATABASE_REPLICA_URL=postgresql://user:pass@replica:5432/ultralytics
```

### Table Partitioning

The events table can be partitioned by time for better performance:

```sql
-- Partition by month
CREATE TABLE events (
    id SERIAL,
    timestamp TIMESTAMP NOT NULL,
    -- other columns
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

See `migrations/004_optimize_for_scale.js` for our partitioning migration.

## Caching

### Query Caching

For frequently accessed dashboard data, consider Redis caching:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getDashboardSummary(siteId: string) {
  const cacheKey = `dashboard:${siteId}:summary`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Query database
  const data = await queryDashboardSummary(siteId);
  
  // Cache for 5 minutes
  await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);
  
  return data;
}
```

### Materialized Views

Use materialized views for complex aggregations:

```sql
CREATE MATERIALIZED VIEW daily_event_counts AS
SELECT 
    site_id,
    DATE(timestamp) as date,
    event_type,
    COUNT(*) as count
FROM events
GROUP BY site_id, DATE(timestamp), event_type;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_event_counts;
```

## Client-Side Optimization

### Batch Events

Configure the client to batch events:

```javascript
Ultralytics.init({
  apiKey: 'your-api-key',
  batchSize: 10,      // Send in batches of 10
  flushInterval: 5000 // Or every 5 seconds
});
```

### Sampling

For very high traffic sites, consider sampling:

```javascript
Ultralytics.init({
  apiKey: 'your-api-key',
  sampleRate: 0.1  // Track 10% of events
});
```

## Monitoring at Scale

### Key Performance Indicators

Monitor these metrics as you scale:

| Metric | Warning | Critical |
|--------|---------|----------|
| API p95 latency | > 200ms | > 500ms |
| API error rate | > 0.5% | > 1% |
| DB connection wait | > 50ms | > 200ms |
| DB query time (p95) | > 100ms | > 500ms |
| Event ingestion lag | > 1s | > 5s |

### Grafana Dashboard

Import our Grafana dashboard for visualizing Ultralytics metrics:

```bash
# Download dashboard JSON
curl -O https://raw.githubusercontent.com/aibubba/ultralytics/main/docs/grafana-dashboard.json

# Import via Grafana UI or API
```

## Cost Optimization

### Data Retention

Implement aggressive data retention for cost control:

```env
DATA_RETENTION_DAYS=90  # Keep only 90 days of raw events
```

### Cold Storage

Archive old data to cheaper storage:

1. Export old events to S3/GCS (Parquet format)
2. Delete from PostgreSQL
3. Query cold data with Athena/BigQuery when needed

### Right-Sizing

Review resource utilization monthly:

- Scale down over-provisioned instances
- Use spot/preemptible instances for non-critical workloads
- Consider reserved instances for predictable workloads

## Architecture at Scale

```
                    ┌─────────────┐
                    │   CDN/WAF   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │Load Balancer│
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  API #1   │    │  API #2   │    │  API #N   │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼──────┐
                    │  PgBouncer  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  Primary  │    │ Replica 1 │    │ Replica 2 │
    │    DB     │    │   (Read)  │    │   (Read)  │
    └───────────┘    └───────────┘    └───────────┘
```

## Need Help?

For scaling consultations or enterprise support:

- GitHub Discussions: https://github.com/aibubba/ultralytics/discussions
- Email: support@ultralytics.dev (placeholder)
