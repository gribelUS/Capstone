/**
 * Event Ingestion Benchmark
 * 
 * Tests the performance of the event tracking API under various loads.
 * 
 * Usage:
 *   node benchmarks/event-ingestion.js [options]
 * 
 * Options:
 *   --endpoint     Server URL (default: http://localhost:3000)
 *   --api-key      API key for authentication
 *   --duration     Test duration in seconds (default: 30)
 *   --concurrency  Number of concurrent requests (default: 10)
 */

const http = require('http');
const https = require('https');

// Configuration
const config = {
  endpoint: process.env.BENCHMARK_ENDPOINT || 'http://localhost:3000',
  apiKey: process.env.BENCHMARK_API_KEY || 'test-api-key',
  duration: parseInt(process.env.BENCHMARK_DURATION || '30', 10),
  concurrency: parseInt(process.env.BENCHMARK_CONCURRENCY || '10', 10),
};

// Parse command line arguments
for (let i = 2; i < process.argv.length; i += 2) {
  const arg = process.argv[i];
  const value = process.argv[i + 1];
  if (arg === '--endpoint') config.endpoint = value;
  if (arg === '--api-key') config.apiKey = value;
  if (arg === '--duration') config.duration = parseInt(value, 10);
  if (arg === '--concurrency') config.concurrency = parseInt(value, 10);
}

// Statistics
const stats = {
  requests: 0,
  success: 0,
  errors: 0,
  latencies: [],
};

// Generate random event data
function generateEvent() {
  return {
    name: ['page_view', 'button_click', 'form_submit', 'purchase'][Math.floor(Math.random() * 4)],
    properties: {
      page: '/page/' + Math.floor(Math.random() * 100),
      userId: 'user_' + Math.floor(Math.random() * 1000),
      timestamp: Date.now(),
      randomValue: Math.random(),
    },
    sessionId: 'session_' + Math.floor(Math.random() * 500),
  };
}

// Send a single event request
function sendEvent() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const url = new URL('/api/events', config.endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const data = JSON.stringify(generateEvent());
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-API-Key': config.apiKey,
      },
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const latencyMs = Number(end - start) / 1_000_000;
        
        stats.requests++;
        stats.latencies.push(latencyMs);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.success++;
        } else {
          stats.errors++;
        }
        
        resolve();
      });
    });

    req.on('error', () => {
      stats.requests++;
      stats.errors++;
      resolve();
    });

    req.write(data);
    req.end();
  });
}

// Send batch events
function sendBatch(batchSize) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const url = new URL('/api/events/batch', config.endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const events = [];
    for (let i = 0; i < batchSize; i++) {
      events.push(generateEvent());
    }
    
    const data = JSON.stringify({ events });
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-API-Key': config.apiKey,
      },
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const latencyMs = Number(end - start) / 1_000_000;
        
        stats.requests++;
        stats.latencies.push(latencyMs);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.success++;
        } else {
          stats.errors++;
        }
        
        resolve();
      });
    });

    req.on('error', () => {
      stats.requests++;
      stats.errors++;
      resolve();
    });

    req.write(data);
    req.end();
  });
}

// Calculate percentile
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Run benchmark
async function runBenchmark(name, testFn) {
  console.log(`\n📊 Running: ${name}`);
  console.log(`   Duration: ${config.duration}s, Concurrency: ${config.concurrency}`);
  
  // Reset stats
  stats.requests = 0;
  stats.success = 0;
  stats.errors = 0;
  stats.latencies = [];
  
  const endTime = Date.now() + (config.duration * 1000);
  const workers = [];
  
  // Worker function that keeps sending requests until time is up
  async function worker() {
    while (Date.now() < endTime) {
      await testFn();
    }
  }
  
  // Start concurrent workers
  for (let i = 0; i < config.concurrency; i++) {
    workers.push(worker());
  }
  
  await Promise.all(workers);
  
  // Calculate results
  const throughput = stats.requests / config.duration;
  const p50 = percentile(stats.latencies, 50);
  const p95 = percentile(stats.latencies, 95);
  const p99 = percentile(stats.latencies, 99);
  
  console.log(`\n   Results:`);
  console.log(`   ├─ Total Requests: ${stats.requests}`);
  console.log(`   ├─ Successful: ${stats.success} (${((stats.success / stats.requests) * 100).toFixed(1)}%)`);
  console.log(`   ├─ Errors: ${stats.errors}`);
  console.log(`   ├─ Throughput: ${throughput.toFixed(1)} req/s`);
  console.log(`   ├─ P50 Latency: ${p50.toFixed(2)}ms`);
  console.log(`   ├─ P95 Latency: ${p95.toFixed(2)}ms`);
  console.log(`   └─ P99 Latency: ${p99.toFixed(2)}ms`);
  
  return { throughput, p50, p95, p99 };
}

// Main
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('       Ultralytics Event Ingestion Benchmark');
  console.log('═══════════════════════════════════════════');
  console.log(`Endpoint: ${config.endpoint}`);
  
  // Warm up
  console.log('\n🔥 Warming up...');
  for (let i = 0; i < 100; i++) {
    await sendEvent();
  }
  
  // Run benchmarks
  const results = {};
  
  results.singleEvents = await runBenchmark('Single Event Ingestion', sendEvent);
  results.batch10 = await runBenchmark('Batch Ingestion (10 events)', () => sendBatch(10));
  results.batch100 = await runBenchmark('Batch Ingestion (100 events)', () => sendBatch(100));
  
  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('                    Summary');
  console.log('═══════════════════════════════════════════');
  console.log('| Scenario          | Throughput | P50    | P99    |');
  console.log('|-------------------|------------|--------|--------|');
  console.log(`| Single Events     | ${results.singleEvents.throughput.toFixed(0).padStart(8)} | ${results.singleEvents.p50.toFixed(1).padStart(5)}ms | ${results.singleEvents.p99.toFixed(1).padStart(5)}ms |`);
  console.log(`| Batch (10)        | ${results.batch10.throughput.toFixed(0).padStart(8)} | ${results.batch10.p50.toFixed(1).padStart(5)}ms | ${results.batch10.p99.toFixed(1).padStart(5)}ms |`);
  console.log(`| Batch (100)       | ${results.batch100.throughput.toFixed(0).padStart(8)} | ${results.batch100.p50.toFixed(1).padStart(5)}ms | ${results.batch100.p99.toFixed(1).padStart(5)}ms |`);
  console.log('═══════════════════════════════════════════\n');
}

main().catch(console.error);
