/**
 * Client library benchmarks
 * 
 * These benchmarks measure the performance overhead of the Ultralytics
 * client library in browser-like environments.
 * 
 * Run with: npm run benchmark:client
 */

import { performance } from 'perf_hooks';

// Mock browser globals for testing
(global as any).window = {
  location: { href: 'https://example.com/test' },
  document: { referrer: 'https://google.com' },
  navigator: { userAgent: 'Mozilla/5.0 (benchmark)' },
  localStorage: {
    store: {} as Record<string, string>,
    getItem(key: string) { return this.store[key] || null; },
    setItem(key: string, value: string) { this.store[key] = value; },
    removeItem(key: string) { delete this.store[key]; },
  },
};

(global as any).document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  referrer: 'https://google.com',
};

interface BenchmarkResult {
  name: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  memoryUsedKB?: number;
}

const ITERATIONS = parseInt(process.env.BENCH_ITERATIONS || '10000', 10);

function benchmark(name: string, fn: () => void, iterations: number = ITERATIONS): BenchmarkResult {
  // Warmup
  for (let i = 0; i < 100; i++) {
    fn();
  }

  // Force GC if available
  if (global.gc) global.gc();
  const startMem = process.memoryUsage().heapUsed;

  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const endMem = process.memoryUsage().heapUsed;
  const total = times.reduce((a, b) => a + b, 0);
  
  return {
    name,
    iterations,
    avgMs: total / iterations,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    memoryUsedKB: (endMem - startMem) / 1024,
  };
}

// Simple UUID-like ID generation (similar to what client uses)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Simulated event tracking function
function trackEvent(eventType: string, properties: Record<string, unknown>): void {
  const event = {
    event_type: eventType,
    session_id: generateId(),
    timestamp: new Date().toISOString(),
    properties: {
      ...properties,
      url: (global as any).window.location.href,
      referrer: (global as any).document.referrer,
    },
  };
  // Simulate serialization (would be sent to server)
  JSON.stringify(event);
}


async function runClientBenchmarks(): Promise<void> {
  console.log('Running client library benchmarks...\n');
  console.log(`Iterations: ${ITERATIONS}\n`);

  // ID generation benchmark
  const idGen = benchmark('ID generation', () => {
    generateId();
  });
  console.log(`${idGen.name}: ${(idGen.avgMs * 1000).toFixed(3)}µs avg`);

  // Simple event tracking
  const simpleEvent = benchmark('Track simple event', () => {
    trackEvent('click', { button: 'submit' });
  });
  console.log(`${simpleEvent.name}: ${(simpleEvent.avgMs * 1000).toFixed(3)}µs avg`);

  // Complex event tracking
  const complexEvent = benchmark('Track complex event', () => {
    trackEvent('purchase', {
      product_id: 'prod_123',
      product_name: 'Premium Plan',
      price: 99.99,
      currency: 'USD',
      quantity: 1,
      category: 'Subscriptions',
      tags: ['premium', 'annual', 'business'],
      metadata: {
        campaign: 'summer_sale',
        source: 'email',
        medium: 'newsletter',
      },
    });
  });
  console.log(`${complexEvent.name}: ${(complexEvent.avgMs * 1000).toFixed(3)}µs avg`);

  // Batch event creation
  const batchCreate = benchmark('Create batch of 10 events', () => {
    const events = [];
    for (let i = 0; i < 10; i++) {
      events.push({
        event_type: 'page_view',
        session_id: generateId(),
        timestamp: new Date().toISOString(),
        properties: { url: `/page-${i}` },
      });
    }
    JSON.stringify(events);
  }, ITERATIONS / 10);
  console.log(`${batchCreate.name}: ${(batchCreate.avgMs * 1000).toFixed(3)}µs avg`);

  // Results summary
  const results = {
    timestamp: new Date().toISOString(),
    benchmarks: [idGen, simpleEvent, complexEvent, batchCreate],
  };

  // Write results to file
  const fs = await import('fs/promises');
  const resultsDir = './benchmarks/results';
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.writeFile(
    `${resultsDir}/client-${Date.now()}.json`,
    JSON.stringify(results, null, 2)
  );

  console.log('\nResults written to benchmarks/results/');
}

runClientBenchmarks().catch(console.error);
