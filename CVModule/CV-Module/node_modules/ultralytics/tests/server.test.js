const request = require('supertest');

// Mock the database module before requiring the server
jest.mock('../dist/db', () => ({
  query: jest.fn(),
  storeEvent: jest.fn(),
  updateSession: jest.fn(),
  getPoolStats: jest.fn()
}));

// Mock the auth middleware to allow all requests in tests
jest.mock('../dist/middleware/auth', () => ({
  validateApiKey: (req, res, next) => next()
}));

const app = require('../dist/server').default;
const db = require('../dist/db');

describe('Ultralytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status when database is connected', async () => {
      db.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      db.getPoolStats.mockReturnValue({ total: 10, idle: 8, waiting: 0 });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.database.status).toBe('connected');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });

    it('should return degraded status when database is disconnected', async () => {
      db.query.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.database.status).toBe('disconnected');
    });
  });

  describe('POST /api/events', () => {
    it('should store a valid event', async () => {
      db.storeEvent.mockResolvedValue({ id: 1 });

      const response = await request(app)
        .post('/api/events')
        .send({
          name: 'page_view',
          properties: { page: '/home' }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.eventId).toBe(1);
      expect(db.storeEvent).toHaveBeenCalled();
    });

    it('should reject event without name', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          properties: { page: '/home' }
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should update session when sessionId is provided', async () => {
      db.storeEvent.mockResolvedValue({ id: 1 });
      db.updateSession.mockResolvedValue();

      await request(app)
        .post('/api/events')
        .send({
          name: 'page_view',
          sessionId: 'session-123'
        })
        .expect(201);

      expect(db.updateSession).toHaveBeenCalledWith('session-123');
    });
  });

  describe('POST /api/events/batch', () => {
    it('should store multiple events', async () => {
      db.storeEvent.mockResolvedValue({ id: 1 });
      db.updateSession.mockResolvedValue();

      const response = await request(app)
        .post('/api/events/batch')
        .send({
          events: [
            { name: 'event1', properties: { a: 1 } },
            { name: 'event2', properties: { b: 2 } }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(db.storeEvent).toHaveBeenCalledTimes(2);
    });

    it('should reject empty batch', async () => {
      const response = await request(app)
        .post('/api/events/batch')
        .send({
          events: []
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle large batches (>1000 events) correctly', async () => {
      // Generate a large batch of events
      const largeEventCount = 1500;
      let eventIdCounter = 0;
      db.storeEvent.mockImplementation(() => {
        eventIdCounter++;
        return Promise.resolve({ id: eventIdCounter });
      });
      db.updateSession.mockResolvedValue();

      const events = Array.from({ length: largeEventCount }, (_, i) => ({
        name: `event_${i}`,
        properties: { index: i },
        sessionId: `session_${i % 10}` // 10 unique sessions
      }));

      const response = await request(app)
        .post('/api/events/batch')
        .send({ events })
        .expect(201);

      // All events should be processed
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(largeEventCount);
      expect(response.body.eventIds).toHaveLength(largeEventCount);
      
      // storeEvent should be called for each event
      expect(db.storeEvent).toHaveBeenCalledTimes(largeEventCount);
      
      // Sessions should be updated (10 unique sessions)
      expect(db.updateSession).toHaveBeenCalledTimes(10);
    });
  });

  describe('GET /api/events', () => {
    it('should return events', async () => {
      const mockEvents = [
        { id: 1, name: 'page_view', properties: {}, timestamp: new Date() }
      ];
      db.query.mockResolvedValue({ rows: mockEvents });

      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(response.body.events).toEqual(mockEvents);
      expect(response.body.count).toBe(1);
    });

    it('should filter by date range', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/events')
        .query({
          startDate: '2020-01-01',
          endDate: '2020-12-31'
        })
        .expect(200);

      expect(db.query).toHaveBeenCalled();
      const queryCall = db.query.mock.calls[0];
      expect(queryCall[0]).toContain('timestamp >=');
      expect(queryCall[0]).toContain('timestamp <=');
    });

    it('should filter by event name', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/events')
        .query({ name: 'button_click' })
        .expect(200);

      const queryCall = db.query.mock.calls[0];
      expect(queryCall[0]).toContain('name =');
      expect(queryCall[1]).toContain('button_click');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body.error).toBe('NOT_FOUND');
    });
  });
});
