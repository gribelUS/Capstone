/**
 * Migration: Add materialized views for dashboard queries
 * 
 * This migration adds materialized views to optimize common dashboard queries.
 * The views pre-aggregate daily statistics to improve query performance.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create materialized view for daily event statistics
  pgm.sql(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS daily_event_stats AS
    SELECT 
      DATE_TRUNC('day', timestamp) AS day,
      name AS event_name,
      COUNT(*) AS event_count,
      COUNT(DISTINCT session_id) AS unique_sessions,
      COUNT(DISTINCT user_id) AS unique_users
    FROM events
    GROUP BY DATE_TRUNC('day', timestamp), name
    WITH DATA;
  `);

  // Create index on the materialized view for faster lookups
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_daily_event_stats_day 
    ON daily_event_stats (day);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_daily_event_stats_event_name 
    ON daily_event_stats (event_name);
  `);

  // Create materialized view for hourly statistics (for recent data)
  pgm.sql(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_event_stats AS
    SELECT 
      DATE_TRUNC('hour', timestamp) AS hour,
      name AS event_name,
      COUNT(*) AS event_count,
      COUNT(DISTINCT session_id) AS unique_sessions
    FROM events
    WHERE timestamp >= NOW() - INTERVAL '7 days'
    GROUP BY DATE_TRUNC('hour', timestamp), name
    WITH DATA;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_hourly_event_stats_hour 
    ON hourly_event_stats (hour);
  `);

  // Create function to refresh materialized views
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
    RETURNS void AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY daily_event_stats;
      REFRESH MATERIALIZED VIEW hourly_event_stats;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS refresh_dashboard_stats();');
  pgm.sql('DROP MATERIALIZED VIEW IF EXISTS hourly_event_stats;');
  pgm.sql('DROP MATERIALIZED VIEW IF EXISTS daily_event_stats;');
};
