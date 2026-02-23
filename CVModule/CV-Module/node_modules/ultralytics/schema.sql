-- Ultralytics Schema
-- 
-- NOTE: This file is kept for reference only.
-- The canonical schema is now managed via migrations in the migrations/ directory.
-- To set up the database, run: npm run migrate:up
--
-- Initial database schema for event tracking

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    properties JSONB,
    session_id VARCHAR(255),
    user_id VARCHAR(255),
    -- Fixed: Now using proper TIMESTAMP type instead of VARCHAR
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp_name ON events(timestamp, name);

-- Sessions table for tracking user sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_count INTEGER DEFAULT 0
);

-- Index for session lookups by activity
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at);

-- API keys table for authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
