/**
 * Configuration loader for Ultralytics
 * Loads configuration from environment variables
 */

import * as dotenv from 'dotenv';
dotenv.config();

export interface DatabasePoolConfig {
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface QueryLoggingConfig {
  slowQueryThreshold: number;
  logAllQueries: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface DatabaseConfig {
  url: string;
  pool: DatabasePoolConfig;
  queryLogging: QueryLoggingConfig;
  retry: RetryConfig;
}

export interface ApiConfig {
  maxBatchSize: number;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RetentionConfig {
  days: number;
  schedule: string;
}

export interface LoggingConfig {
  level: string;
}

export interface Config {
  port: number;
  database: DatabaseConfig;
  api: ApiConfig;
  rateLimit: RateLimitConfig;
  retention: RetentionConfig;
  logging: LoggingConfig;
}


const config: Config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/ultralytics',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
    },
    queryLogging: {
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10),
      logAllQueries: process.env.LOG_ALL_QUERIES === 'true',
    },
    retry: {
      maxRetries: parseInt(process.env.DB_RETRY_MAX || '3', 10),
      baseDelayMs: parseInt(process.env.DB_RETRY_BASE_DELAY_MS || '1000', 10),
      maxDelayMs: parseInt(process.env.DB_RETRY_MAX_DELAY_MS || '30000', 10),
    },
  },

  // API configuration
  api: {
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '100', 10),
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Data retention configuration
  retention: {
    days: parseInt(process.env.RETENTION_DAYS || '90', 10),
    schedule: process.env.RETENTION_SCHEDULE || '0 2 * * *',
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  }
};

export default config;
