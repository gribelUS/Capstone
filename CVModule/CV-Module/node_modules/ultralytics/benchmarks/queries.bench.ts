import { performance } from 'perf_hooks';
import { Pool } from 'pg';
import { config } from '../src/config';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

const ITERATIONS = parseInt(process.env.BENCH_ITERATIONS || '100', 10);
const WARMUP = parseInt(process.env.BENCH_WARMUP || '10', 10);

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = ITERATIONS
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await fn();
  }

  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const total = times.reduce((a, b) => a + b, 0);
  
  return {
    name,
    iterations,
    totalMs: total,
    avgMs: total / iterations,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

async function runQueryBenchmarks(): Promise<void> {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
  });

  console.log('Running query benchmarks...\n');
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Warmup: ${WARMUP}\n`);

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Dashboard summary query
  const summary = await benchmark('Dashboard summary', async () => {
    await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT user_id) as unique_users
      FROM events
      WHERE timestamp BETWEEN $1 AND $2
    `, [startDate.toISOString(), endDate.toISOString()]);
  });
  console.log(`${summary.name}: ${summary.avgMs.toFixed(3)}ms avg`);

  // Events over time query
  const eventsOverTime = await benchmark('Events over time (hourly)', async () => {
    await pool.query(`
      SELECT 
        date_trunc('hour', timestamp) as hour,
        COUNT(*) as count
      FROM events
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY date_trunc('hour', timestamp)
      ORDER BY hour
    `, [startDate.toISOString(), endDate.toISOString()]);
  });
  console.log(`${eventsOverTime.name}: ${eventsOverTime.avgMs.toFixed(3)}ms avg`);

  // Top pages query
  const topPages = await benchmark('Top pages', async () => {
    await pool.query(`
      SELECT 
        properties->>'url' as url,
        COUNT(*) as views
      FROM events
      WHERE event_type = 'page_view'
        AND timestamp BETWEEN $1 AND $2
      GROUP BY properties->>'url'
      ORDER BY views DESC
      LIMIT 10
    `, [startDate.toISOString(), endDate.toISOString()]);
  });
  console.log(`${topPages.name}: ${topPages.avgMs.toFixed(3)}ms avg`);

  // User journey query
  const userJourney = await benchmark('User journey', async () => {
    await pool.query(`
      SELECT 
        session_id,
        array_agg(properties->>'url' ORDER BY timestamp) as pages
      FROM events
      WHERE event_type = 'page_view'
        AND timestamp BETWEEN $1 AND $2
      GROUP BY session_id
      LIMIT 100
    `, [startDate.toISOString(), endDate.toISOString()]);
  });
  console.log(`${userJourney.name}: ${userJourney.avgMs.toFixed(3)}ms avg`);


  // Results summary
  const results = {
    timestamp: new Date().toISOString(),
    benchmarks: [summary, eventsOverTime, topPages, userJourney],
  };

  // Write results to file
  const fs = await import('fs/promises');
  const resultsDir = './benchmarks/results';
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.writeFile(
    `${resultsDir}/queries-${Date.now()}.json`,
    JSON.stringify(results, null, 2)
  );

  await pool.end();
  console.log('\nResults written to benchmarks/results/');
}

runQueryBenchmarks().catch(console.error);
