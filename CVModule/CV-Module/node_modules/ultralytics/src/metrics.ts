/**
 * Prometheus metrics for Ultralytics server
 */

import client from 'prom-client';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics

/**
 * Counter for HTTP requests
 */
export const httpRequestsTotal = new client.Counter({
  name: 'ultralytics_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

/**
 * Histogram for HTTP request duration
 */
export const httpRequestDuration = new client.Histogram({
  name: 'ultralytics_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

/**
 * Counter for events tracked
 */
export const eventsTrackedTotal = new client.Counter({
  name: 'ultralytics_events_tracked_total',
  help: 'Total number of events tracked',
  labelNames: ['event_type'],
  registers: [register]
});

/**
 * Counter for batch events
 */
export const batchEventsTotal = new client.Counter({
  name: 'ultralytics_batch_events_total',
  help: 'Total number of events in batch requests',
  registers: [register]
});

/**
 * Gauge for active database connections
 */
export const dbConnectionsActive = new client.Gauge({
  name: 'ultralytics_db_connections_active',
  help: 'Number of active database connections',
  registers: [register]
});

/**
 * Gauge for database pool size
 */
export const dbConnectionsPool = new client.Gauge({
  name: 'ultralytics_db_connections_pool',
  help: 'Total number of database connections in pool',
  registers: [register]
});

/**
 * Histogram for database query duration
 */
export const dbQueryDuration = new client.Histogram({
  name: 'ultralytics_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

/**
 * Counter for database query errors
 */
export const dbQueryErrors = new client.Counter({
  name: 'ultralytics_db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['query_type'],
  registers: [register]
});

/**
 * Get the metrics registry
 */
export function getRegister(): client.Registry {
  return register;
}

/**
 * Get all metrics as Prometheus format string
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get the content type for metrics response
 */
export function getContentType(): string {
  return register.contentType;
}
