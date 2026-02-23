/**
 * Event replay service
 * Allows replaying events for debugging, testing, and analysis
 */

import { query } from '../db';

export interface ReplayEvent {
  id: number;
  name: string;
  properties: Record<string, unknown>;
  sessionId: string | null;
  userId: string | null;
  timestamp: Date;
  relativeTimeMs: number; // Time since first event in replay
}

export interface ReplaySession {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  eventCount: number;
  durationMs: number;
  events: ReplayEvent[];
}

/**
 * Get events for replay within a time range
 */
export async function getEventsForReplay(
  startDate: Date,
  endDate: Date,
  options: {
    userId?: string;
    sessionId?: string;
    eventTypes?: string[];
    limit?: number;
  } = {}
): Promise<ReplayEvent[]> {
  const params: unknown[] = [startDate, endDate];
  let paramCount = 2;
  
  let queryText = `
    SELECT id, name, properties, session_id, user_id, timestamp
    FROM events
    WHERE timestamp >= $1 AND timestamp <= $2
  `;

  if (options.userId) {
    paramCount++;
    queryText += ` AND user_id = $${paramCount}`;
    params.push(options.userId);
  }

  if (options.sessionId) {
    paramCount++;
    queryText += ` AND session_id = $${paramCount}`;
    params.push(options.sessionId);
  }

  if (options.eventTypes && options.eventTypes.length > 0) {
    paramCount++;
    queryText += ` AND name = ANY($${paramCount})`;
    params.push(options.eventTypes);
  }

  queryText += ` ORDER BY timestamp ASC`;

  if (options.limit) {
    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(options.limit);
  }

  const result = await query(queryText, params);
  
  if (result.rows.length === 0) {
    return [];
  }

  const firstTimestamp = new Date(result.rows[0].timestamp).getTime();

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    properties: row.properties || {},
    sessionId: row.session_id,
    userId: row.user_id,
    timestamp: new Date(row.timestamp),
    relativeTimeMs: new Date(row.timestamp).getTime() - firstTimestamp
  }));
}

/**
 * Get a session replay with all events
 */
export async function getSessionReplay(sessionId: string): Promise<ReplaySession | null> {
  const result = await query(`
    SELECT id, name, properties, session_id, user_id, timestamp
    FROM events
    WHERE session_id = $1
    ORDER BY timestamp ASC
  `, [sessionId]);

  if (result.rows.length === 0) {
    return null;
  }

  const events = result.rows;
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const startTime = new Date(firstEvent.timestamp);
  const endTime = new Date(lastEvent.timestamp);
  const firstTimestamp = startTime.getTime();

  return {
    sessionId,
    startTime,
    endTime,
    eventCount: events.length,
    durationMs: endTime.getTime() - startTime.getTime(),
    events: events.map(row => ({
      id: row.id,
      name: row.name,
      properties: row.properties || {},
      sessionId: row.session_id,
      userId: row.user_id,
      timestamp: new Date(row.timestamp),
      relativeTimeMs: new Date(row.timestamp).getTime() - firstTimestamp
    }))
  };
}

/**
 * Get user journey replay (all sessions for a user)
 */
export async function getUserJourneyReplay(
  userId: string,
  options: { limit?: number } = {}
): Promise<{
  userId: string;
  sessionCount: number;
  totalEvents: number;
  sessions: ReplaySession[];
}> {
  // Get all sessions for the user
  const sessionsResult = await query(`
    SELECT DISTINCT session_id
    FROM events
    WHERE user_id = $1 AND session_id IS NOT NULL
    ORDER BY session_id
    ${options.limit ? `LIMIT $2` : ''}
  `, options.limit ? [userId, options.limit] : [userId]);

  const sessions: ReplaySession[] = [];
  let totalEvents = 0;

  for (const row of sessionsResult.rows) {
    const session = await getSessionReplay(row.session_id);
    if (session) {
      sessions.push(session);
      totalEvents += session.eventCount;
    }
  }

  return {
    userId,
    sessionCount: sessions.length,
    totalEvents,
    sessions
  };
}

/**
 * Create a timeline of events grouped by time buckets
 */
export async function getEventTimeline(
  startDate: Date,
  endDate: Date,
  bucketSizeMs: number = 60000 // Default 1 minute buckets
): Promise<Array<{
  bucketStart: Date;
  bucketEnd: Date;
  eventCount: number;
  eventTypes: Record<string, number>;
}>> {
  const result = await query(`
    SELECT name, timestamp
    FROM events
    WHERE timestamp >= $1 AND timestamp <= $2
    ORDER BY timestamp ASC
  `, [startDate, endDate]);

  if (result.rows.length === 0) {
    return [];
  }

  const buckets: Map<number, { count: number; types: Record<string, number> }> = new Map();
  const startTime = startDate.getTime();

  for (const row of result.rows) {
    const eventTime = new Date(row.timestamp).getTime();
    const bucketIndex = Math.floor((eventTime - startTime) / bucketSizeMs);
    
    if (!buckets.has(bucketIndex)) {
      buckets.set(bucketIndex, { count: 0, types: {} });
    }
    
    const bucket = buckets.get(bucketIndex)!;
    bucket.count++;
    bucket.types[row.name] = (bucket.types[row.name] || 0) + 1;
  }

  return Array.from(buckets.entries()).map(([index, data]) => ({
    bucketStart: new Date(startTime + index * bucketSizeMs),
    bucketEnd: new Date(startTime + (index + 1) * bucketSizeMs),
    eventCount: data.count,
    eventTypes: data.types
  }));
}
