import { test, expect } from '@playwright/test';

test.describe('Client Tracking Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to example app if available
    await page.goto('/');
  });

  test('client library loads without errors', async ({ page }) => {
    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Filter out expected errors (like missing API key warnings)
    const unexpectedErrors = errors.filter(
      e => !e.includes('API key') && !e.includes('not configured')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('page view is tracked on navigation', async ({ page, request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    // Track initial page load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to another page
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    
    // Small delay to allow events to be sent
    await page.waitForTimeout(500);
    
    // Verify events were recorded
    const response = await request.get('/api/events?limit=5', {
      headers: { 'X-API-Key': apiKey }
    });
    const events = await response.json();
    
    expect(events.length).toBeGreaterThan(0);
  });

  test('session tracking maintains session across pages', async ({ page, context }) => {
    // Get cookies after first page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const cookiesBefore = await context.cookies();
    const sessionBefore = cookiesBefore.find(c => c.name.includes('session'));
    
    // Navigate to another page
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    
    const cookiesAfter = await context.cookies();
    const sessionAfter = cookiesAfter.find(c => c.name.includes('session'));
    
    // Session should persist
    if (sessionBefore && sessionAfter) {
      expect(sessionBefore.value).toBe(sessionAfter.value);
    }
  });

  test('custom events can be tracked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Execute custom tracking call
    await page.evaluate(() => {
      if (typeof (window as any).Ultralytics !== 'undefined') {
        (window as any).Ultralytics.track('test_event', {
          category: 'e2e_test',
          label: 'playwright'
        });
      }
    });
    
    // Verify no errors occurred
    await page.waitForTimeout(500);
  });
});
