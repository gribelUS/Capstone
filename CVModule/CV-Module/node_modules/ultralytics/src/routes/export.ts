import { Router, Request, Response, NextFunction } from 'express';
import * as db from '../db';

const router = Router();

/**
 * Export events in CSV or JSON format
 * GET /api/export
 * Query params:
 *   - format: 'csv' or 'json' (default: json)
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - name: event name filter
 *   - userId: user ID filter
 *   - limit: max records (default: 10000, max: 100000)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'json';
    const { startDate, endDate, name, userId } = req.query;
    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || 10000,
      100000
    );

    // Build query
    let queryText = 'SELECT id, name, properties, session_id, user_id, timestamp FROM events WHERE 1=1';
    const params: unknown[] = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      queryText += ` AND timestamp >= $${paramCount}`;
      params.push(new Date(startDate as string));
    }

    if (endDate) {
      paramCount++;
      queryText += ` AND timestamp <= $${paramCount}`;
      params.push(new Date(endDate as string));
    }

    if (name) {
      paramCount++;
      queryText += ` AND name = $${paramCount}`;
      params.push(name);
    }

    if (userId) {
      paramCount++;
      queryText += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }

    queryText += ' ORDER BY timestamp DESC';
    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limit);

    const result = await db.query(queryText, params);

    if (format === 'csv') {
      // Generate CSV
      const headers = ['id', 'name', 'properties', 'session_id', 'user_id', 'timestamp'];
      const csvRows = [headers.join(',')];

      for (const row of result.rows) {
        const values = [
          row.id,
          `"${(row.name || '').replace(/"/g, '""')}"`,
          `"${JSON.stringify(row.properties || {}).replace(/"/g, '""')}"`,
          row.session_id || '',
          row.user_id || '',
          row.timestamp?.toISOString() || ''
        ];
        csvRows.push(values.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="events-export-${Date.now()}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="events-export-${Date.now()}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        count: result.rows.length,
        events: result.rows
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
