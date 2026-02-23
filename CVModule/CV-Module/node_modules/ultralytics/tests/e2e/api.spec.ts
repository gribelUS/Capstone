import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test('health check returns ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('events endpoint requires authentication', async ({ request }) => {
    const response = await request.post('/api/events', {
      data: {
        type: 'pageview',
        properties: { path: '/test' }
      }
    });
    expect(response.status()).toBe(401);
  });

  test('events endpoint accepts valid events', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const response = await request.post('/api/events', {
      headers: {
        'X-API-Key': apiKey
      },
      data: {
        type: 'pageview',
        properties: { path: '/test-page' },
        timestamp: new Date().toISOString()
      }
    });
    expect(response.ok()).toBeTruthy();
  });

  test('batch endpoint accepts multiple events', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const events = Array.from({ length: 10 }, (_, i) => ({
      type: 'custom',
      properties: { index: i, test: true },
      timestamp: new Date().toISOString()
    }));

    const response = await request.post('/api/events/batch', {
      headers: {
        'X-API-Key': apiKey
      },
      data: { events }
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.processed).toBe(10);
  });

  test('dashboard summary requires authentication', async ({ request }) => {
    const response = await request.get('/api/dashboard/summary');
    expect(response.status()).toBe(401);
  });

  test('export endpoint returns data in JSON format', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const response = await request.get('/api/export?format=json&limit=10', {
      headers: {
        'X-API-Key': apiKey
      }
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('export endpoint returns data in CSV format', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const response = await request.get('/api/export?format=csv&limit=10', {
      headers: {
        'X-API-Key': apiKey
      }
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/csv');
  });

  test('metrics endpoint returns prometheus format', async ({ request }) => {
    const response = await request.get('/metrics');
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).toContain('http_requests_total');
  });
});
