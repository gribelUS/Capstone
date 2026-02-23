/**
 * Ultralytics Data Retention Cleanup Job
 * 
 * This script removes old events based on the configured retention period.
 * Can be run as a standalone script or scheduled via cron.
 * 
 * Usage:
 *   node scripts/cleanup.js           # Run once
 *   node scripts/cleanup.js --cron    # Run as scheduled cron job
 */

const cron = require('node-cron');
const db = require('../dist/db');
const config = require('../dist/config').default;

async function cleanup() {
  const retentionDays = config.retention.days;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  console.log(`Running cleanup job at ${new Date().toISOString()}`);
  console.log(`Removing events older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

  try {
    // Delete old events
    const result = await db.query(
      'DELETE FROM events WHERE timestamp < $1 RETURNING id',
      [cutoffDate]
    );

    const deletedCount = result.rowCount;
    console.log(`Deleted ${deletedCount} old events`);

    // Clean up orphaned sessions (no activity in retention period)
    const sessionResult = await db.query(
      'DELETE FROM sessions WHERE last_activity_at < $1 RETURNING id',
      [cutoffDate]
    );

    const deletedSessions = sessionResult.rowCount;
    console.log(`Deleted ${deletedSessions} old sessions`);

    return {
      deletedEvents: deletedCount,
      deletedSessions: deletedSessions
    };
  } catch (error) {
    console.error('Cleanup job failed:', error);
    throw error;
  }
}

// Check if running as cron job
if (process.argv.includes('--cron')) {
  // Run daily at 2am
  const schedule = config.retention.schedule || '0 2 * * *';
  
  console.log(`Starting cleanup job with schedule: ${schedule}`);
  
  cron.schedule(schedule, async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  });

  console.log('Cleanup job scheduled. Press Ctrl+C to exit.');
} else {
  // Run once
  cleanup()
    .then(result => {
      console.log('Cleanup complete:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanup };
