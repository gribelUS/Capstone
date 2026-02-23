import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import * as db from './db';
import config from './config';
import { validateApiKey, AuthenticatedRequest } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { ValidationError } from './errors';
import { validateEventData, validateBatchEventData, sanitizeEventProperties } from './validation';
import { getMetrics, getContentType, httpRequestsTotal, httpRequestDuration, eventsTrackedTotal, batchEventsTotal } from './metrics';
import dashboardRoutes from './routes/dashboard';
import exportRoutes from './routes/export';
import analyticsRoutes from './routes/analytics';
import privacyRoutes from './routes/privacy';
import replayRoutes from './routes/replay';

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

const app = express();
const PORT = config.port;

// Parse JSON bodies
app.use(express.json());

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // For swagger-ui
      scriptSrc: ["'self'", "'unsafe-inline'"], // For swagger-ui
      imgSrc: ["'self'", "data:", "validator.swagger.io"],
    },
  },
}));

// Request logging
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  }
});
app.use('/api', limiter);

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Ultralytics API Documentation'
}));

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();

  // Check database connectivity
  let dbStatus = 'unknown';
  let dbLatency: number | null = null;


  try {
    const start = Date.now();
    await db.query('SELECT 1');
    dbLatency = Date.now() - start;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
    console.error('Database health check failed:', (error as Error).message);
  }

  // Get pool stats
  const poolStats = db.getPoolStats();

  const health = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: timestamp,
    uptime: process.uptime(),
    database: {
      status: dbStatus,
      latencyMs: dbLatency,
      pool: poolStats
    }
  };

  const statusCode = dbStatus === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Kubernetes liveness probe - checks if the process is running
// Returns 200 if the server can respond, regardless of dependencies
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Kubernetes readiness probe - checks if the server is ready to accept traffic
// Returns 200 only if all dependencies (database) are available
app.get('/readyz', async (_req: Request, res: Response) => {
  try {
    // Check database connection with a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database check timeout')), 5000);
    });
    
    const dbCheckPromise = db.query('SELECT 1');
    await Promise.race([dbCheckPromise, timeoutPromise]);
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok'
      }
    });
  } catch (error) {
    console.error('Readiness check failed:', (error as Error).message);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'failed'
      },
      error: (error as Error).message
    });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', getContentType());
    res.send(await getMetrics());
  } catch (error) {
    console.error('Error collecting metrics:', (error as Error).message);
    res.status(500).send('Error collecting metrics');
  }
});

// Apply API key authentication to all /api routes
app.use('/api', validateApiKey);

// Event tracking endpoint
app.post('/api/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, properties, sessionId, userId } = req.body;

    // Schema validation
    const validation = validateEventData(req.body);
    if (!validation.valid) {
      throw new ValidationError(validation.errors || 'Validation failed');
    }


    // Store the event with sanitized properties
    const event = {
      name: name,
      properties: sanitizeEventProperties(properties || {}) as Record<string, unknown>,
      sessionId: sessionId || null,
      userId: userId || null,
      timestamp: new Date()
    };

    const result = await db.storeEvent(event);

    // Track metrics
    eventsTrackedTotal.inc({ event_type: name });

    // Update session tracking
    if (sessionId) {
      await db.updateSession(sessionId);
    }

    res.status(201).json({
      success: true,
      eventId: result.id
    });
  } catch (error) {
    next(error);
  }
});

// Batch event tracking endpoint
app.post('/api/events/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { events } = req.body;

    // Schema validation
    const validation = validateBatchEventData(req.body);
    if (!validation.valid) {
      throw new ValidationError(validation.errors || 'Validation failed');
    }

    // Process events in chunks to avoid memory issues with large batches
    const CHUNK_SIZE = 100;
    const results: number[] = [];
    const sessionsToUpdate = new Set<string>();

    // Process in chunks for better memory management and reliability
    for (let i = 0; i < events.length; i += CHUNK_SIZE) {
      const chunk = events.slice(i, i + CHUNK_SIZE);
      
      // Process each event in the chunk
      const chunkPromises = chunk.map(async (eventData: {
        name: string;
        properties?: Record<string, unknown>;
        sessionId?: string;
        userId?: string;
        timestamp?: string;
      }) => {
        const event = {
          name: eventData.name,
          properties: sanitizeEventProperties(eventData.properties || {}) as Record<string, unknown>,
          sessionId: eventData.sessionId || null,
          userId: eventData.userId || null,
          timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date()
        };

        const result = await db.storeEvent(event);
        
        if (eventData.sessionId) {
          sessionsToUpdate.add(eventData.sessionId);
        }
        
        return result.id;
      });

      // Wait for the chunk to complete before processing the next
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    // Update sessions
    for (const sessionId of sessionsToUpdate) {
      await db.updateSession(sessionId);
    }

    // Track metrics
    batchEventsTotal.inc(results.length);

    res.status(201).json({
      success: true,
      eventIds: results,
      count: results.length
    });
  } catch (error) {
    next(error);
  }
});

// Query events endpoint
app.get('/api/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, name, sessionId, userId } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    let queryText = 'SELECT * FROM events WHERE 1=1';
    const params: unknown[] = [];
    let paramCount = 0;


    // Filter by date range
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

    // Filter by event name
    if (name) {
      paramCount++;
      queryText += ` AND name = $${paramCount}`;
      params.push(name);
    }

    // Filter by session ID
    if (sessionId) {
      paramCount++;
      queryText += ` AND session_id = $${paramCount}`;
      params.push(sessionId);
    }

    // Filter by user ID
    if (userId) {
      paramCount++;
      queryText += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }

    // Order and pagination
    queryText += ' ORDER BY timestamp DESC';

    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(Math.min(limit, 1000)); // Max 1000 results

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await db.query(queryText, params);

    res.json({
      events: result.rows,
      count: result.rows.length,
      offset: offset,
      limit: limit
    });
  } catch (error) {
    next(error);
  }
});

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Export routes
app.use('/api/export', exportRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// Privacy routes
app.use('/api/privacy', privacyRoutes);

// Replay routes
app.use('/api/replay', replayRoutes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Ultralytics server running on port ${PORT}`);
  });
}

export default app;
