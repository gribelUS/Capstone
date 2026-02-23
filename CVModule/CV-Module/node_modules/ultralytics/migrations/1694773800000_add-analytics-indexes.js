/**
 * Migration: Add indexes for analytics queries
 * 
 * This migration adds composite indexes to optimize the new analytics
 * endpoints (funnel analysis, cohort analysis, event replay).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Composite index for funnel analysis queries
  // Funnels typically filter by event name, user, and time range
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_funnel_analysis 
    ON events (user_id, name, timestamp)
    WHERE user_id IS NOT NULL;
  `);

  // Index for cohort analysis - grouping users by first event date
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_cohort_user_timestamp 
    ON events (user_id, timestamp)
    WHERE user_id IS NOT NULL;
  `);

  // Index for event replay queries - ordered by timestamp for a session
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_replay 
    ON events (session_id, timestamp);
  `);

  // Partial index for page views (most common event type)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_page_views 
    ON events (timestamp, session_id)
    WHERE name = 'page_view';
  `);

  // Index for property-based queries (JSONB)
  // GIN index allows efficient searching within properties
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_properties_gin 
    ON events USING GIN (properties);
  `);

  // Index for user identification events
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_identify 
    ON events (user_id, timestamp)
    WHERE name = 'identify';
  `);

  // Composite index for dashboard time-series queries
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_timeseries 
    ON events (name, DATE_TRUNC('hour', timestamp));
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_events_funnel_analysis;');
  pgm.sql('DROP INDEX IF EXISTS idx_events_cohort_user_timestamp;');
  pgm.sql('DROP INDEX IF EXISTS idx_events_replay;');
  pgm.sql('DROP INDEX IF EXISTS idx_events_page_views;');
  pgm.sql('DROP INDEX IF EXISTS idx_events_properties_gin;');
  pgm.sql('DROP INDEX IF EXISTS idx_events_identify;');
  pgm.sql('DROP INDEX IF EXISTS idx_events_timeseries;');
};
