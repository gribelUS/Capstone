/**
 * Query Performance Benchmark
 * 
 * Tests the performance of the query and analytics APIs.
 * 
 * Usage:
 *   node benchmarks/query-performance.js [options]
 * 
 * Options:
 *   --endpoint     Server URL (default: http://localhost:3000)
 *   --api-key      API key for authentication
 *   --iterations   Number of iterations per test (default: 100)
 */

const http = require('http');
const https = require('https');

// Configuration
const config = {
  endpoint: process.env.BENCHMARK_ENDPOINT || 'http://localhost:3000',
  apiKey: process.env.BENCHMARK_API_KEY || 'test-api-key',
  iterations: parseInt(process.env.BENCHMARK_ITERATIONS || '100', 10),
};

// Parse command line arguments
for (let i = 2; i < process.argv.length; i += 2) {
  const arg = process.argv[i];
  const value = process.argv[i + 1];
  if (arg === '--endpoint') config.endpoint = value;
  if (arg === '--api-key') config.apiKey = value;
  if (arg === '--iterations') config.iterations = parseInt(value, 10);
}

// Make HTTP request
function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const url = new URL(path, config.endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = client.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const latencyMs = Number(end - start) / 1_000_000;
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300,
          latency: latencyMs,
          status: res.statusCode,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        latency: 0,
        error: err.message,
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Calculate percentiles
function calculateStats(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

// Run a single benchmark
async function runBenchmark(name, requestFn) {
  console.log(`\n📊 ${name}`);
  
  const latencies = [];
  let success = 0;
  let errors = 0;
  
  for (let i = 0; i < config.iterations; i++) {
    const result = await requestFn();
    if (result.success) {
      success++;
      latencies.push(result.latency);
    } else {
      errors++;
    }
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r   Progress: ${i + 1}/${config.iterations}`);
    }
  }
  
  console.log(`\r   Progress: ${config.iterations}/${config.iterations}`);
  
  if (latencies.length === 0) {
    console.log('   ❌ All requests failed');
    return null;
  }
  
  const stats = calculateStats(latencies);
  
  console.log(`   ├─ Success Rate: ${((success / config.iterations) * 100).toFixed(1)}%`);
  console.log(`   ├─ Avg: ${stats.avg.toFixed(2)}ms`);
  console.log(`   ├─ P50: ${stats.p50.toFixed(2)}ms`);
  console.log(`   ├─ P95: ${stats.p95.toFixed(2)}ms`);
  console.log(`   └─ P99: ${stats.p99.toFixed(2)}ms`);
  
  return stats;
}

// Date helpers
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// Main
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('      Ultralytics Query Performance Benchmark');
  console.log('═══════════════════════════════════════════');
  console.log(`Endpoint: ${config.endpoint}`);
  console.log(`Iterations per test: ${config.iterations}`);
  
  const results = {};
  
  // Health check (warmup)
  console.log('\n🔥 Warming up...');
  for (let i = 0; i < 10; i++) {
    await makeRequest('/health');
  }
  
  // Event queries
  results.eventsRecent = await runBenchmark(
    'Query Recent Events (limit 100)',
    () => makeRequest('/api/events?limit=100')
  );
  
  results.eventsDay = await runBenchmark(
    'Query Events (1 day range)',
    () => makeRequest(`/api/events?startDate=${daysAgo(1)}&limit=100`)
  );
  
  results.eventsWeek = await runBenchmark(
    'Query Events (7 day range)',
    () => makeRequest(`/api/events?startDate=${daysAgo(7)}&limit=100`)
  );
  
  results.eventsMonth = await runBenchmark(
    'Query Events (30 day range)',
    () => makeRequest(`/api/events?startDate=${daysAgo(30)}&limit=100`)
  );
  
  // Dashboard queries
  results.dashboardSummary = await runBenchmark(
    'Dashboard Summary',
    () => makeRequest(`/api/dashboard/summary?startDate=${daysAgo(7)}&endDate=${daysAgo(0)}`)
  );
  
  results.eventsOverTime = await runBenchmark(
    'Events Over Time (daily)',
    () => makeRequest(`/api/dashboard/events-over-time?startDate=${daysAgo(30)}&granularity=day`)
  );
  
  // Analytics queries
  results.funnel = await runBenchmark(
    'Funnel Analysis',
    () => makeRequest('/api/analytics/funnel', 'POST', {
      steps: ['page_view', 'button_click', 'form_submit'],
      startDate: daysAgo(7),
      endDate: daysAgo(0),
    })
  );
  
  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('                    Summary');
  console.log('═══════════════════════════════════════════');
  console.log('| Query                      | P50     | P99     |');
  console.log('|----------------------------|---------|---------|');
  
  const printRow = (name, stats) => {
    if (stats) {
      console.log(`| ${name.padEnd(26)} | ${stats.p50.toFixed(1).padStart(5)}ms | ${stats.p99.toFixed(1).padStart(5)}ms |`);
    }
  };
  
  printRow('Recent Events (100)', results.eventsRecent);
  printRow('Events (1 day)', results.eventsDay);
  printRow('Events (7 days)', results.eventsWeek);
  printRow('Events (30 days)', results.eventsMonth);
  printRow('Dashboard Summary', results.dashboardSummary);
  printRow('Events Over Time', results.eventsOverTime);
  printRow('Funnel Analysis', results.funnel);
  
  console.log('═══════════════════════════════════════════\n');
}

main().catch(console.error);
