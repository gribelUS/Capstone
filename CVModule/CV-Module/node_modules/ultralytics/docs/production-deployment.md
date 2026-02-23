# Production Deployment Guide

This guide covers deploying Ultralytics in a production environment.

## Prerequisites

- Docker and Docker Compose (or Kubernetes cluster)
- PostgreSQL 14+ database
- Domain name with SSL certificate
- Minimum 2GB RAM, 2 CPU cores

## Deployment Options

### Option 1: Docker Compose

The simplest way to deploy Ultralytics in production:

```bash
# Clone the repository
git clone https://github.com/aibubba/ultralytics.git
cd ultralytics

# Copy and configure environment
cp .env.production.example .env.production
# Edit .env.production with your settings

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Kubernetes

For larger deployments, use our Kubernetes manifests:

```bash
# Create namespace
kubectl create namespace ultralytics

# Apply secrets (edit first!)
cp k8s/secret.yaml.example k8s/secret.yaml
# Edit k8s/secret.yaml with your values
kubectl apply -f k8s/secret.yaml -n ultralytics

# Apply configuration
kubectl apply -f k8s/configmap.yaml -n ultralytics

# Deploy
kubectl apply -f k8s/deployment.yaml -n ultralytics
kubectl apply -f k8s/service.yaml -n ultralytics
```

## Database Setup

### Managed PostgreSQL (Recommended)

We recommend using a managed PostgreSQL service:

- **AWS RDS** - Amazon Relational Database Service
- **Google Cloud SQL** - Google's managed PostgreSQL
- **Azure Database for PostgreSQL**
- **DigitalOcean Managed Databases**

Configure your connection string in `.env.production`:

```
DATABASE_URL=postgresql://user:password@host:5432/ultralytics?sslmode=require
```

### Self-Hosted PostgreSQL

If self-hosting, ensure you:

1. Enable SSL/TLS connections
2. Set up regular backups (see `scripts/backup.sh`)
3. Configure connection pooling (PgBouncer recommended)
4. Set appropriate `max_connections`

## SSL/TLS Configuration

### Using Let's Encrypt

```bash
# Install certbot
apt-get install certbot

# Obtain certificate
certbot certonly --standalone -d analytics.yourdomain.com

# Certificates will be in /etc/letsencrypt/live/analytics.yourdomain.com/
```

Update `docker-compose.prod.yml` to mount certificates:

```yaml
volumes:
  - /etc/letsencrypt/live/analytics.yourdomain.com:/etc/nginx/ssl:ro
```

### Using Custom Certificates

Place your certificates in a secure location and update nginx configuration:

```nginx
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

## Environment Variables

Required production environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `API_SECRET_KEY` | Secret for API key generation | Random 64-char string |
| `CORS_ORIGINS` | Allowed origins | `https://yoursite.com` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

Optional but recommended:

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging verbosity | `info` |
| `SLOW_QUERY_THRESHOLD_MS` | Slow query logging | `1000` |
| `DATA_RETENTION_DAYS` | Event data retention | `365` |

## Health Checks

Ultralytics exposes health check endpoints:

- `GET /health` - Basic health check
- `GET /healthz` - Kubernetes liveness probe
- `GET /readyz` - Kubernetes readiness probe

Configure your load balancer or orchestrator to use these endpoints.

## Backups

### Automated Backups

Set up a cron job to run the backup script:

```bash
# Daily backup at 2 AM
0 2 * * * /opt/ultralytics/scripts/backup.sh >> /var/log/ultralytics-backup.log 2>&1
```

### Backup Retention

We recommend keeping:
- Daily backups for 7 days
- Weekly backups for 4 weeks
- Monthly backups for 12 months

## Monitoring

### Prometheus Metrics

Ultralytics exposes Prometheus metrics at `/metrics`. Scrape this endpoint with your Prometheus instance:

```yaml
scrape_configs:
  - job_name: 'ultralytics'
    static_configs:
      - targets: ['ultralytics:3000']
    metrics_path: '/metrics'
```

### Key Metrics to Monitor

- `ultralytics_events_total` - Total events tracked
- `ultralytics_api_request_duration_seconds` - API latency
- `ultralytics_db_query_duration_seconds` - Database query latency
- `ultralytics_active_connections` - Active database connections

### Alerting

Set up alerts for:

- API latency > 500ms (p95)
- Error rate > 1%
- Database connection pool exhaustion
- Disk space < 20%

## Security Checklist

Before going live, ensure:

- [ ] SSL/TLS enabled on all endpoints
- [ ] Strong API secret key generated
- [ ] Database password is strong and unique
- [ ] Rate limiting configured
- [ ] CORS origins restricted to your domains
- [ ] Firewall rules configured (only expose ports 80, 443)
- [ ] Regular security updates scheduled
- [ ] Backup strategy tested

## Troubleshooting

### Connection Refused

Check that:
1. Database is running and accessible
2. Firewall allows connections on required ports
3. Connection string is correct

### High Memory Usage

If memory usage is high:
1. Check for memory leaks with `node --inspect`
2. Reduce `DB_POOL_SIZE` if database connections are excessive
3. Enable `DATA_RETENTION_DAYS` to clean old data

### Slow Queries

Enable slow query logging:
```
SLOW_QUERY_THRESHOLD_MS=500
```

Review the logs and add indexes for frequently queried columns.

## Support

- GitHub Issues: https://github.com/aibubba/ultralytics/issues
- Documentation: https://github.com/aibubba/ultralytics/tree/main/docs

