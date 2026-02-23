# Performance Guide

This document covers performance characteristics, optimization strategies, and benchmarking for Ultralytics.

## Client Library Performance

### Bundle Size

The Ultralytics client library is designed to be lightweight:

| Build | Size | Gzipped |
|-------|------|---------|
| UMD | ~8 KB | ~3 KB |
| ESM | ~7 KB | ~2.5 KB |

### Overhead

The client library adds minimal overhead to your application:

- **Initialization**: ~1ms
- **Event tracking**: ~0.05ms per event
- **Memory footprint**: ~50KB baseline

### Best Practices

1. **Use batch sending**: Enable `batchSize` to reduce network requests
   ```typescript
   Ultralytics.init({
     apiKey: 'your-key',
     batchSize: 10,
     flushInterval: 5000,
   });
   ```

2. **Lazy loading**: Load the client after critical content
   ```html
   <script defer src="ultralytics.min.js"></script>
   ```

3. **Disable in development**: Skip tracking in dev environments
   ```typescript
   Ultralytics.init({
     apiKey: 'your-key',
     enabled: process.env.NODE_ENV === 'production',
   });
   ```


## Server Performance

### Ingestion Throughput

Benchmark results on a 4-core server with PostgreSQL:

| Scenario | Events/Second |
|----------|---------------|
| Single inserts | ~2,000 |
| Batch (10 events) | ~8,000 |
| Batch (100 events) | ~15,000 |

### Query Performance

Query performance depends heavily on data volume and indexing. Typical response times with 10M events:

| Query Type | Avg Response Time |
|------------|-------------------|
| Dashboard summary | 50-100ms |
| Events over time | 100-200ms |
| Top pages | 50-150ms |
| Funnel analysis | 200-500ms |
| Cohort analysis | 300-800ms |

### Database Optimization

1. **Connection pooling**: Configure pool size based on your workload
   ```
   DB_POOL_MIN=5
   DB_POOL_MAX=20
   ```

2. **Indexes**: Ensure proper indexes exist (run migrations)
   ```bash
   npm run migrate
   ```

3. **Partitioning**: For high-volume deployments, consider time-based partitioning

4. **Materialized views**: Dashboard queries use materialized views for speed

### Memory Usage

Server memory requirements:

| Events/Day | Recommended RAM |
|------------|-----------------|
| < 100K | 512 MB |
| 100K - 1M | 1 GB |
| 1M - 10M | 2-4 GB |
| > 10M | 4+ GB |

## Scaling Recommendations

### Horizontal Scaling

1. **Load balancer**: Use nginx or HAProxy in front of multiple server instances
2. **Sticky sessions**: Not required - all state is in PostgreSQL
3. **Health checks**: Use `/healthz` endpoint for load balancer health checks

### Vertical Scaling

For PostgreSQL:
- Increase `shared_buffers` to 25% of RAM
- Increase `work_mem` for complex queries
- Enable `pg_stat_statements` for query analysis

### High Availability

1. **Database replication**: Use PostgreSQL streaming replication
2. **Read replicas**: Route dashboard queries to read replicas
3. **Connection pooling**: Consider PgBouncer for connection management

## Running Benchmarks

See [benchmarks/README.md](../benchmarks/README.md) for instructions on running performance tests.

## Monitoring

Use the built-in Prometheus metrics endpoint:

```bash
curl http://localhost:3000/metrics
```

Key metrics to monitor:
- `ultralytics_events_ingested_total`: Total events processed
- `ultralytics_event_processing_duration_seconds`: Ingestion latency
- `ultralytics_query_duration_seconds`: Query response times
- `ultralytics_db_pool_size`: Database connection pool utilization
