import { Pool, PoolClient, QueryResult } from 'pg';
import config from './config';

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const { baseDelayMs, maxDelayMs } = config.database.retry;
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

// Create connection pool
const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.pool.max,
  min: config.database.pool.min,
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
});

// Log pool events in development
pool.on('connect', () => {
  console.log('New client connected to pool');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Initialize database connection with retry logic
 * Uses exponential backoff for connection failures
 */
export async function initializeConnection(): Promise<void> {
  const { maxRetries } = config.database.retry;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('Database connection established successfully');
      return;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(`Database connection attempt ${attempt + 1}/${maxRetries + 1} failed. Retrying in ${Math.round(delay)}ms...`, {
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  console.error('Failed to connect to database after all retries', {
    maxRetries,
    lastError: lastError?.message,
  });
  throw lastError;
}

export interface EventInput {
  name: string;
  properties: Record<string, unknown>;
  sessionId: string | null;
  userId: string | null;
  timestamp: Date | string;
}

export interface StoredEvent {
  id: number;
}

export interface Session {
  id: string;
  started_at: Date;
  last_activity_at: Date;
  event_count: number;
}

export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

/**
 * Execute a query using the connection pool
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log all queries if enabled
  if (config.database.queryLogging.logAllQueries) {
    console.log('Query executed:', {
      text: text.substring(0, 200),
      params: params?.length || 0,
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
  }

  // Log slow queries
  if (duration > config.database.queryLogging.slowQueryThreshold) {
    console.warn('Slow query detected:', {
      text: text.substring(0, 500),
      duration: `${duration}ms`,
      threshold: `${config.database.queryLogging.slowQueryThreshold}ms`,
      rows: result.rowCount,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

/**
 * Close all pool connections
 */
export async function close(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}

/**
 * Get pool statistics
 */
export function getPoolStats(): PoolStats {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}


/**
 * Store event in database
 */
export async function storeEvent(event: EventInput): Promise<StoredEvent> {
  const { name, properties, sessionId, userId, timestamp } = event;

  // Store timestamp as proper TIMESTAMP type
  const result = await query(
    'INSERT INTO events (name, properties, session_id, user_id, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [name, JSON.stringify(properties), sessionId, userId, timestamp]
  );

  return result.rows[0];
}

/**
 * Update or create session
 */
export async function updateSession(sessionId: string): Promise<Session | null> {
  if (!sessionId) return null;

  const result = await query(
    `INSERT INTO sessions (id, started_at, last_activity_at, event_count)
     VALUES ($1, NOW(), NOW(), 1)
     ON CONFLICT (id) DO UPDATE SET
       last_activity_at = NOW(),
       event_count = sessions.event_count + 1
     RETURNING *`,
    [sessionId]
  );

  return result.rows[0];
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const result = await query(
    'SELECT * FROM sessions WHERE id = $1',
    [sessionId]
  );

  return result.rows[0] || null;
}

// Default export for backward compatibility
export default pool;
