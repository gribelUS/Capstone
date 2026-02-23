/**
 * Migration 004: Optimize for Scale
 * 
 * This migration adds table partitioning and additional indexes
 * to support high-volume production workloads.
 * 
 * IMPORTANT: This migration may take significant time on large datasets.
 * Consider running during a maintenance window.
 */

exports.up = async (pgm) => {
  // Add composite indexes for common query patterns
  pgm.createIndex('events', ['site_id', 'timestamp'], {
    name: 'idx_events_site_timestamp',
    ifNotExists: true
  });

  pgm.createIndex('events', ['site_id', 'name', 'timestamp'], {
    name: 'idx_events_site_name_timestamp',
    ifNotExists: true
  });

  pgm.createIndex('events', ['user_id', 'timestamp'], {
    name: 'idx_events_user_timestamp',
    ifNotExists: true,
    where: 'user_id IS NOT NULL'
  });

  // Add BRIN index for time-series queries (efficient for sorted data)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_timestamp_brin 
    ON events USING BRIN (timestamp) 
    WITH (pages_per_range = 128);
  `);

  // Create partitioned events table for new data
  // Note: Existing data remains in the original table
  // New events should be directed to this table after migration
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS events_partitioned (
      id BIGSERIAL,
      site_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      properties JSONB DEFAULT '{}',
      session_id VARCHAR(64),
      user_id VARCHAR(255),
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp);
  `);

  // Create partitions for current and next 12 months
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
    
    const partitionName = `events_p${year}_${month}`;
    
    pgm.sql(`
      CREATE TABLE IF NOT EXISTS ${partitionName} 
      PARTITION OF events_partitioned 
      FOR VALUES FROM ('${year}-${month}-01') TO ('${nextYear}-${nextMonth}-01');
    `);
  }

  // Add indexes to partitioned table
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_part_site_timestamp 
    ON events_partitioned (site_id, timestamp);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_part_session 
    ON events_partitioned (session_id) 
    WHERE session_id IS NOT NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_events_part_user 
    ON events_partitioned (user_id) 
    WHERE user_id IS NOT NULL;
  `);

  // Create function to automatically create future partitions
  pgm.sql(`
    CREATE OR REPLACE FUNCTION create_events_partition()
    RETURNS void AS $$
    DECLARE
      partition_date DATE;
      partition_name TEXT;
      start_date TEXT;
      end_date TEXT;
    BEGIN
      -- Create partition for next month if it doesn't exist
      partition_date := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
      partition_name := 'events_p' || TO_CHAR(partition_date, 'YYYY_MM');
      start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
      end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = partition_name
      ) THEN
        EXECUTE format(
          'CREATE TABLE %I PARTITION OF events_partitioned FOR VALUES FROM (%L) TO (%L)',
          partition_name, start_date, end_date
        );
        RAISE NOTICE 'Created partition: %', partition_name;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create statistics targets for better query planning
  pgm.sql(`
    ALTER TABLE events ALTER COLUMN name SET STATISTICS 1000;
    ALTER TABLE events ALTER COLUMN site_id SET STATISTICS 1000;
  `);

  // Add comments for documentation
  pgm.sql(`
    COMMENT ON TABLE events_partitioned IS 'Partitioned events table for high-volume workloads. Use for new data after v1.0 migration.';
    COMMENT ON FUNCTION create_events_partition() IS 'Creates monthly partitions for events_partitioned table. Run monthly via cron.';
  `);
};

exports.down = async (pgm) => {
  // Drop partitioned table and all partitions
  pgm.sql('DROP TABLE IF EXISTS events_partitioned CASCADE;');
  
  // Drop the partition creation function
  pgm.sql('DROP FUNCTION IF EXISTS create_events_partition();');
  
  // Drop indexes
  pgm.dropIndex('events', 'idx_events_site_timestamp', { ifExists: true });
  pgm.dropIndex('events', 'idx_events_site_name_timestamp', { ifExists: true });
  pgm.dropIndex('events', 'idx_events_user_timestamp', { ifExists: true });
  pgm.sql('DROP INDEX IF EXISTS idx_events_timestamp_brin;');
  
  // Reset statistics targets
  pgm.sql(`
    ALTER TABLE events ALTER COLUMN name SET STATISTICS -1;
    ALTER TABLE events ALTER COLUMN site_id SET STATISTICS -1;
  `);
};
