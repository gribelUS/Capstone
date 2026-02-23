/**
 * Data anonymization service for privacy compliance
 */

import { query } from '../db';

/**
 * Anonymize all events for a specific user
 * Replaces user-identifying information with anonymized placeholders
 */
export async function anonymizeUserEvents(userId: string): Promise<number> {
  const result = await query(`
    UPDATE events 
    SET 
      user_id = 'anon_' || md5($1),
      properties = jsonb_set(
        jsonb_set(
          properties::jsonb,
          '{email}',
          '"[REDACTED]"'::jsonb,
          false
        ),
        '{ip}',
        '"[REDACTED]"'::jsonb,
        false
      )
    WHERE user_id = $1
  `, [userId]);

  return result.rowCount || 0;
}

/**
 * Delete all events for a specific user
 * Complete removal of user data (GDPR right to erasure)
 */
export async function deleteUserEvents(userId: string): Promise<number> {
  const result = await query(`
    DELETE FROM events 
    WHERE user_id = $1
  `, [userId]);

  return result.rowCount || 0;
}

/**
 * Get a summary of user data (for data portability)
 */
export async function getUserDataSummary(userId: string): Promise<{
  eventCount: number;
  firstEvent: Date | null;
  lastEvent: Date | null;
  eventTypes: string[];
  sessionCount: number;
}> {
  const countResult = await query(`
    SELECT 
      COUNT(*) as event_count,
      MIN(timestamp) as first_event,
      MAX(timestamp) as last_event,
      COUNT(DISTINCT session_id) as session_count
    FROM events 
    WHERE user_id = $1
  `, [userId]);

  const typesResult = await query(`
    SELECT DISTINCT name 
    FROM events 
    WHERE user_id = $1
    ORDER BY name
  `, [userId]);

  const row = countResult.rows[0];
  return {
    eventCount: parseInt(row.event_count, 10),
    firstEvent: row.first_event ? new Date(row.first_event) : null,
    lastEvent: row.last_event ? new Date(row.last_event) : null,
    eventTypes: typesResult.rows.map(r => r.name),
    sessionCount: parseInt(row.session_count, 10)
  };
}

/**
 * Export all user data (GDPR data portability)
 */
export async function exportUserData(userId: string): Promise<{
  userId: string;
  exportDate: string;
  events: Array<{
    id: number;
    name: string;
    properties: Record<string, unknown>;
    sessionId: string | null;
    timestamp: string;
  }>;
}> {
  const result = await query(`
    SELECT id, name, properties, session_id, timestamp
    FROM events
    WHERE user_id = $1
    ORDER BY timestamp ASC
  `, [userId]);

  return {
    userId,
    exportDate: new Date().toISOString(),
    events: result.rows.map(row => ({
      id: row.id,
      name: row.name,
      properties: row.properties || {},
      sessionId: row.session_id,
      timestamp: row.timestamp.toISOString()
    }))
  };
}

/**
 * Anonymize session data (remove user association)
 */
export async function anonymizeSession(sessionId: string): Promise<number> {
  const result = await query(`
    UPDATE events 
    SET user_id = NULL
    WHERE session_id = $1
  `, [sessionId]);

  return result.rowCount || 0;
}
